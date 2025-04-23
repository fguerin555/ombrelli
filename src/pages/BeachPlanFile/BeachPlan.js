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
  const parts = dateStr.split("-");
  const date = new Date(parts[0], parts[1] - 1, parts[2]); // Mois est 0-indexé
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  // Fonction pour obtenir le prochain numéro de série
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

  // Fonction pour charger toutes les réservations
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

  // --- CORRIGÉ: handleDoubleClick avec logique de filtrage ---
  const handleDoubleClick = (cellCode) => {
    setSelectedCellCode(cellCode);

    // Filtrer les réservations pour cette cellule à la date sélectionnée
    const reservationsForCellOnDate = Array.isArray(allReservations)
      ? allReservations.filter(
          (res) =>
            res.cellCode === cellCode &&
            selectedDate >= res.startDate &&
            selectedDate <= res.endDate
        )
      : [];

    // Trouver une réservation existante pour pré-remplir le modal
    // Priorité: Jour entier > Matin > Après-midi
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
    if (fullDayRes) {
      dataForModal = fullDayRes;
    } else if (morningRes) {
      // Si seulement matin existe, on le prend
      dataForModal = morningRes;
    } else if (afternoonRes) {
      // Si seulement après-midi existe, on le prend
      dataForModal = afternoonRes;
    } else {
      // Aucune réservation existante pour cette cellule à cette date
      // Préparer les données pour une NOUVELLE réservation
      dataForModal = {
        nom: "",
        prenom: "",
        numBeds: 2, // Valeur par défaut
        registiPoltrona: "",
        startDate: selectedDate, // Date sélectionnée comme début/fin par défaut
        endDate: selectedDate,
        condition: "jour entier", // Condition par défaut
        serialNumber: null,
        id: null, // Important pour indiquer que c'est une nouvelle réservation
      };
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

  // --- MODIFIÉ: handleSaveReservation pour gérer le SPLIT ---
  const handleSaveReservation = async (formData) => {
    setIsSaving(true);
    const {
      cellCode,
      modifySingleDay,
      targetDate,
      targetDateCondition,
      ...dataToSave
    } = formData;

    if (!cellCode) {
      console.error("Tentativo di salvare senza codice d'ombrello:", formData);
      alert("Errore: Codice ombrello mancante.");
      setIsSaving(false);
      return;
    }

    // --- CAS 1: Modification d'un seul jour (SPLIT) ---
    if (modifySingleDay && targetDate && targetDateCondition && dataToSave.id) {
      console.log(
        `Tentativo di split per ${cellCode} il ${targetDate} con condizione ${targetDateCondition}`
      );
      const originalReservationId = dataToSave.id;
      let targetDaySerialNumber = null;
      let afterSerialNumber = null;

      try {
        // Générer les numéros de série nécessaires AVANT la transaction
        targetDaySerialNumber = await getNextSerialNumber();
        const originalResCheck = allReservations.find(
          (res) => res.id === originalReservationId
        );
        if (originalResCheck && originalResCheck.endDate > targetDate) {
          afterSerialNumber = await getNextSerialNumber();
        }

        const newReservations = [];
        const updatesToOriginal = { deleted: false, endDate: null };

        await runTransaction(db, async (transaction) => {
          const originalDocRef = doc(db, "reservations", originalReservationId);
          const originalDoc = await transaction.get(originalDocRef);

          if (!originalDoc.exists()) {
            throw new Error("Prenotazione originale non trovata per lo split.");
          }
          const originalData = originalDoc.data();

          // --- Vérification de Conflit pour le jour cible ---
          let conflictFound = false;
          const existingReservationsOnTargetDate = allReservations.filter(
            (res) =>
              res.cellCode === cellCode &&
              res.id !== originalReservationId &&
              targetDate >= res.startDate &&
              targetDate <= res.endDate
          );

          for (const existingRes of existingReservationsOnTargetDate) {
            if (
              targetDateCondition === "jour entier" ||
              existingRes.condition === "jour entier" ||
              (targetDateCondition === "matin" &&
                existingRes.condition === "matin") ||
              (targetDateCondition === "apres-midi" &&
                existingRes.condition === "apres-midi")
            ) {
              conflictFound = true;
              break;
            }
          }
          if (conflictFound) {
            throw new Error(
              `Conflitto rilevato per ${cellCode} il ${targetDate} con la condizione ${targetDateCondition}.`
            );
          }
          // --- Fin Vérification Conflit ---

          // --- Logique de Split ---

          // 1. Réservation pour le jour cible
          const targetDayData = {
            ...originalData,
            startDate: targetDate,
            endDate: targetDate,
            condition: targetDateCondition,
            serialNumber: targetDaySerialNumber,
            cellCode: cellCode, // Assurer que cellCode est bien là
            createdAt: originalData.createdAt || serverTimestamp(),
            modifiedAt: serverTimestamp(),
          };
          const targetDayDocRef = doc(collection(db, "reservations"));
          transaction.set(targetDayDocRef, targetDayData);
          newReservations.push({ id: targetDayDocRef.id, ...targetDayData });
          console.log(
            "Split: Creata prenotazione per giorno target",
            targetDayData.serialNumber
          );

          // 2. Gérer la période AVANT le jour cible
          if (originalData.startDate < targetDate) {
            const newEndDate = addDays(targetDate, -1);
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginal.endDate = newEndDate;
            console.log(
              "Split: Aggiornata prenotazione originale (prima)",
              originalData.serialNumber,
              "nuova fine:",
              newEndDate
            );
          } else {
            console.log("Split: Giorno target è startDate originale.");
          }

          // 3. Gérer la période APRÈS le jour cible
          if (originalData.endDate > targetDate) {
            if (!afterSerialNumber) {
              throw new Error(
                "Numero di serie mancante per il periodo 'dopo'."
              );
            }
            const newStartDate = addDays(targetDate, 1);
            const afterData = {
              ...originalData,
              startDate: newStartDate,
              endDate: originalData.endDate,
              serialNumber: afterSerialNumber,
              cellCode: cellCode, // Assurer que cellCode est bien là
              createdAt: originalData.createdAt || serverTimestamp(),
              modifiedAt: serverTimestamp(),
            };
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservations.push({ id: afterDocRef.id, ...afterData });
            console.log(
              "Split: Creata prenotazione per periodo dopo",
              afterData.serialNumber,
              "inizio:",
              newStartDate
            );
          } else {
            console.log("Split: Giorno target è endDate originale.");
          }

          // 4. Supprimer l'originale si elle a été entièrement remplacée OU si targetDate était startDate
          if (originalData.startDate === targetDate) {
            transaction.delete(originalDocRef);
            updatesToOriginal.deleted = true;
            console.log(
              "Split: Prenotazione originale eliminata perché sostituita.",
              originalData.serialNumber
            );
          }
        }); // --- Fin de la transaction Firestore ---

        // --- Mise à jour de l'état local ---
        setAllReservations((prev) => {
          let newState = [...prev];

          if (updatesToOriginal.deleted) {
            newState = newState.filter(
              (res) => res.id !== originalReservationId
            );
          } else if (updatesToOriginal.endDate) {
            // Vérifier si endDate a été mis à jour
            newState = newState.map((res) =>
              res.id === originalReservationId
                ? {
                    ...res,
                    endDate: updatesToOriginal.endDate,
                    modifiedAt: new Date(), // Simuler timestamp local
                  }
                : res
            );
          }
          // Ajouter les nouvelles réservations créées
          newState = [
            ...newState,
            ...newReservations.map((nr) => ({ ...nr, modifiedAt: new Date() })), // Simuler timestamp local
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
      // --- Vérification de Conflit Globale ---
      let conflictFound = false;
      const checkStartDate = new Date(dataToSave.startDate + "T00:00:00Z"); // Utiliser UTC pour éviter les pbs de fuseau horaire
      const checkEndDate = new Date(dataToSave.endDate + "T00:00:00Z");
      let currentDate = new Date(checkStartDate);

      while (currentDate <= checkEndDate) {
        const currentDateStr = currentDate.toISOString().split("T")[0];
        const existingReservationsOnDate = allReservations.filter(
          (res) =>
            res.cellCode === cellCode &&
            res.id !== dataToSave.id && // Exclure la réservation en cours de modif
            res.startDate &&
            res.endDate && // S'assurer que les dates existent
            currentDateStr >= res.startDate &&
            currentDateStr <= res.endDate
        );

        for (const existingRes of existingReservationsOnDate) {
          if (
            dataToSave.condition === "jour entier" ||
            existingRes.condition === "jour entier" ||
            (dataToSave.condition === "matin" &&
              existingRes.condition === "matin") ||
            (dataToSave.condition === "apres-midi" &&
              existingRes.condition === "apres-midi")
          ) {
            conflictFound = true;
            alert(
              `Conflitto rilevato per ${cellCode} il ${currentDateStr} con la prenotazione N° ${
                existingRes.serialNumber || existingRes.id
              }.`
            );
            break;
          }
        }
        if (conflictFound) break;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (conflictFound) {
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

        if (!finalData.id) {
          // Nouvelle réservation
          const serialNumber = await getNextSerialNumber();
          finalData = {
            ...finalData,
            serialNumber,
            createdAt: serverTimestamp(),
          };
          delete finalData.id; // Supprimer l'id null
          const docRef = await addDoc(reservationsCollectionRef, finalData);
          console.log("Nuova prenotazione creata con ID: ", docRef.id);
          setAllReservations((prev) => [
            ...prev,
            {
              id: docRef.id,
              ...finalData,
              createdAt: new Date(), // Simuler timestamp local
              modifiedAt: new Date(), // Simuler timestamp local
            },
          ]);
        } else {
          // Mise à jour globale
          const reservationId = finalData.id;
          const docRef = doc(db, "reservations", reservationId);
          const { id, ...updateData } = finalData; // Exclure l'ID
          await setDoc(docRef, updateData, { merge: true });
          console.log("Prenotazione aggiornato ID: ", reservationId);
          setAllReservations((prev) =>
            prev.map((res) =>
              res.id === reservationId
                ? { ...res, ...updateData, modifiedAt: new Date() } // Simuler timestamp local
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

  // Fonction de suppression (inchangée, mais ajout d'une alerte si id manque)
  const handleDeleteReservation = async (reservationId) => {
    if (!reservationId) {
      alert("Impossibile eliminare: ID prenotazione mancante.");
      return;
    }
    setIsSaving(true);
    try {
      const docRef = doc(db, "reservations", reservationId);
      await deleteDoc(docRef);
      console.log("Réservation supprimée ID: ", reservationId);
      setAllReservations((prev) =>
        prev.filter((res) => res.id !== reservationId)
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

  if (isLoading) {
    return <div>Caricamento Beach Plan...</div>;
  }

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

      {/* --- CORRIGÉ: Plan de plage avec logique de rendu --- */}
      <div className={styles["beach-plan"]}>
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            {columns.map((col) => {
              const code = `${row}${col}`;

              // Filtrer les réservations pour cette cellule à la date sélectionnée
              // Ajout d'une vérification Array.isArray pour la robustesse
              const reservationsForCellOnDate = Array.isArray(allReservations)
                ? allReservations.filter(
                    (res) =>
                      res.cellCode === code &&
                      res.startDate && // Vérifier que les dates existent
                      res.endDate &&
                      selectedDate >= res.startDate &&
                      selectedDate <= res.endDate
                  )
                : []; // Si allReservations n'est pas un tableau, retourne un tableau vide

              // Vérifier les conditions pour cette cellule à cette date
              const isFullDay = reservationsForCellOnDate.some(
                (res) => res.condition === "jour entier"
              );
              const isMorning = reservationsForCellOnDate.some(
                (res) => res.condition === "matin"
              );
              const isAfternoon = reservationsForCellOnDate.some(
                (res) => res.condition === "apres-midi"
              );

              // Déterminer les classes CSS pour la cellule
              let cellClasses = [styles.cell];
              if (isFullDay || (isMorning && isAfternoon)) {
                // Si jour entier OU matin ET après-midi sont réservés
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
                  onDoubleClick={() => handleDoubleClick(code)} // Utilise la fonction corrigée
                >
                  {code}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal de réservation - PASSAGE DE selectedDate */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cellCode={selectedCellCode}
        reservationData={currentReservationData}
        onSave={handleSaveReservation} // Utilise la fonction modifiée
        onDelete={handleDeleteReservation}
        isSaving={isSaving}
        selectedDate={selectedDate} // Prop essentielle pour le modal
      />

      {/* Affichage conditionnel de la liste (inchangé) */}
      {showReservationList && (
        <ReservationList
          reservations={allReservations}
          selectedDate={selectedDate} // Passer la date sélectionnée si nécessaire pour le filtrage/affichage
          onClose={handleCloseList}
          rows={rows}
          columns={columns}
        />
      )}
    </>
  );
}
