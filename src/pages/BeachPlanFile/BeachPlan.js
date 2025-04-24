// src/pages/BeachPlanFile/BeachPlan.js
import React, { useState, useEffect, useCallback } from "react";
import styles from "./BeachPlan.module.css";
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

// Fonctions utilitaires
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper pour ajouter/soustraire des jours (important pour le split)
const addDays = (dateStr, days) => {
  if (!dateStr) return null; // Gérer le cas où dateStr est null/undefined
  try {
    const parts = dateStr.split("-");
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    ); // Mois est 0-indexé
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Erreur dans addDays avec dateStr:", dateStr, e);
    return null; // Retourner null en cas d'erreur de parsing
  }
};

const rows = ["A", "B", "C", "D"];
const columns = Array.from({ length: 36 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);

const reservationsCollectionRef = collection(db, "reservations");
const counterDocRef = doc(db, "counters", "reservationCounter");

export default function BeachPlan() {
  const [allReservations, setAllReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCellCode, setSelectedCellCode] = useState(null);
  const [currentReservationData, setCurrentReservationData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showReservationList, setShowReservationList] = useState(false);

  // Fonction pour obtenir le prochain numéro de série (inchangée)
  const getNextSerialNumber = useCallback(async () => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    try {
      let nextNumber = 1;
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          nextNumber = 1;
          transaction.set(counterDocRef, { lastNumber: 1 });
        } else {
          const lastNumber = counterDoc.data().lastNumber || 0;
          nextNumber = lastNumber + 1;
          transaction.update(counterDocRef, { lastNumber: nextNumber });
        }
      });
      return `${yearPrefix}${nextNumber.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Erreur lors de la génération du numéro de série:", error);
      throw new Error("Impossible de générer le numéro de série.");
    }
  }, []);

  // Fonction pour charger toutes les réservations (inchangée)
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(reservationsCollectionRef);
      const querySnapshot = await getDocs(q);
      const fetchedReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Assurer que les dates sont bien des strings YYYY-MM-DD
      const sanitizedReservations = fetchedReservations.map((res) => ({
        ...res,
        startDate: res.startDate || "", // Gérer les cas undefined/null
        endDate: res.endDate || "", // Gérer les cas undefined/null
        // Assurer que cabina existe, même si null
        cabina: res.cabina !== undefined ? res.cabina : null,
      }));
      setAllReservations(sanitizedReservations);
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      alert("Erreur lors du chargement des réservations.");
      setAllReservations([]); // Assurer que c'est un tableau même en cas d'erreur
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // handleDoubleClick (inchangé)
  const handleDoubleClick = (cellCode) => {
    setSelectedCellCode(cellCode);
    const reservationsForCellOnDate = Array.isArray(allReservations)
      ? allReservations.filter(
          (res) =>
            res.cellCode === cellCode &&
            res.startDate && // Vérifier existence dates
            res.endDate &&
            selectedDate >= res.startDate &&
            selectedDate <= res.endDate
        )
      : [];

    const fullDayRes = reservationsForCellOnDate.find(
      (res) => res.condition === "jour entier"
    );
    const morningRes = reservationsForCellOnDate.find(
      (res) => res.condition === "matin"
    );
    const afternoonRes = reservationsForCellOnDate.find(
      (res) => res.condition === "apres-midi"
    );

    let dataForModal = null;
    if (fullDayRes) dataForModal = fullDayRes;
    else if (morningRes) dataForModal = morningRes;
    else if (afternoonRes) dataForModal = afternoonRes;
    else {
      dataForModal = {
        nom: "",
        prenom: "",
        numBeds: 2,
        registiPoltrona: "",
        startDate: selectedDate,
        endDate: selectedDate,
        condition: "jour entier",
        serialNumber: null,
        id: null,
        cabina: null, // Initialiser cabina à null pour les nouvelles résas
      };
    }
    // S'assurer que cabina est bien défini (même si null) dans les données existantes
    if (dataForModal && dataForModal.cabina === undefined) {
      dataForModal.cabina = null;
    }

    setCurrentReservationData(dataForModal);
    setIsModalOpen(true);
  };

  // handleCloseModal (inchangé)
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellCode(null);
    setCurrentReservationData(null);
  };

  // --- MODIFIÉ: handleSaveReservation pour gérer cabina ---
  const handleSaveReservation = async (formDataFromModal) => {
    setIsSaving(true);
    // Destructure pour séparer les infos de contrôle du reste des données
    const {
      cellCode,
      modifySingleDay,
      targetDate,
      targetDateCondition,
      id: reservationId, // Renommer id pour clarté
      ...dataToSave // Contient nom, prenom, numBeds, dates, condition, serialNumber, ET cabina
    } = formDataFromModal;

    if (!cellCode) {
      console.error(
        "Tentativo di salvare senza codice d'ombrello:",
        formDataFromModal
      );
      alert("Errore: Codice ombrello mancante.");
      setIsSaving(false);
      return;
    }

    // --- CAS 1: Modification d'un seul jour (SPLIT) ---
    if (modifySingleDay && targetDate && targetDateCondition && reservationId) {
      console.log(
        `Tentativo di split per ${cellCode} il ${targetDate} con condizione ${targetDateCondition}`
      );
      let targetDaySerialNumber = null;
      let afterSerialNumber = null;

      try {
        // Générer les numéros de série nécessaires AVANT la transaction
        targetDaySerialNumber = await getNextSerialNumber();
        // Vérifier si une période "après" existera pour générer son numéro
        const originalResCheck = allReservations.find(
          (res) => res.id === reservationId
        );
        if (originalResCheck && originalResCheck.endDate > targetDate) {
          afterSerialNumber = await getNextSerialNumber();
        }

        const newReservationsForState = []; // Pour màj état local
        const updatesToOriginalForState = { deleted: false, endDate: null }; // Pour màj état local

        await runTransaction(db, async (transaction) => {
          const originalDocRef = doc(db, "reservations", reservationId);
          const originalDoc = await transaction.get(originalDocRef);

          if (!originalDoc.exists()) {
            throw new Error("Prenotazione originale non trovata per lo split.");
          }
          const originalData = originalDoc.data();

          // --- Vérification de Conflit pour le jour cible (Ombrellone) ---
          let conflictFoundOmbrellone = false;
          const existingOmbrelloneOnTargetDate = allReservations.filter(
            (res) =>
              res.cellCode === cellCode &&
              res.id !== reservationId && // Exclure l'originale
              res.startDate &&
              res.endDate &&
              targetDate >= res.startDate &&
              targetDate <= res.endDate
          );

          for (const existingRes of existingOmbrelloneOnTargetDate) {
            if (
              targetDateCondition === "jour entier" ||
              existingRes.condition === "jour entier" ||
              (targetDateCondition === "matin" &&
                existingRes.condition === "matin") ||
              (targetDateCondition === "apres-midi" &&
                existingRes.condition === "apres-midi")
            ) {
              conflictFoundOmbrellone = true;
              break;
            }
          }
          if (conflictFoundOmbrellone) {
            throw new Error(
              `Conflitto ombrellone rilevato per ${cellCode} il ${targetDate} con la condizione ${targetDateCondition}.`
            );
          }
          // --- Fin Vérification Conflit Ombrellone ---

          // --- Logique de Split ---

          // 1. Réservation pour le jour cible
          // Utilise les données de base de l'original, mais écrase avec les infos spécifiques du jour cible
          // y compris la cabina qui a été déterminée par le modal pour ce jour/condition spécifique
          const targetDayData = {
            ...originalData, // Base
            ...dataToSave, // Ecrase avec nom, prenom, numBeds, registi, cabina du formulaire
            startDate: targetDate, // Spécifique au jour
            endDate: targetDate, // Spécifique au jour
            condition: targetDateCondition, // Spécifique au jour
            serialNumber: targetDaySerialNumber, // Nouveau numéro
            cellCode: cellCode, // Assurer présence
            createdAt: originalData.createdAt || serverTimestamp(), // Conserver création originale
            modifiedAt: serverTimestamp(), // Nouvelle modification
          };
          // Supprimer l'id car c'est un nouveau document
          delete targetDayData.id;
          const targetDayDocRef = doc(collection(db, "reservations"));
          transaction.set(targetDayDocRef, targetDayData);
          newReservationsForState.push({
            id: targetDayDocRef.id,
            ...targetDayData,
          });
          console.log(
            "Split: Creata prenotazione per giorno target",
            targetDayData.serialNumber
          );

          // 2. Gérer la période AVANT le jour cible (si elle existe)
          if (originalData.startDate < targetDate) {
            const newEndDate = addDays(targetDate, -1);
            if (!newEndDate)
              throw new Error("Erreur calcul date fin période 'avant'.");
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginalForState.endDate = newEndDate; // Pour màj état local
            console.log(
              "Split: Aggiornata prenotazione originale (prima)",
              originalData.serialNumber,
              "nuova fine:",
              newEndDate
            );
          } else {
            // Si le jour cible EST la date de début originale, l'originale sera supprimée (ou écrasée si endDate = startDate)
            console.log("Split: Giorno target è startDate originale.");
          }

          // 3. Gérer la période APRÈS le jour cible (si elle existe)
          if (originalData.endDate > targetDate) {
            if (!afterSerialNumber)
              throw new Error(
                "Numero di serie mancante per il periodo 'dopo'."
              );
            const newStartDate = addDays(targetDate, 1);
            if (!newStartDate)
              throw new Error("Erreur calcul date début période 'après'.");

            // La période "après" hérite de TOUTES les données originales (y compris la cabina originale)
            const afterData = {
              ...originalData,
              startDate: newStartDate, // Nouvelle date début
              endDate: originalData.endDate, // Date fin originale
              serialNumber: afterSerialNumber, // Nouveau numéro
              cellCode: cellCode, // Assurer présence
              createdAt: originalData.createdAt || serverTimestamp(), // Conserver création originale
              modifiedAt: serverTimestamp(), // Nouvelle modification
            };
            // Supprimer l'id car c'est un nouveau document
            delete afterData.id;
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservationsForState.push({ id: afterDocRef.id, ...afterData });
            console.log(
              "Split: Creata prenotazione per periodo dopo",
              afterData.serialNumber,
              "inizio:",
              newStartDate
            );
          } else {
            console.log("Split: Giorno target è endDate originale.");
          }

          // 4. Supprimer l'originale si elle a été entièrement remplacée
          // (c'est-à-dire si la période "avant" n'existe pas car targetDate était startDate)
          // OU si la période "après" n'existe pas non plus (targetDate était endDate)
          // ET que la période "avant" n'a pas été créée non plus.
          // En gros, si on n'a PAS mis à jour l'endDate de l'original (updatesToOriginalForState.endDate est null)
          // ET qu'il n'y a pas de période "après" (originalData.endDate <= targetDate)
          // alors l'originale est complètement couverte par le nouveau jour cible et peut être supprimée.
          if (
            !updatesToOriginalForState.endDate &&
            originalData.endDate <= targetDate
          ) {
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true; // Pour màj état local
            console.log(
              "Split: Prenotazione originale eliminata perché completamente sostituita.",
              originalData.serialNumber
            );
          } else if (!updatesToOriginalForState.endDate) {
            // Cas où targetDate = startDate mais il y a une période après.
            // L'originale est remplacée par la période "après", on la supprime.
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true; // Pour màj état local
            console.log(
              "Split: Prenotazione originale eliminata perché startDate = targetDate.",
              originalData.serialNumber
            );
          }
        }); // --- Fin de la transaction Firestore ---

        // --- Mise à jour de l'état local ---
        setAllReservations((prev) => {
          let newState = [...prev];
          // Supprimer l'original si marqué comme supprimé
          if (updatesToOriginalForState.deleted) {
            newState = newState.filter((res) => res.id !== reservationId);
          }
          // Mettre à jour l'original si son endDate a changé
          else if (updatesToOriginalForState.endDate) {
            newState = newState.map((res) =>
              res.id === reservationId
                ? {
                    ...res,
                    endDate: updatesToOriginalForState.endDate,
                    modifiedAt: new Date(), // Simuler timestamp local
                  }
                : res
            );
          }
          // Ajouter les nouvelles réservations créées
          newState = [
            ...newState,
            ...newReservationsForState.map((nr) => ({
              ...nr,
              modifiedAt: new Date(),
            })), // Simuler timestamp local
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
      // --- Vérification de Conflit Globale (Ombrellone ET Cabine) ---
      let conflictFound = false;
      let conflictMessage = "";

      // Vérifier uniquement si les dates sont valides
      if (
        dataToSave.startDate &&
        dataToSave.endDate &&
        dataToSave.startDate <= dataToSave.endDate
      ) {
        const checkStartDate = new Date(dataToSave.startDate + "T00:00:00Z");
        const checkEndDate = new Date(dataToSave.endDate + "T00:00:00Z");
        let currentDate = new Date(checkStartDate);

        while (currentDate <= checkEndDate && !conflictFound) {
          const currentDateStr = currentDate.toISOString().split("T")[0];

          // Filtrer les réservations existantes pour la date courante (excluant celle en cours de modif si elle a un ID)
          const existingReservationsOnDate = allReservations.filter(
            (res) =>
              res.id !== reservationId && // Exclure la réservation en cours de modif
              res.startDate &&
              res.endDate && // S'assurer que les dates existent
              currentDateStr >= res.startDate &&
              currentDateStr <= res.endDate
          );

          for (const existingRes of existingReservationsOnDate) {
            // 1. Vérifier conflit Ombrellone
            if (existingRes.cellCode === cellCode) {
              if (
                dataToSave.condition === "jour entier" ||
                existingRes.condition === "jour entier" ||
                (dataToSave.condition === "matin" &&
                  existingRes.condition === "matin") ||
                (dataToSave.condition === "apres-midi" &&
                  existingRes.condition === "apres-midi")
              ) {
                conflictFound = true;
                conflictMessage = `Conflitto Ombrellone ${cellCode} rilevato il ${currentDateStr} con la prenotazione N° ${
                  existingRes.serialNumber || existingRes.id
                }.`;
                break; // Sortir de la boucle interne
              }
            }
            // 2. Vérifier conflit Cabine (seulement si une cabine est demandée ET assignée pour la nouvelle/modif)
            if (
              dataToSave.cabina &&
              existingRes.cabina &&
              dataToSave.cabina === existingRes.cabina
            ) {
              conflictFound = true;
              conflictMessage = `Conflitto Cabina ${
                dataToSave.cabina
              } rilevato il ${currentDateStr} con la prenotazione N° ${
                existingRes.serialNumber || existingRes.id
              }.`;
              break; // Sortir de la boucle interne
            }
          } // Fin boucle sur existingReservationsOnDate

          currentDate.setDate(currentDate.getDate() + 1); // Passer au jour suivant
        } // Fin boucle while sur les dates
      } else if (dataToSave.startDate > dataToSave.endDate) {
        conflictFound = true; // Considérer comme un conflit si les dates sont invalides
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
        // Préparer les données finales pour Firestore
        // Inclut nom, prenom, numBeds, dates, condition, serialNumber (si existant), ET cabina (peut être null)
        let finalData = {
          ...dataToSave, // Contient déjà cabina
          cellCode,
          modifiedAt: serverTimestamp(),
        };

        if (!reservationId) {
          // Nouvelle réservation
          const serialNumber = await getNextSerialNumber();
          finalData = {
            ...finalData,
            serialNumber,
            createdAt: serverTimestamp(),
          };
          // 'id' n'est pas dans finalData ici
          const docRef = await addDoc(reservationsCollectionRef, finalData);
          console.log("Nuova prenotazione creata con ID: ", docRef.id);
          // Mise à jour état local
          setAllReservations((prev) => [
            ...prev,
            {
              id: docRef.id, // Ajouter l'ID retourné par Firestore
              ...finalData, // Contient serialNumber et cabina
              createdAt: new Date(), // Simuler timestamp local
              modifiedAt: new Date(), // Simuler timestamp local
            },
          ]);
        } else {
          // Mise à jour globale d'une réservation existante
          const docRef = doc(db, "reservations", reservationId);
          // 'id' n'est pas nécessaire dans les données à écrire avec setDoc
          await setDoc(docRef, finalData, { merge: true }); // Utiliser merge:true est une bonne pratique
          console.log("Prenotazione aggiornato ID: ", reservationId);
          // Mise à jour état local
          setAllReservations((prev) =>
            prev.map((res) =>
              res.id === reservationId
                ? { ...res, ...finalData, modifiedAt: new Date() } // Fusionner les nouvelles données (incluant cabina)
                : res
            )
          );
        }
        handleCloseModal();
      } catch (error) {
        console.error("Errore durante il salvataggio:", error);
        alert(`Errore durante il salvataggio: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  }; // --- Fin handleSaveReservation ---

  // Fonction de suppression (inchangée)
  const handleDeleteReservation = async (reservationIdToDelete) => {
    if (!reservationIdToDelete) {
      alert("Impossibile eliminare: ID prenotazione mancante.");
      return;
    }
    // Confirmation supplémentaire
    const reservationToDelete = allReservations.find(
      (res) => res.id === reservationIdToDelete
    );
    const confirmMessage = reservationToDelete
      ? `Vuoi davvero cancellare la prenotazione per ${
          reservationToDelete.cellCode
        } (N° ${reservationToDelete.serialNumber || "N/A"}) ?`
      : `Vuoi davvero cancellare questa prenotazione (ID: ${reservationIdToDelete}) ?`;

    if (!window.confirm(confirmMessage)) {
      return; // Annuler si l'utilisateur clique sur "Annuler"
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "reservations", reservationIdToDelete);
      await deleteDoc(docRef);
      console.log("Réservation supprimée ID: ", reservationIdToDelete);
      setAllReservations((prev) =>
        prev.filter((res) => res.id !== reservationIdToDelete)
      );
      handleCloseModal(); // Fermer le modal après suppression réussie
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      alert(`Errore durante l'eliminazione: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // handleDateChange (inchangé)
  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  // handleOpenList / handleCloseList (inchangés)
  const handleOpenList = () => {
    setShowReservationList(true);
  };
  const handleCloseList = () => {
    setShowReservationList(false);
  };

  // Affichage du plan (inchangé)
  const renderBeachPlan = () => {
    if (isLoading) {
      return <div>Caricamento Beach Plan...</div>;
    }
    return (
      <div className={styles["beach-plan"]}>
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            {columns.map((col) => {
              const code = `${row}${col}`;
              const reservationsForCellOnDate = Array.isArray(allReservations)
                ? allReservations.filter(
                    (res) =>
                      res.cellCode === code &&
                      res.startDate &&
                      res.endDate &&
                      selectedDate >= res.startDate &&
                      selectedDate <= res.endDate
                  )
                : [];

              const isFullDay = reservationsForCellOnDate.some(
                (res) => res.condition === "jour entier"
              );
              const isMorning = reservationsForCellOnDate.some(
                (res) => res.condition === "matin"
              );
              const isAfternoon = reservationsForCellOnDate.some(
                (res) => res.condition === "apres-midi"
              );

              let cellClasses = [styles.cell];
              if (isFullDay || (isMorning && isAfternoon)) {
                cellClasses.push(styles.bookedFullDay);
              } else if (isMorning) {
                cellClasses.push(styles.bookedMorning);
              } else if (isAfternoon) {
                cellClasses.push(styles.bookedAfternoon);
              }

              return (
                <div
                  key={code}
                  className={cellClasses.join(" ")}
                  onDoubleClick={() => handleDoubleClick(code)}
                >
                  {code}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className={styles.controlsHeader}>
        <div className={styles.dateSelector}>
          <label htmlFor="planDate">BEACH PLAN per il giorno : </label>
          <input
            type="date"
            id="planDate"
            value={selectedDate}
            onChange={handleDateChange}
            min={getTodayString()} // Optionnel: empêcher sélection dates passées
          />
        </div>
        <button onClick={handleOpenList} className={styles.viewListButton}>
          Visualizza/Stampa Lista
        </button>
      </div>

      {renderBeachPlan()}

      {/* Modal de réservation - PASSAGE DE allReservations */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cellCode={selectedCellCode}
        reservationData={currentReservationData}
        onSave={handleSaveReservation} // Utilise la fonction modifiée
        onDelete={handleDeleteReservation}
        isSaving={isSaving}
        selectedDate={selectedDate}
        allReservations={allReservations} // <-- PROP AJOUTÉE ICI
      />

      {/* Affichage conditionnel de la liste (inchangé) */}
      {showReservationList && (
        <ReservationList
          reservations={allReservations}
          selectedDate={selectedDate}
          onClose={handleCloseList}
          rows={rows}
          columns={columns}
        />
      )}
    </>
  );
}
