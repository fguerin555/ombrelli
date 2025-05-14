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
  addDoc, // Ajout pour la création via modal
  deleteDoc, // Ajout pour la suppression via modal
  serverTimestamp, // Ajout pour les dates de création/modif via modal
  runTransaction, // Ajout pour le numéro de série
} from "firebase/firestore"; // Ajout de doc et updateDoc
import styles from "./ChangeExchange.module.css"; // Nouveau fichier CSS
import { DndProvider, useDrag, useDrop } from "react-dnd"; // Ajout react-dnd
import { TouchBackend } from "react-dnd-touch-backend"; // Import du Touch Backend
import { toast, ToastContainer } from "react-toastify"; // Import ToastContainer
import "react-toastify/dist/ReactToastify.css"; // CSS pour react-toastify
import "../../Global.css"; // Pour les variables CSS globales si utilisées
import ReservationModal from "../BeachPlanFile/ReservationModal"; // Importer ReservationModal
import { useAuth } from "../../contexts/AuthContext"; // Importer useAuth

// --- Constantes pour la grille ---
const ROWS = ["A", "B", "C", "D"];
const COLS = 36;

// --- Constante pour le type d'élément draggable ---
const ItemTypes = {
  PARASOL: "parasol",
};

// !!! IMPORTANT : Remplacez ces placeholders par les VRAIS UID que vous avez mis dans vos règles Firestore !!!
const ADMIN_UIDS = [
  "TTbEHi8QRCTyMADYPt2N8yKB8Yg2",
  "BmT4kbaXHjguZecqMnQGEJGnqwL2",
]; // Exemple, à remplacer

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

// --- Référence Firestore pour le compteur de numéro de série ---
const counterDocRef = doc(db, "counters", "reservationCounter");

