// /Users/fredericguerin/Desktop/ombrelli/src/pages/ChangeExchangeFile/ChangeExchange.js
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../../firebase"; // Ajuste le chemin si nécessaire
import {
  collection,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  writeBatch, // Ajout pour les opérations atomiques (échange)
} from "firebase/firestore"; // Ajout de doc et updateDoc
import styles from "./ChangeExchange.module.css"; // Nouveau fichier CSS
import { DndProvider, useDrag, useDrop } from "react-dnd"; // Ajout react-dnd
// import { HTML5Backend } from "react-dnd-html5-backend"; // Remplacé par TouchBackend
import { TouchBackend } from "react-dnd-touch-backend"; // Import du Touch Backend
import { toast, ToastContainer } from "react-toastify"; // Import ToastContainer
import "react-toastify/dist/ReactToastify.css"; // CSS pour react-toastify
import "../../Global.css"; // Pour les variables CSS globales si utilisées

// --- Constantes pour la grille ---
const ROWS = ["A", "B", "C", "D"];
const COLS = 36;

// --- Constante pour le type d'élément draggable ---
const ItemTypes = {
  PARASOL: "parasol",
};

// --- Fonction simple pour formater la date (DD/MM/YYYY) ---
const formatDateSimple = (date) => {
  if (!date) return "N/A";
  // Assure que c'est un objet Date
  const d = date instanceof Date ? date : date.toDate();
  try {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0"); // Mois + 1 car commence à 0
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    console.error("Erreur formatage date:", e, date);
    return "Data invalida"; // Message en italien
  }
};

// --- Constantes pour le champ 'condition' ---
const CONDITION_FULL_DAY = "jour entier";
const CONDITION_MORNING = "matin"; // À vérifier/adapter
const CONDITION_AFTERNOON = "apres-midi"; // À vérifier/adapter

