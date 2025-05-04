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
import { HTML5Backend } from "react-dnd-html5-backend"; // Ajout backend
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
    return "Date invalide";
  }
};

const ChangeExchangeContent = () => {
  // Renommé pour wrapper avec DndProvider plus tard
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- États pour le filtre de date ---
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // --- Récupération des réservations ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, "reservations"));
      const fetchedReservations = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        // Convertir les Timestamps ou strings en objets Date
        const startDate = data.startDate
          ? data.startDate instanceof Timestamp
            ? data.startDate.toDate()
            : new Date(data.startDate + "T00:00:00Z") // Assume UTC si string YYYY-MM-DD
          : null;
        const endDate = data.endDate
          ? data.endDate instanceof Timestamp
            ? data.endDate.toDate()
            : new Date(data.endDate + "T00:00:00Z") // Assume UTC si string YYYY-MM-DD
          : null;

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
      setError("Impossibile recuperare le prenotazioni.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- Fonction déclenchée par le bouton Cerca (optionnel) ---
  const handleSearch = () => {
    // Pour l'instant, le filtre est déjà appliqué en temps réel par findReservationForCellInRange
    // On pourrait ajouter ici une logique spécifique si nécessaire (ex: afficher un message)
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
      toast.success(`Ombrellone spostato verso ${newCellCode} !`);
      // Mettre à jour l'état local pour un retour visuel immédiat
      setReservations((prevReservations) =>
        prevReservations.map((res) =>
          res.id === reservationId ? { ...res, cellCode: newCellCode } : res
        )
      );
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la réservation:", err);
      toast.error("Errore durante lo spostamento dell'ombrellone.");
    }
  };

  // --- Fonction pour vérifier les conflits de date ---
  const checkConflict = (
    reservationToCheck, // La réservation dont on vérifie la période
    targetCellCode, // La cellule où elle pourrait aller
    excludedReservationId // L'ID de la réservation à ignorer sur la targetCell (celle avec qui on échange)
  ) => {
    if (
      !reservationToCheck ||
      !reservationToCheck.startDate ||
      !reservationToCheck.endDate
    ) {
      console.warn(
        "Vérification de conflit annulée: reservationToCheck invalide"
      );
      return false; // Pas de conflit si la réservation à vérifier est invalide
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
      // Ignorer la réservation exclue, celles sur d'autres cellules, et celles sans dates valides
      if (
        existingRes.id === excludedReservationId ||
        existingRes.cellCode !== targetCellCode ||
        !existingRes.startDate ||
        !existingRes.endDate
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

      // Vérification de chevauchement
      if (checkStartUTC <= existingEndUTC && checkEndUTC >= existingStartUTC) {
        console.warn(
          `Conflitto trovato per la prenotazione ${
            reservationToCheck.id
          } sur ${targetCellCode} avec ${existingRes.id} (${formatDateSimple(
            existingRes.startDate
          )}-${formatDateSimple(existingRes.endDate)})`
        );
        toast.error(
          `Conflitto su ${targetCellCode} con la penotazione di ${
            existingRes.nom || "Client"
          } (${formatDateSimple(existingRes.startDate)} - ${formatDateSimple(
            existingRes.endDate
          )})`
        );
        return true; // Conflit trouvé
      }
    }

    return false; // Aucun conflit trouvé
  };

  // --- Fonction pour échanger deux réservations dans Firestore ---
  const exchangeReservations = async (
    draggedResId,
    targetResId,
    draggedOriginalCellCode,
    targetCellCode
  ) => {
    // Récupérer les objets complets des réservations pour la vérification
    const draggedReservationData = reservations.find(
      (res) => res.id === draggedResId
    );
    const targetReservationData = reservations.find(
      (res) => res.id === targetResId
    );

    if (!draggedReservationData || !targetReservationData) {
      toast.error("Dati di prenotazione mancanti per lo scambio.");
      return;
    }

    console.log(
      `Tentative d'échange entre réservation ${draggedResId} (sur ${draggedOriginalCellCode}) et ${targetResId} (sur ${targetCellCode})`
    );

    // --- Vérification des conflits ---
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
      // Le message d'erreur détaillé est déjà affiché par checkConflict
      toast.error("Conflitto date trovato ! Scambio impossibile.");
      return; // Arrêter l'échange
    }
    // --- Fin de la vérification des conflits ---

    const draggedRef = doc(db, "reservations", draggedResId);
    const targetRef = doc(db, "reservations", targetResId);
    // Utiliser un batch pour s'assurer que les deux opérations réussissent ou échouent ensemble
    const batch = writeBatch(db);

    batch.update(draggedRef, { cellCode: targetCellCode }); // La résa glissée va sur la cellule cible
    batch.update(targetRef, { cellCode: draggedOriginalCellCode }); // La résa cible va sur la cellule d'origine de la glissée

    try {
      await batch.commit();
      console.log("Échange effectué avec succès.");
      toast.success(
        `Ombrelloni ${draggedOriginalCellCode} e ${targetCellCode} scambiati !`
      );
      // Mettre à jour l'état local pour un retour visuel immédiat
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
      toast.error("Errore duante lo scambio degli ombrelloni.");
    }
  };

  // --- Trouver la réservation qui chevauche la période de filtre pour une cellule ---
  const findReservationForCellInRange = (cellCode) => {
    // Si pas de dates de filtre valides, on cherche pour aujourd'hui par défaut
    let startFilter = new Date();
    startFilter.setHours(0, 0, 0, 0);
    let endFilter = new Date(startFilter); // Copie de startFilter

    if (filterStartDate && filterEndDate) {
      try {
        const tempStart = new Date(filterStartDate + "T00:00:00Z"); // Assume UTC
        const tempEnd = new Date(filterEndDate + "T00:00:00Z"); // Assume UTC
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

    // Convertir les dates de filtre en UTC pour la comparaison
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
      if (res.cellCode !== cellCode || !res.startDate || !res.endDate) {
        return false;
      }
      // Vérifie le chevauchement des périodes [resStart, resEnd] et [startFilter, endFilter]
      // Convertir les dates de réservation en UTC pour la comparaison
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
      // Comparaison avec les dates de filtre en UTC
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

    // --- Drag Hook (pour les cellules réservées) ---
    const [{ isDragging }, drag] = useDrag(
      () => ({
        type: ItemTypes.PARASOL,
        item: {
          reservationId: reservation?.id,
          originalCellCode: cellCode,
          reservationData: reservation,
        }, // Inclut la réservation entière
        canDrag: !!reservation, // On ne peut glisser que si la cellule est réservée
        collect: (monitor) => ({
          isDragging: !!monitor.isDragging(),
        }),
      }),
      [reservation, cellCode]
    ); // Dépendances

    // --- Drop Hook (pour les cellules libres ET réservées) ---
    const [{ isOver, canDrop }, drop] = useDrop(
      () => ({
        accept: ItemTypes.PARASOL, // Accepte les parasols
        canDrop: (item) => {
          // Vérifie si on essaie de déposer sur la même cellule
          if (item.originalCellCode === cellCode) {
            return false;
          }
          // Ici, on pourrait ajouter d'autres logiques si nécessaire
          // Par exemple, vérifier la compatibilité des périodes en cas d'échange
          return true;
        },
        drop: (item) => {
          // item contient { reservationId, originalCellCode, reservationData }
          if (item.reservationId && item.originalCellCode !== cellCode) {
            if (!reservation) {
              // Si la cellule cible est LIBRE
              moveReservation(item.reservationId, cellCode);
            } else {
              // Si la cellule cible est RÉSERVÉE (ÉCHANGE)
              exchangeReservations(
                item.reservationId,
                reservation.id,
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
      [reservation, cellCode, moveReservation, exchangeReservations] // Ajout de exchangeReservations aux dépendances
    ); // Dépendances

    // Appliquer les refs drag et drop au même élément div
    const ref = React.useRef(null);
    drag(drop(ref)); // Combine les refs

    return (
      <div
        ref={ref} // Applique la ref combinée
        className={`${styles.cell} ${
          reservation ? styles.reservedCell : styles.freeCell
        } ${isDragging ? styles.draggingCell : ""} ${
          isOver && canDrop ? styles.dropTargetCell : ""
        }`}
        title={
          reservation
            ? `Occupato da ${reservation.nom} ${reservation.prenom}`
            : `Libero ${cellCode}`
        }
        style={{ opacity: isDragging ? 0.5 : 1 }} // Style pendant le drag
      >
        <div className={styles.cellTop}>
          <div className={styles.cellTopHeader}>
            {reservation && (
              <span className={styles.serialNumber}>
                N°{reservation.serialNumber || "???"}
              </span>
            )}
            <span className={styles.cellCodeDisplay}>{cellCode}</span>
          </div>
          {reservation && (
            <>
              <span className={styles.clientName}>{reservation.nom}</span>
              <span className={styles.clientName}>{reservation.prenom}</span>
            </>
          )}
        </div>
        <div className={styles.cellBottom}>
          {reservation ? (
            <span className={styles.period}>
              {formatDateSimple(reservation.startDate)} -{" "}
              {formatDateSimple(reservation.endDate)}
            </span>
          ) : (
            <span>Libero</span>
          )}
        </div>
      </div>
    );
  };

  // --- Rendu ---
  return (
    <div className={styles.changeExchangeContainer}>
      <div className={styles.titre}>
        <h1>Gestione Cambi / Scambi Posto</h1>
        {/* <p>Seleziona un ombrellone per iniziare...</p> Commenté ou supprimé */}
      </div>

      {/* --- Section Filtre Date --- */}
      <div className={styles.filterContainer}>
        <div className={styles.formGroup}>
          <label htmlFor="filterStartDate">Data Inizio:</label>
          <input
            type="date"
            id="filterStartDate"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="filterEndDate">Data Fine:</label>
          <input
            type="date"
            id="filterEndDate"
            value={filterEndDate}
            min={filterStartDate} // Empêche date fin < date début
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
        {/* --- Bouton Cerca --- */}
        <div className={styles.searchAction}>
          {" "}
          {/* Conteneur pour aligner le bouton */}
          <button onClick={handleSearch} className={styles.searchButton}>
            Cerca
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.loadingIndicator}>Caricamento...</div>
      )}
      {error && <div className={styles.error}>{error}</div>}

      {!isLoading && !error && (
        <div className={styles.gridContainer}>
          {ROWS.map((row) => (
            <div key={row} className={styles.gridRow}>
              {Array.from({ length: COLS }).map((_, index) => {
                const col = String(index + 1).padStart(2, "0");
                const cellCode = `${row}${col}`;
                // Utilise le nouveau composant Cell
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
  return (
    <DndProvider backend={HTML5Backend}>
      <ChangeExchangeContent />
      {/* ToastContainer pour afficher les notifications */}
      <ToastContainer position="bottom-right" autoClose={5000} />{" "}
      {/* Augmenté autoClose pour lire les erreurs */}
    </DndProvider>
  );
};

export default ChangeExchange;