const ChangeExchangeContent = () => {
  // Renommé pour wrapper avec DndProvider plus tard
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- États pour le filtre de date ---
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // --- États pour le Modal de Réservation ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReservationDataForModal, setCurrentReservationDataForModal] =
    useState(null);
  const [selectedCellCodeForModal, setSelectedCellCodeForModal] =
    useState(null);
  const [selectedDateForModal, setSelectedDateForModal] = useState(null); // Date cliquée pour le contexte du modal
  const [isSavingModal, setIsSavingModal] = useState(false);

  // --- Infos Utilisateur/Admin ---
  const { currentUser } = useAuth(); // Récupérer l'utilisateur actuel
  const isCurrentUserAdmin =
    currentUser && ADMIN_UIDS.includes(currentUser.uid); // Déterminer si admin

  // --- Fonction pour obtenir le prochain numéro de série (Copiée de BeachPlanPeriod) ---
  const getNextSerialNumber = useCallback(async () => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    try {
      let nextNumber = 1;
      await runTransaction(db, async (transaction) => {
        const counterDocSnap = await transaction.get(counterDocRef); // Renommé pour éviter conflit
        if (!counterDocSnap.exists()) {
          nextNumber = 1;
          transaction.set(counterDocRef, { lastNumber: 1 });
        } else {
          const lastNumber = counterDocSnap.data().lastNumber;
          if (typeof lastNumber !== "number" || isNaN(lastNumber)) {
            nextNumber = 1;
            transaction.set(counterDocRef, { lastNumber: 1 });
          } else {
            nextNumber = lastNumber + 1;
            transaction.update(counterDocRef, { lastNumber: nextNumber });
          }
        }
      });
      return `${yearPrefix}${nextNumber.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Erreur génération SN:", error);
      throw new Error("Impossible de générer le numéro de série.");
    }
  }, []); // counterDocRef est une constante, pas besoin de l'ajouter aux deps

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
    // Re-fetch ou re-filtrer les réservations si nécessaire ici
    // Pour l'instant, findReservationForCellInRange utilise l'état du filtre
  };

  // --- Fonction pour déplacer une réservation dans Firestore ---
  // Cette fonction est appelée par le DND drop handler
  const moveReservation = async (reservationId, newCellCode) => {
    console.log(
      `Tentative de déplacement de la réservation ${reservationId} vers ${newCellCode}`
    );
    if (!isCurrentUserAdmin) {
      toast.error("Non hai i permessi per spostare le prenotazioni.");
      return; // Bloquer l'action si pas admin
    }
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
  // Utilisée par DND handlers et par handleModalSave
  const checkConflict = (
    reservationToCheck,
    targetCellCode,
    excludedReservationId
  ) => {
    if (
      !reservationToCheck ||
      !reservationToCheck.startDate ||
      !reservationToCheck.endDate
    ) {
      console.warn(
        "Vérification de conflit annulée: reservationToCheck invalide ou dates manquantes"
      );
      return false;
    }

    // Assurer que les dates sont des chaînes YYYY-MM-DD pour la comparaison
    const checkStartStr =
      typeof reservationToCheck.startDate === "string"
        ? reservationToCheck.startDate
        : reservationToCheck.startDate instanceof Date
        ? reservationToCheck.startDate.toISOString().slice(0, 10)
        : "";
    const checkEndStr =
      typeof reservationToCheck.endDate === "string"
        ? reservationToCheck.endDate
        : reservationToCheck.endDate instanceof Date
        ? reservationToCheck.endDate.toISOString().slice(0, 10)
        : "";

    if (!checkStartStr || !checkEndStr) {
      console.warn(
        "Vérification de conflit annulée: dates de reservationToCheck non valides après conversion."
      );
      return false;
    }

    for (const existingRes of reservations) {
      if (
        existingRes.id === excludedReservationId ||
        existingRes.cellCode !== targetCellCode ||
        !existingRes.startDate ||
        !existingRes.endDate
      ) {
        continue;
      }

      const existingStartStr =
        typeof existingRes.startDate === "string"
          ? existingRes.startDate
          : existingRes.startDate instanceof Date
          ? existingRes.startDate.toISOString().slice(0, 10)
          : "";
      const existingEndStr =
        typeof existingRes.endDate === "string"
          ? existingRes.endDate
          : existingRes.endDate instanceof Date
          ? existingRes.endDate.toISOString().slice(0, 10)
          : "";

      if (!existingStartStr || !existingEndStr) {
        console.warn(
          `Skipping conflict check with existing reservation ${existingRes.id} due to invalid dates.`
        );
        continue;
      }

      if (checkStartStr <= existingEndStr && checkEndStr >= existingStartStr) {
        console.warn(
          `Chevauchement de dates détecté pour ${
            reservationToCheck.id || "nouvelle réservation"
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
  // Cette fonction est appelée par le DND drop handler
  const exchangeReservations = async (
    draggedResId,
    targetResId,
    draggedOriginalCellCode,
    targetCellCode
  ) => {
    if (!isCurrentUserAdmin) {
      toast.error("Non hai i permessi per scambiare le prenotazioni.");
      return; // Bloquer l'action si pas admin
    }

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

    // IMPORTANT: Les vérifications de conflit ici doivent exclure la réservation qui va arriver
    // sur la cellule cible (pour le dragged) et la réservation qui va arriver sur la cellule
    // d'origine (pour le target).
    const conflictForDragged = checkConflict(
      draggedReservationData,
      targetCellCode,
      targetResId // Exclure la réservation cible car elle va partir
    );
    const conflictForTarget = checkConflict(
      targetReservationData,
      draggedOriginalCellCode,
      draggedResId // Exclure la réservation draguée car elle va partir
    );

    if (conflictForDragged || conflictForTarget) {
      // Les messages d'alerte sont déjà affichés par checkConflict
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

    // Convertir les dates de filtre en chaînes YYYY-MM-DD pour une comparaison fiable
    const startFilterStr = startFilter.toISOString().slice(0, 10);
    const endFilterStr = endFilter.toISOString().slice(0, 10);

    return reservations.find((res) => {
      if (res.cellCode !== cellCode || !res.startDate || !res.endDate) {
        return false;
      }
      // Assurer que les dates de réservation sont aussi des chaînes YYYY-MM-DD pour la comparaison
      const resStartStr =
        typeof res.startDate === "string"
          ? res.startDate
          : res.startDate instanceof Date
          ? res.startDate.toISOString().slice(0, 10)
          : "";
      const resEndStr =
        typeof res.endDate === "string"
          ? res.endDate
          : res.endDate instanceof Date
          ? res.endDate.toISOString().slice(0, 10)
          : "";

      if (!resStartStr || !resEndStr) return false;

      return (
        res.cellCode === cellCode &&
        resStartStr <= endFilterStr &&
        resEndStr >= startFilterStr
      );
    });
  };

  // --- Gestion de l'ouverture/fermeture du Modal ---
  const handleOpenModal = (cellCode, reservationDataParam = null) => {
    setSelectedCellCodeForModal(cellCode);

    let processedReservationData = null;
    if (reservationDataParam) {
      processedReservationData = {
        ...reservationDataParam,
        startDate:
          reservationDataParam.startDate instanceof Date
            ? reservationDataParam.startDate.toISOString().slice(0, 10)
            : typeof reservationDataParam.startDate === "string"
            ? reservationDataParam.startDate
            : null,
        endDate:
          reservationDataParam.endDate instanceof Date
            ? reservationDataParam.endDate.toISOString().slice(0, 10)
            : typeof reservationDataParam.endDate === "string"
            ? reservationDataParam.endDate
            : null,
      };
    }
    setCurrentReservationDataForModal(processedReservationData);

    // Déterminer la date à passer au modal pour la prop selectedDate
    // Cette date est utilisée par le modal pour les nouvelles réservations ou comme date de contexte.
    let contextDateForModal =
      filterStartDate || new Date().toISOString().slice(0, 10); // Défaut

    if (processedReservationData && processedReservationData.startDate) {
      // Si on modifie une résa existante, sa date de début (formatée en string) est un bon contexte.
      contextDateForModal = processedReservationData.startDate;
    } else if (filterStartDate) {
      // Si nouvelle résa et un filtre de date est actif, utiliser le début du filtre.
      // filterStartDate est déjà une chaîne YYYY-MM-DD
      contextDateForModal = filterStartDate;
    }
    // Si filterStartDate est vide et pas de réservation existante, contextDateForModal reste la date du jour.

    setSelectedDateForModal(contextDateForModal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentReservationDataForModal(null);
    setSelectedCellCodeForModal(null);
    setSelectedDateForModal(null);
    setIsSavingModal(false); // Assurer que l'état de sauvegarde est réinitialisé
    fetchReservations(); // Recharger les réservations après fermeture (pour voir les changements)
  };

  // --- Gestion de la Sauvegarde depuis le Modal ---
  const handleModalSave = async (formDataFromModal) => {
    setIsSavingModal(true);
    // Utiliser le cellCode du modal, pas celui de la cellule cliquée pour le DND
    const cellCode = selectedCellCodeForModal;
    try {
      const {
        id: reservationId,
        modifySingleDay,
        targetDate,
        targetDateCondition,
        ...dataToSave
      } = formDataFromModal;

      if (!isCurrentUserAdmin) {
        alert("Non hai i permessi per salvare le prenotazioni.");
        setIsSavingModal(false);
        return;
      }

      if (modifySingleDay) {
        alert(
          "La modifica di un singolo giorno (split) non è supportata in questa vista."
        );
        setIsSavingModal(false);
        return;
      }

      // --- Vérification de conflit AVANT de sauvegarder ---
      const conflictFound = checkConflict(
        { ...dataToSave, cellCode: cellCode, id: reservationId }, // Données à vérifier (inclure l'ID pour l'exclusion)
        cellCode, // Cellule cible
        reservationId // Exclure la réservation en cours de modification
      );

      if (conflictFound) {
        // L'alerte est déjà affichée par checkConflict
        setIsSavingModal(false);
        return; // Arrêter le processus de sauvegarde
      }

      // --- Préparation des données finales ---
      let finalData = {
        ...dataToSave,
        cellCode: cellCode,
        modifiedAt: serverTimestamp(),
      };

      if (reservationId) {
        // Mise à jour d'une réservation existante
        const docRef = doc(db, "reservations", reservationId);
        await updateDoc(docRef, finalData);
        console.log("Prenotazione aggiornata via modal:", reservationId);
      } else {
        // Création d'une nouvelle réservation
        const newSerialNumber = await getNextSerialNumber();
        finalData = {
          ...finalData,
          serialNumber: newSerialNumber,
          createdAt: serverTimestamp(),
          status: "active",
        };
        const docRef = await addDoc(collection(db, "reservations"), finalData);
        console.log(
          "Nuova prenotazione creata via modal:",
          docRef.id,
          "SN:",
          newSerialNumber
        );
      }

      fetchReservations();
      handleCloseModal();
      toast.success("Prenotazione salvata con successo!");
    } catch (error) {
      console.error("Errore durante il salvataggio via modal:", error);
      alert(`Errore durante il salvataggio: ${error.message}`);
      setIsSavingModal(false); // Assurer que isSavingModal est false en cas d'erreur
    }
    // setIsSavingModal(false); // Déplacé dans le bloc finally de handleCloseModal ou en cas d'erreur
  };

  // --- Gestion de la Suppression depuis le Modal ---
  const handleModalDelete = async (reservationIdToDelete) => {
    if (!reservationIdToDelete) {
      alert("ID prenotazione mancante per l'eliminazione.");
      return;
    }
    if (!isCurrentUserAdmin) {
      alert("Non hai i permessi per eliminare le prenotazioni.");
      return; // Bloquer l'action si pas admin
    }

    if (!window.confirm("Vuoi davvero cancellare questa prenotazione?")) {
      return; // Annulé par l'utilisateur
    }

    setIsSavingModal(true);
    try {
      const docRef = doc(db, "reservations", reservationIdToDelete);
      await deleteDoc(docRef);
      console.log("Prenotazione eliminata via modal:", reservationIdToDelete);

      // Mettre à jour l'état local
      setReservations((prev) =>
        prev.filter((res) => res.id !== reservationIdToDelete)
      );

      handleCloseModal(); // Fermer le modal
      toast.success("Prenotazione eliminata con successo!");
    } catch (error) {
      console.error("Errore durante l'eliminazione via modal:", error);
      alert(`Errore durante l'eliminazione: ${error.message}`);
    } finally {
      setIsSavingModal(false);
    }
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
          reservationData: reservation, // Passer les données complètes
        },
        canDrag: !!reservation && isCurrentUserAdmin, // Seuls les admins peuvent dragger
        collect: (monitor) => ({
          isDragging: !!monitor.isDragging(),
        }),
      }),
      [reservation, cellCode, isCurrentUserAdmin] // Ajouter isCurrentUserAdmin aux dépendances
    );

    const [{ isOver, canDrop }, drop] = useDrop(
      () => ({
        accept: ItemTypes.PARASOL,
        canDrop: (item) => {
          // Peut dropper si admin ET la cellule cible n'est pas la cellule d'origine
          return isCurrentUserAdmin && item.originalCellCode !== cellCode;
        },
        drop: (item) => {
          if (item.reservationId && item.originalCellCode !== cellCode) {
            const targetReservation = findReservationForCellInRange(cellCode);
            if (!targetReservation) {
              // Déplacer si la cible est vide (vérification de conflit incluse dans moveReservation)
              moveReservation(item.reservationId, cellCode);
            } else {
              // Échanger si la cible est occupée (vérification de conflit incluse dans exchangeReservations)
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
        checkConflict, // checkConflict est déjà dans le scope du composant parent
        isCurrentUserAdmin, // Ajouter isCurrentUserAdmin aux dépendances
      ]
    );

    const ref = React.useRef(null);
    drag(drop(ref));

    const displayReservation = reservation;

    // Gérer le clic simple pour ouvrir le modal
    const handleCellClick = () => {
      handleOpenModal(cellCode, displayReservation);
    };

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
        onClick={handleCellClick} // Ajouter le gestionnaire de clic simple
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

      {/* --- Modal de Réservation --- */}
      {isModalOpen && (
        <ReservationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          cellCode={selectedCellCodeForModal}
          reservationData={currentReservationDataForModal} // Passe les données de la résa (ou null pour nouvelle)
          onSave={handleModalSave} // Gère la sauvegarde depuis le modal
          onDelete={handleModalDelete} // Gère la suppression depuis le modal
          isSaving={isSavingModal} // Indique si une opération de sauvegarde/suppression est en cours
          selectedDate={selectedDateForModal} // Passe la date cliquée pour le contexte
          allReservations={reservations} // Passe toutes les résas pour la validation interne du modal
          isCurrentUserAdmin={isCurrentUserAdmin} // Passe le statut admin
        />
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
      {/* Les erreurs sont gérées par alert() et toast */}
    </DndProvider>
  );
};

export default ChangeExchange;
