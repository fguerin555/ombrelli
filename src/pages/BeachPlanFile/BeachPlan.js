// /Users/fredericguerin/Desktop/ombrelli/src/pages/BeachPlanFile/BeachPlan.js
import React, { useState, useEffect, useCallback } from "react";
import styles from "./BeachPlan.module.css"; // Assurez-vous que le chemin est correct
import ReservationModal from "./ReservationModal";
import ReservationList from "../ReservationListFile/ReservationList";
import { db } from "../../firebase"; // Assurez-vous que ce chemin est correct
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  addDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
// import { buttonBaseClasses } from "@mui/material"; // Import inutilisé, peut être supprimé

// --- Fonctions Utilitaires ---
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (dateStr, days) => {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("-");
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1, // Mois est 0-indexé
      parseInt(parts[2], 10)
    );
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Erreur dans addDays avec dateStr:", dateStr, e);
    return null;
  }
};

// --- Constantes du Plan ---
const rows = ["A", "B", "C", "D"];
const columns = Array.from({ length: 36 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);

// --- Références Firestore ---
const reservationsCollectionRef = collection(db, "reservations");
const counterDocRef = doc(db, "counters", "reservationCounter");

// --- Composant Principal ---
export default function BeachPlan() {
  // --- États ---
  const [allReservations, setAllReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCellCode, setSelectedCellCode] = useState(null);
  const [currentReservationData, setCurrentReservationData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showReservationList, setShowReservationList] = useState(false);

  // --- Fonction pour obtenir le prochain numéro de série (REINTEGREE + ROBUSTE) ---
  const getNextSerialNumber = useCallback(async () => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2); // Ex: "25"
    try {
      let nextNumber = 1; // Le numéro séquentiel (1, 2, 3...)
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          nextNumber = 1;
          transaction.set(counterDocRef, { lastNumber: 1 });
        } else {
          const lastNumber = counterDoc.data().lastNumber;
          if (typeof lastNumber !== "number" || isNaN(lastNumber)) {
            console.warn(
              `Valeur 'lastNumber' invalide (${lastNumber}) dans ${counterDocRef.path}. Réinitialisation à 0 avant incrémentation.`
            );
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
      console.error("Erreur lors de la génération du numéro de série:", error);
      throw new Error("Impossible de générer le numéro de série.");
    }
  }, []);

  // --- Fonction pour charger les réservations ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(reservationsCollectionRef);
      const querySnapshot = await getDocs(q);
      const fetchedReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const sanitizedReservations = fetchedReservations.map((res) => ({
        ...res,
        startDate: res.startDate || "",
        endDate: res.endDate || "",
        cabina: res.cabina !== undefined ? res.cabina : null,
        serialNumber: res.serialNumber || null,
        condition: res.condition || "",
      }));
      setAllReservations(sanitizedReservations);
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      alert("Erreur lors du chargement des réservations.");
      setAllReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- Gestionnaires d'Événements UI ---
  const handleDoubleClick = (cellCode, clickedHalf) => {
    setSelectedCellCode(cellCode);
    if (!Array.isArray(allReservations)) {
      console.error(
        "ERREUR: allReservations n'est pas un tableau!",
        allReservations
      );
      return;
    }
    const reservationsForCellOnDate = allReservations.filter(
      (res) =>
        res.cellCode === cellCode &&
        res.startDate &&
        res.endDate &&
        selectedDate >= res.startDate &&
        selectedDate <= res.endDate
    );

    const fullDayRes = reservationsForCellOnDate.find(
      (res) => res.condition === "jour entier"
    );
    const morningResOnly = reservationsForCellOnDate.find(
      (res) => res.condition === "matin"
    );
    const afternoonResOnly = reservationsForCellOnDate.find(
      (res) => res.condition === "apres-midi"
    );

    let dataForModal = null;

    if (fullDayRes) {
      // Si une réservation "jour entier" existe, elle prime.
      dataForModal = { ...fullDayRes }; // Copie pour éviter mutations directes
    } else if (morningResOnly && afternoonResOnly) {
      // Si matin ET après-midi sont réservés séparément
      dataForModal = {
        morning: { ...morningResOnly }, // Copie
        afternoon: { ...afternoonResOnly }, // Copie
        type: "dual", // Indique au modal qu'il y a deux réservations distinctes
      };
    } else if (morningResOnly) {
      // Si seulement le matin est réservé
      dataForModal = { ...morningResOnly }; // Copie
    } else if (afternoonResOnly) {
      // Si seulement l'après-midi est réservé
      dataForModal = { ...afternoonResOnly }; // Copie
    } else {
      // Aucune réservation existante pour cette cellule à cette date, préparer une nouvelle
      dataForModal = {
        nom: "",
        prenom: "",
        numBeds: 2,
        registiPoltrona: "",
        startDate: selectedDate,
        endDate: selectedDate,
        condition:
          clickedHalf === "matin"
            ? "matin"
            : clickedHalf === "apres-midi"
            ? "apres-midi"
            : "jour entier", // Pré-remplir la condition en fonction de la moitié cliquée
        serialNumber: null,
        id: null,
        cabina: null, // Assurer que cabina est null pour une nouvelle résa
      };
    }

    // Assurer que cabina est null et non undefined pour les réservations existantes (non-dual) si elle manque.
    // Pour le mode dual, le modal gère la cabina pour chaque demi-journée.
    // Pour une nouvelle réservation, cabina est déjà initialisée à null.
    if (
      dataForModal &&
      !dataForModal.type &&
      dataForModal.cabina === undefined
    ) {
      dataForModal.cabina = null;
    }

    setCurrentReservationData(dataForModal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellCode(null);
    setCurrentReservationData(null);
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  const handleOpenList = () => {
    setShowReservationList(true);
  };

  const handleCloseList = () => {
    setShowReservationList(false);
  };

  // --- LOGIQUE DE SAUVEGARDE (handleSaveReservation) ---
  const handleSaveReservation = async (formDataFromModal) => {
    setIsSaving(true);
    const {
      cellCode,
      modifySingleDay,
      targetDate,
      targetDateCondition,
      id: reservationId,
      serialNumber: existingSerialNumber,
      ...dataToSave
    } = formDataFromModal;

    if (!cellCode) {
      alert("Errore interno: Codice ombrellone mancante.");
      setIsSaving(false);
      return;
    }

    // --- CAS 1: Modification d'un seul jour (SPLIT) ---
    if (modifySingleDay && targetDate && targetDateCondition && reservationId) {
      console.log(`Tentativo di split per ${cellCode} il ${targetDate}`);
      let targetDaySerialNumber = null;
      let afterSerialNumber = null;
      try {
        targetDaySerialNumber = await getNextSerialNumber();
        const originalResCheck = allReservations.find(
          (res) => res.id === reservationId
        );
        if (originalResCheck && originalResCheck.endDate > targetDate) {
          afterSerialNumber = await getNextSerialNumber();
        }
        const newReservationsForState = [];
        const updatesToOriginalForState = { deleted: false, endDate: null };

        await runTransaction(db, async (transaction) => {
          const originalDocRef = doc(db, "reservations", reservationId);
          const originalDoc = await transaction.get(originalDocRef);
          if (!originalDoc.exists())
            throw new Error("Prenotazione originale non trovata per lo split.");
          const originalData = originalDoc.data();

          // --- Vérification Conflit (Simplifiée) ---
          // TODO: Ajouter une vérification de conflit robuste ici pour le targetDate

          // 1. Créer résa jour cible
          const targetDayData = {
            ...originalData,
            ...dataToSave,
            startDate: targetDate,
            endDate: targetDate,
            condition: targetDateCondition,
            serialNumber: targetDaySerialNumber,
            cellCode: cellCode,
            createdAt: originalData.createdAt || serverTimestamp(),
            status: "active", // Assurer que le jour splitté a un statut
            modifiedAt: serverTimestamp(),
          };
          delete targetDayData.id;
          const targetDayDocRef = doc(collection(db, "reservations"));
          transaction.set(targetDayDocRef, targetDayData);
          newReservationsForState.push({
            id: targetDayDocRef.id,
            ...targetDayData,
          });
          console.log(
            "Split: Creata prenotazione giorno target",
            targetDayData.serialNumber
          );

          // 2. Gérer période AVANT
          if (originalData.startDate < targetDate) {
            const newEndDate = addDays(targetDate, -1);
            if (!newEndDate)
              throw new Error("Errore calcolo data fine periodo 'avant'.");
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginalForState.endDate = newEndDate;
            console.log(
              "Split: Aggiornata prenotazione originale (prima)",
              originalData.serialNumber,
              "nuova fine:",
              newEndDate
            );
          } else {
            console.log("Split: Giorno target è startDate originale.");
          }

          // 3. Gérer période APRÈS
          if (originalData.endDate > targetDate) {
            if (!afterSerialNumber)
              throw new Error(
                "Numero di serie mancante per il periodo 'dopo'."
              );
            const newStartDate = addDays(targetDate, 1);
            if (!newStartDate)
              throw new Error("Errore calcolo data inizio periodo 'après'.");
            const afterData = {
              ...originalData,
              startDate: newStartDate,
              endDate: originalData.endDate,
              serialNumber: afterSerialNumber,
              cellCode: cellCode,
              createdAt: originalData.createdAt || serverTimestamp(),
              status: "active", // Assurer que le jour splitté a un statut
              modifiedAt: serverTimestamp(),
            };
            delete afterData.id;
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservationsForState.push({ id: afterDocRef.id, ...afterData });
            console.log(
              "Split: Creata prenotazione periodo dopo",
              afterData.serialNumber,
              "inizio:",
              newStartDate
            );
          } else {
            console.log("Split: Giorno target è endDate originale.");
          }

          // 4. Supprimer l'originale si couverte
          if (!updatesToOriginalForState.endDate) {
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true;
            console.log(
              "Split: Prenotazione originale eliminata (remplacée/couverte).",
              originalData.serialNumber
            );
          } else if (
            originalData.endDate <= targetDate &&
            updatesToOriginalForState.endDate
          ) {
            console.log(
              "Split: Prenotazione originale modifiée (avant), pas de période après."
            );
          }
        }); // --- Fin Transaction ---

        // --- MàJ État Local ---
        setAllReservations((prev) => {
          let newState = [...prev];
          if (updatesToOriginalForState.deleted) {
            newState = newState.filter((res) => res.id !== reservationId);
          } else if (updatesToOriginalForState.endDate) {
            newState = newState.map((res) =>
              res.id === reservationId
                ? {
                    ...res,
                    endDate: updatesToOriginalForState.endDate,
                    modifiedAt: new Date(),
                  }
                : res
            );
          }
          newState = [
            ...newState,
            ...newReservationsForState.map((nr) => ({
              ...nr,
              createdAt: nr.createdAt?.toDate
                ? nr.createdAt.toDate()
                : new Date(),
              modifiedAt: new Date(),
            })),
          ];
          return newState;
        });
        console.log("Split completato con successo.");
        handleCloseModal();
      } catch (error) {
        console.error("Errore durante lo split della prenotazione:", error);
        alert(`Errore durante la modifica del giorno: ${error.message}`);
      } finally {
        setIsSaving(false);
      }

      // --- CAS 2: Sauvegarde Normale (Nouvelle ou Mise à jour globale) ---
    } else {
      console.log(`Tentativo di salvataggio normale per ${cellCode}`);
      let conflictFound = false;
      let conflictMessage = "";

      if (
        dataToSave.startDate &&
        dataToSave.endDate &&
        dataToSave.startDate <= dataToSave.endDate
      ) {
        const potentialConflicts = allReservations.filter(
          (res) =>
            res.id !== reservationId &&
            res.startDate &&
            res.endDate &&
            dataToSave.startDate <= res.endDate &&
            dataToSave.endDate >= res.startDate &&
            (res.cellCode === cellCode ||
              (dataToSave.cabina &&
                res.cabina &&
                dataToSave.cabina === res.cabina))
        );

        for (const existingRes of potentialConflicts) {
          if (existingRes.cellCode === cellCode) {
            // Conflit Ombrellone
            if (
              dataToSave.condition === "jour entier" ||
              existingRes.condition === "jour entier" ||
              (dataToSave.condition === "matin" &&
                existingRes.condition === "matin") ||
              (dataToSave.condition === "apres-midi" &&
                existingRes.condition === "apres-midi")
            ) {
              conflictFound = true;
              conflictMessage = `Conflitto Ombrellone ${cellCode} rilevato (${
                existingRes.condition
              }) con N° ${existingRes.serialNumber || existingRes.id} (${
                existingRes.startDate
              } - ${existingRes.endDate}).`;
              break;
            }
          }
          if (
            dataToSave.cabina &&
            existingRes.cabina &&
            dataToSave.cabina === existingRes.cabina
          ) {
            // Conflit Cabine
            conflictFound = true;
            conflictMessage = `Conflitto Cabina ${
              dataToSave.cabina
            } rilevato con N° ${existingRes.serialNumber || existingRes.id} (${
              existingRes.startDate
            } - ${existingRes.endDate}).`;
            break;
          }
        }
      } else if (dataToSave.startDate > dataToSave.endDate) {
        conflictFound = true;
        conflictMessage =
          "La data di fine non può essere anteriore alla data di inizio.";
      }

      if (conflictFound) {
        alert(conflictMessage);
        setIsSaving(false);
        return;
      }
      // --- Fin Vérification Conflit Globale ---

      // --- Logique de sauvegarde Add/Set ---
      try {
        let finalData = {
          ...dataToSave,
          cellCode,
          modifiedAt: serverTimestamp(),
        };

        if (!reservationId) {
          // --- NOUVELLE réservation ---
          const newSerialNumber = await getNextSerialNumber();
          finalData = {
            ...finalData,
            serialNumber: newSerialNumber,
            createdAt: serverTimestamp(),
            status: "active", // Assurer que le jour splitté a un statut
          };
          const docRef = await addDoc(reservationsCollectionRef, finalData);
          console.log(
            "Nuova prenotazione creata:",
            docRef.id,
            "SN:",
            newSerialNumber
          );
          setAllReservations((prev) => [
            ...prev,
            {
              id: docRef.id,
              ...finalData,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ]);
        } else {
          // --- MISE À JOUR globale ---
          const docRef = doc(db, "reservations", reservationId);
          finalData.serialNumber = existingSerialNumber; // Conserver SN existant
          await setDoc(docRef, finalData, { merge: true });
          console.log("Prenotazione aggiornata:", reservationId);
          setAllReservations((prev) =>
            prev.map((res) =>
              res.id === reservationId
                ? { ...res, ...finalData, modifiedAt: new Date() }
                : res
            )
          );
        }
        handleCloseModal();
      } catch (error) {
        console.error("Errore durante il salvataggio:", error);
        if (error.message === "Impossible de générer le numéro de série.") {
          alert(`Errore critico: ${error.message} Contattare supporto.`);
        } else {
          alert(`Errore durante il salvataggio: ${error.message}`);
        }
      } finally {
        setIsSaving(false);
      }
    }
  }; // --- Fin handleSaveReservation ---

  // --- Fonction de suppression ---
  const handleDeleteReservation = async (reservationIdToDelete) => {
    if (!reservationIdToDelete) {
      alert("Impossibile eliminare: ID prenotazione mancante.");
      return;
    }
    const reservationToDelete = allReservations.find(
      (res) => res.id === reservationIdToDelete
    );
    const confirmMessage = reservationToDelete
      ? `Vuoi davvero cancellare la prenotazione per ${
          reservationToDelete.cellCode
        } (N° ${reservationToDelete.serialNumber || "N/A"}) ?`
      : `Vuoi davvero cancellare questa prenotazione (ID: ${reservationIdToDelete}) ?`;

    if (!window.confirm(confirmMessage)) return;

    setIsSaving(true);
    try {
      const docRef = doc(db, "reservations", reservationIdToDelete);
      await deleteDoc(docRef);
      console.log("Prenotazione eliminata:", reservationIdToDelete);
      setAllReservations((prev) =>
        prev.filter((res) => res.id !== reservationIdToDelete)
      );
      handleCloseModal();
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      alert(`Errore durante l'eliminazione: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rendu du Plan ---
  const renderBeachPlan = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingIndicator}>Caricamento Beach Plan...</div>
      );
    }
    if (!Array.isArray(allReservations)) {
      return (
        <div className={styles.errorLoading}>
          Errore: Dati prenotazioni non validi.
        </div>
      );
    }

    return (
      <div className={styles.beach_plan}>
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            {columns.map((col) => {
              const code = `${row}${col}`;
              const reservationsForCellOnDate = allReservations.filter(
                (res) =>
                  res.cellCode === code &&
                  res.startDate &&
                  res.endDate &&
                  selectedDate >= res.startDate &&
                  selectedDate <= res.endDate
              );

              // Trouver les réservations spécifiques pour ce jour/cellule
              const fullDayRes = reservationsForCellOnDate.find(
                (res) => res.condition === "jour entier"
              );
              const morningRes = reservationsForCellOnDate.find(
                (res) => res.condition === "matin"
              );
              const afternoonRes = reservationsForCellOnDate.find(
                (res) => res.condition === "apres-midi"
              );

              // Déterminer les classes CSS pour chaque moitié
              let morningClass = styles.colorEmpty;
              let afternoonClass = styles.colorEmpty;

              if (fullDayRes) {
                // Si jour entier, les deux moitiés sont rouges
                morningClass = styles.colorJourEntier;
                afternoonClass = styles.colorJourEntier;
              } else {
                // Sinon, vérifier chaque moitié indépendamment
                if (morningRes) {
                  morningClass = styles.colorMatin; // Bleu
                }
                if (afternoonRes) {
                  afternoonClass = styles.colorApresMidi; // Orange
                }
              }

              return (
                <div
                  key={code}
                  className={styles.cell}
                  title={`Ombrellone ${code}`}
                >
                  {/* Moitié Matin (supérieure) */}
                  <div
                    className={`${styles.cellHalf} ${morningClass}`}
                    onDoubleClick={() => handleDoubleClick(code, "matin")}
                  >
                    {code}{" "}
                    {/* Afficher le code seulement dans la partie supérieure */}
                  </div>
                  {/* Moitié Après-midi (inférieure) */}
                  <div
                    className={`${styles.cellHalf} ${afternoonClass}`}
                    onDoubleClick={() => handleDoubleClick(code, "apres-midi")}
                  ></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // --- Rendu JSX Principal ---
  return (
    // FIX 2: Ajout du Fragment React comme élément racine
    <>
      <div className={styles.controlsHeader}>
        <div className={styles.dateSelector}>
          <label htmlFor="planDate">BEACH PLAN per il giorno :&nbsp; </label>
          <input
            type="date"
            id="planDate"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>{" "}
        {/* Note: Espace avant > est inhabituel mais valide */}
        {/* FIX 3: Correction de l'accès à la classe CSS avec tiret */}
        <button
          onClick={handleOpenList}
          className={`${styles["my-button"]} ${styles.viewListButton}`}
        >
          Visualizza/Stampa Lista
        </button>
      </div>

      {renderBeachPlan()}

      <ReservationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cellCode={selectedCellCode}
        reservationData={currentReservationData}
        onSave={handleSaveReservation}
        onDelete={handleDeleteReservation}
        isSaving={isSaving}
        selectedDate={selectedDate}
        allReservations={allReservations}
      />

      {showReservationList && (
        <ReservationList
          reservations={allReservations}
          selectedDate={selectedDate}
          onClose={handleCloseList}
          rows={rows}
          columns={columns}
        />
      )}
    </> // FIX 2: Fermeture du Fragment React
  ); // Fermeture de la parenthèse du return
  // FIX 1: L'accolade supplémentaire qui était ici a été supprimée
}