const ChangeExchangeContent = () => {
  // Renommé pour wrapper avec DndProvider plus tard
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- États pour le filtre de date ---
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // --- Fonction pour obtenir le style et le texte de la condition en italien ---
  const getConditionStyleAndText = (condition) => {
    switch (condition) {
      case CONDITION_FULL_DAY:
        return {
          text: "Giorno Intero",
          className: styles.conditionGiornoIntero,
        };
      case CONDITION_MORNING:
        return { text: "Mattina", className: styles.conditionMattina };
      case CONDITION_AFTERNOON:
        return { text: "Pomeriggio", className: styles.conditionPomeriggio };
      default:
        // Retourne la condition originale ou "N/A" si elle est vide/nulle, sans classe spécifique
        return { text: condition || "N/A", className: "" };
    }
  };

  // --- Récupération des réservations ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, "reservations"));
      const fetchedReservations = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        // Convertir les Timestamps ou strings en objets Date
        let startDate = null;
        if (data.startDate) {
          if (data.startDate instanceof Timestamp) {
            startDate = data.startDate.toDate();
          } else if (typeof data.startDate === "string") {
            startDate = new Date(data.startDate + "T00:00:00Z");
          } else if (data.startDate instanceof Date) {
            startDate = data.startDate;
          }
        }

        let endDate = null;
        if (data.endDate) {
          if (data.endDate instanceof Timestamp) {
            endDate = data.endDate.toDate();
          } else if (typeof data.endDate === "string") {
            endDate = new Date(data.endDate + "T00:00:00Z");
          } else if (data.endDate instanceof Date) {
            endDate = data.endDate;
          }
        }

        if (startDate && isNaN(startDate.getTime())) {
          console.warn(
            `Date de début invalide pour la réservation ${doc.id}:`,
            data.startDate
          );
          startDate = null;
        }
        if (endDate && isNaN(endDate.getTime())) {
          console.warn(
            `Date de fin invalide pour la réservation ${doc.id}:`,
            data.endDate
          );
          endDate = null;
        }

        return {
          id: doc.id,
          ...data,
          startDate, // Objet Date ou null
          endDate, // Objet Date ou null
        };
      });
      setReservations(fetchedReservations);
    } catch (err) {
      console.error("Erreur lors de la récupération des réservations:", err);
      setError("Impossibile caricare le prenotazioni."); // Message en italien
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- Fonction déclenchée par le bouton Cerca (optionnel) ---
  const handleSearch = () => {
    console.log("Recherche lancée avec dates:", filterStartDate, filterEndDate);
  };

  // --- Fonction pour déplacer une réservation dans Firestore ---
  const moveReservation = async (reservationId, newCellCode) => {
    console.log(
      `Tentative de déplacement de la réservation ${reservationId} vers ${newCellCode}`
    );
    const reservationRef = doc(db, "reservations", reservationId);
    try {
      await updateDoc(reservationRef, {
        cellCode: newCellCode,
      });
      console.log(
        `Réservation ${reservationId} déplacée vers ${newCellCode} avec succès.`
      );
      toast.success(`Ombrellone spostato con successo a ${newCellCode} !`); // Message en italien
      setReservations((prevReservations) =>
        prevReservations.map((res) =>
          res.id === reservationId ? { ...res, cellCode: newCellCode } : res
        )
      );
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la réservation:", err);
      alert("Errore durante spostamento dell'ombrellone"); // Message en italien
    }
  };

  // --- Fonction pour vérifier les conflits de date ET de condition ---
  const checkConflict = (
    reservationToCheck,
    targetCellCode,
    excludedReservationId
  ) => {
    if (
      !reservationToCheck ||
      !reservationToCheck.startDate ||
      !reservationToCheck.endDate ||
      isNaN(reservationToCheck.startDate.getTime()) ||
      isNaN(reservationToCheck.endDate.getTime())
    ) {
      console.warn(
        "Vérification de conflit annulée: reservationToCheck invalide ou dates invalides"
      );
      return false;
    }

    const checkStartUTC = new Date(
      Date.UTC(
        reservationToCheck.startDate.getUTCFullYear(),
        reservationToCheck.startDate.getUTCMonth(),
        reservationToCheck.startDate.getUTCDate()
      )
    );
    const checkEndUTC = new Date(
      Date.UTC(
        reservationToCheck.endDate.getUTCFullYear(),
        reservationToCheck.endDate.getUTCMonth(),
        reservationToCheck.endDate.getUTCDate()
      )
    );

    for (const existingRes of reservations) {
      if (
        existingRes.id === excludedReservationId ||
        existingRes.cellCode !== targetCellCode ||
        !existingRes.startDate ||
        !existingRes.endDate ||
        isNaN(existingRes.startDate.getTime()) ||
        isNaN(existingRes.endDate.getTime())
      ) {
        continue;
      }

      const existingStartUTC = new Date(
        Date.UTC(
          existingRes.startDate.getUTCFullYear(),
          existingRes.startDate.getUTCMonth(),
          existingRes.startDate.getUTCDate()
        )
      );
      const existingEndUTC = new Date(
        Date.UTC(
          existingRes.endDate.getUTCFullYear(),
          existingRes.endDate.getUTCMonth(),
          existingRes.endDate.getUTCDate()
        )
      );

      if (checkStartUTC <= existingEndUTC && checkEndUTC >= existingStartUTC) {
        console.warn(
          `Chevauchement de dates détecté pour ${
            reservationToCheck.id
          } sur ${targetCellCode} avec ${existingRes.id} (${formatDateSimple(
            existingRes.startDate
          )}-${formatDateSimple(existingRes.endDate)})`
        );

        const checkCondition = reservationToCheck.condition;
        const existingCondition = existingRes.condition;

        const conditionConflict =
          checkCondition === CONDITION_FULL_DAY ||
          existingCondition === CONDITION_FULL_DAY ||
          (checkCondition === CONDITION_MORNING &&
            existingCondition === CONDITION_MORNING) ||
          (checkCondition === CONDITION_AFTERNOON &&
            existingCondition === CONDITION_AFTERNOON);

        if (conditionConflict) {
          alert(
            `Conflitto su ${targetCellCode} con la prenotazione di ${
              existingRes.nom || "Client"
            } (${checkCondition} vs ${existingCondition}) per il periodo (${formatDateSimple(
              existingRes.startDate
            )} - ${formatDateSimple(existingRes.endDate)})` // Message en italien
          );
          return true;
        }
      }
    }
    return false;
  };

  // --- Fonction pour échanger deux réservations dans Firestore ---
  const exchangeReservations = async (
    draggedResId,
    targetResId,
    draggedOriginalCellCode,
    targetCellCode
  ) => {
    const draggedReservationData = reservations.find(
      (res) => res.id === draggedResId
    );
    const targetReservationData = reservations.find(
      (res) => res.id === targetResId
    );

    if (!draggedReservationData || !targetReservationData) {
      alert("Dati di prenotazioni mancanti per lo scambio"); // Message en italien
      return;
    }

    console.log(
      `Tentative d'échange entre réservation ${draggedResId} (sur ${draggedOriginalCellCode}) et ${targetResId} (sur ${targetCellCode})`
    );

    const conflictForDragged = checkConflict(
      draggedReservationData,
      targetCellCode,
      targetResId
    );
    const conflictForTarget = checkConflict(
      targetReservationData,
      draggedOriginalCellCode,
      draggedResId
    );

    if (conflictForDragged || conflictForTarget) {
      alert("Conflitto di date/condizione! Scambio impossibile."); // Message en italien
      return;
    }

    const draggedRef = doc(db, "reservations", draggedResId);
    const targetRef = doc(db, "reservations", targetResId);
    const batch = writeBatch(db);

    batch.update(draggedRef, { cellCode: targetCellCode });
    batch.update(targetRef, { cellCode: draggedOriginalCellCode });

    try {
      await batch.commit();
      console.log("Échange effectué avec succès.");
      toast.success(
        `Ombrelloni scambiati con successo fra ${draggedOriginalCellCode} e ${targetCellCode}!` // Message en italien
      );
      setReservations((prevReservations) =>
        prevReservations.map((res) => {
          if (res.id === draggedResId)
            return { ...res, cellCode: targetCellCode };
          if (res.id === targetResId)
            return { ...res, cellCode: draggedOriginalCellCode };
          return res;
        })
      );
    } catch (err) {
      console.error("Erreur lors de l'échange des réservations:", err);
      alert("Errore durante lo scambio di ombrelli"); // Message en italien
    }
  };

  // --- Trouver la réservation qui chevauche la période de filtre pour une cellule ---
  const findReservationForCellInRange = (cellCode) => {
    let startFilter = new Date();
    startFilter.setHours(0, 0, 0, 0);
    let endFilter = new Date(startFilter);

    if (filterStartDate && filterEndDate) {
      try {
        const tempStart = new Date(filterStartDate + "T00:00:00Z");
        const tempEnd = new Date(filterEndDate + "T00:00:00Z");
        if (!isNaN(tempStart) && !isNaN(tempEnd) && tempStart <= tempEnd) {
          startFilter = tempStart;
          endFilter = tempEnd;
        } else {
          console.warn(
            "Dates de filtre invalides, utilisation de la date du jour."
          );
        }
      } catch (e) {
        console.error("Erreur parsing dates filtre:", e);
      }
    }

    const startFilterUTC = new Date(
      Date.UTC(
        startFilter.getFullYear(),
        startFilter.getMonth(),
        startFilter.getDate()
      )
    );
    const endFilterUTC = new Date(
      Date.UTC(
        endFilter.getFullYear(),
        endFilter.getMonth(),
        endFilter.getDate()
      )
    );

    return reservations.find((res) => {
      if (
        res.cellCode !== cellCode ||
        !res.startDate ||
        !res.endDate ||
        isNaN(res.startDate.getTime()) ||
        isNaN(res.endDate.getTime())
      ) {
        return false;
      }
      const resStartUTC = new Date(
        Date.UTC(
          res.startDate.getUTCFullYear(),
          res.startDate.getUTCMonth(),
          res.startDate.getUTCDate()
        )
      );
      const resEndUTC = new Date(
        Date.UTC(
          res.endDate.getUTCFullYear(),
          res.endDate.getUTCMonth(),
          res.endDate.getUTCDate()
        )
      );
      return (
        res.cellCode === cellCode &&
        resStartUTC <= endFilterUTC &&
        resEndUTC >= startFilterUTC
      );
    });
  };

  // --- Composant Cellule (intégrant useDrag et useDrop) ---
  const Cell = ({ cellCode }) => {
    const reservation = findReservationForCellInRange(cellCode);
    const conditionInfo = reservation
      ? getConditionStyleAndText(reservation.condition)
      : { text: "N/A", className: "" };

    const [{ isDragging }, drag] = useDrag(
      () => ({
        type: ItemTypes.PARASOL,
        item: {
          reservationId: reservation?.id,
          originalCellCode: cellCode,
          reservationData: reservation,
        },
        canDrag: !!reservation,
        collect: (monitor) => ({
          isDragging: !!monitor.isDragging(),
        }),
      }),
      [reservation, cellCode]
    );

    const [{ isOver, canDrop }, drop] = useDrop(
      () => ({
        accept: ItemTypes.PARASOL,
        canDrop: (item) => {
          if (item.originalCellCode === cellCode) {
            return false;
          }
          return true;
        },
        drop: (item) => {
          if (item.reservationId && item.originalCellCode !== cellCode) {
            const targetReservation = findReservationForCellInRange(cellCode);
            if (!targetReservation) {
              // Vérifier le conflit avant de déplacer
              if (!checkConflict(item.reservationData, cellCode, null)) {
                moveReservation(item.reservationId, cellCode);
              }
            } else {
              // L'échange gère ses propres vérifications de conflit
              exchangeReservations(
                item.reservationId,
                targetReservation.id,
                item.originalCellCode,
                cellCode
              );
            }
          }
        },
        collect: (monitor) => ({
          isOver: !!monitor.isOver(),
          canDrop: !!monitor.canDrop(),
        }),
      }),
      [
        cellCode,
        moveReservation,
        exchangeReservations,
        findReservationForCellInRange,
        checkConflict, // Ajout de checkConflict aux dépendances
      ]
    );

    const ref = React.useRef(null);
    drag(drop(ref));

    const displayReservation = reservation;

    return (
      <div
        ref={ref}
        className={`${styles.cell} ${
          displayReservation ? styles.reservedCell : styles.freeCell
        } ${isDragging ? styles.draggingCell : ""} ${
          isOver && canDrop ? styles.dropTargetCell : ""
        }`}
        title={
          displayReservation
            ? `Occupato da ${displayReservation.nom} ${displayReservation.prenom} (${conditionInfo.text})`
            : `Libero ${cellCode}` // Message en italien
        }
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <div className={styles.cellTop}>
          <div className={styles.cellTopHeader}>
            {displayReservation && (
              <span className={styles.serialNumber}>
                N°{displayReservation.serialNumber || "???"}
              </span>
            )}
            <span className={styles.cellCodeDisplay}>{cellCode}</span>
          </div>
          {displayReservation && (
            <>
              <span className={styles.clientName}>
                {displayReservation.nom}
              </span>
              <span className={styles.clientName}>
                {displayReservation.prenom}
              </span>
            </>
          )}
        </div>
        <div className={styles.cellBottom}>
          {displayReservation ? (
            <>
              <span className={styles.period}>
                {formatDateSimple(displayReservation.startDate)} -{" "}
                {formatDateSimple(displayReservation.endDate)}
              </span>
              <br />
              <span className={conditionInfo.className}>
                ({conditionInfo.text})
              </span>
            </>
          ) : (
            <span>Libero</span> // Message en italien
          )}
        </div>
      </div>
    );
  };

  // --- Rendu ---
  return (
    <div className={styles.changeExchangeContainer}>
      <div className={styles.titre}>
        <h1>Gestione Cambi / Scambi Posto</h1> {/* Titre en italien */}
      </div>

      {/* --- Section Filtre Date --- */}
      <div className={styles.filterContainer}>
        <div className={styles.formGroup}>
          <label htmlFor="filterStartDate">Data Inizio:</label>{" "}
          {/* Label en italien */}
          <input
            type="date"
            id="filterStartDate"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="filterEndDate">Data Fine:</label>{" "}
          {/* Label en italien */}
          <input
            type="date"
            id="filterEndDate"
            value={filterEndDate}
            min={filterStartDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
        <div className={styles.searchAction}>
          <button onClick={handleSearch} className={styles.searchButton}>
            Cerca {/* Bouton en italien */}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.loadingIndicator}>Caricamento...</div> // Message en italien
      )}
      {error && <div className={styles.error}>{error}</div>}

      {!isLoading && !error && (
        <div className={styles.gridContainer}>
          {ROWS.map((row) => (
            <div key={row} className={styles.gridRow}>
              {Array.from({ length: COLS }).map((_, index) => {
                const col = String(index + 1).padStart(2, "0");
                const cellCode = `${row}${col}`;
                return <Cell key={cellCode} cellCode={cellCode} />;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Composant Principal qui fournit le contexte Dnd ---
const ChangeExchange = () => {
  // Options pour le TouchBackend, notamment pour activer les événements souris pour le test
  const touchBackendOptions = {
    enableMouseEvents: true, // Permet de tester avec la souris sur desktop
    delayTouchStart: 200, // Délai en ms avant que le toucher ne déclenche le drag (pour éviter les drags accidentels en scrollant)
    // Vous pouvez ajuster cette valeur (ex: 150, 250, 300) selon la sensibilité désirée.
  };

  return (
    <DndProvider backend={TouchBackend} options={touchBackendOptions}>
      {" "}
      {/* Utilisation du TouchBackend avec options */}
      <ChangeExchangeContent />
      {/* ToastContainer pour afficher les notifications de succès */}
      <ToastContainer position="bottom-right" autoClose={3000} />
      {/* Les erreurs sont gérées par alert() */}
    </DndProvider>
  );
};

export default ChangeExchange;
