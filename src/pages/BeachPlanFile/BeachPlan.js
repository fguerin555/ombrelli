// src/pages/BeachPlanFile/BeachPlan.js
import React, { useState, useEffect, useCallback } from "react";
import styles from "./BeachPlan.module.css";
import ReservationModal from "./ReservationModal";
import ReservationList from "../ReservationListFile/ReservationList"; // <-- Importer le nouveau composant
import { db } from ".//../../firebase";
// ... (autres imports inchangés)
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  addDoc,
  runTransaction,
} from "firebase/firestore";

// ... (getTodayString, rows, columns, refs inchangés) ...
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
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
  const [isCreatingComplementary, setIsCreatingComplementary] = useState(false);
  // --- NOUVEAU: État pour afficher/masquer la liste ---
  const [showReservationList, setShowReservationList] = useState(false);
  // --- FIN NOUVEAU ---

  // ... (getNextSerialNumber, fetchReservations, handleDoubleClick, handleCloseModal, handleSaveReservation, handleDeleteReservation inchangés) ...
  const getNextSerialNumber = useCallback(async () => {
    // ... (pas de changement ici)
    const yearPrefix = "25"; // Préfixe pour l'année 2025
    try {
      let nextNumber = 1;
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          console.log("Compteur non trouvé, initialisation à 1.");
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

  // --- MODIFICATION: fetchReservations charge tout dans un tableau ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(reservationsCollectionRef); // Peut être optimisé pour ne charger que les résas visibles
      const querySnapshot = await getDocs(q);
      const fetchedReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllReservations(fetchedReservations);
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      alert("Erreur lors du chargement des réservations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- MODIFICATION: handleDoubleClick prend en compte la date sélectionnée ---
  const handleDoubleClick = (cellCode) => {
    setSelectedCellCode(cellCode);

    // Filtrer les réservations pour cette cellule ET cette date
    const reservationsForCellOnDate = allReservations.filter(
      (res) =>
        res.cellCode === cellCode &&
        selectedDate >= res.startDate &&
        selectedDate <= res.endDate
    );

    const morningRes = reservationsForCellOnDate.find(
      (res) =>
        res.condition === "matin" &&
        res.startDate === selectedDate &&
        res.endDate === selectedDate
    );
    const afternoonRes = reservationsForCellOnDate.find(
      (res) =>
        res.condition === "apres-midi" &&
        res.startDate === selectedDate &&
        res.endDate === selectedDate
    );
    const fullDayRes = reservationsForCellOnDate.find(
      (res) => res.condition === "jour entier"
    ); // Peut couvrir plusieurs jours

    let dataForModal = null;
    setIsCreatingComplementary(false); // Réinitialiser

    if (fullDayRes) {
      dataForModal = fullDayRes; // Priorité au jour entier
    } else if (morningRes && afternoonRes) {
      dataForModal = morningRes; // Si les deux existent, ouvrir le matin par défaut
    } else if (morningRes) {
      dataForModal = morningRes;
      // On pourrait ouvrir pour créer l'après-midi
      // setIsCreatingComplementary(true); // On pourrait utiliser ça pour pré-remplir le modal
    } else if (afternoonRes) {
      dataForModal = afternoonRes;
      // On pourrait ouvrir pour créer le matin
      // setIsCreatingComplementary(true);
    } else {
      // Aucune réservation pour ce jour spécifique, ouvrir pour une nouvelle
      dataForModal = null;
      // Pré-remplir la date sélectionnée pour une nouvelle réservation
      setCurrentReservationData({
        startDate: selectedDate,
        endDate: selectedDate,
      }); // Passer un objet partiel
      setIsModalOpen(true);
      return; // Sortir car on a déjà ouvert le modal
    }

    setCurrentReservationData(dataForModal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellCode(null);
    setCurrentReservationData(null);
    setIsCreatingComplementary(false);
  };

  // --- MODIFICATION: handleSaveReservation avec vérification de conflit ---
  const handleSaveReservation = async (formData) => {
    setIsSaving(true);
    const { cellCode, ...dataToSave } = formData;

    if (!cellCode) {
      // ... (gestion erreur inchangée)
      console.error("Tentativo di salvare senza codice d'ombrello:", formData);
      alert("Errore: Codice ombrello mancante.");
      setIsSaving(false);
      return;
    }

    // --- Vérification de Conflit ---
    // Chercher les réservations existantes pour la même cellule qui chevauchent les dates
    const conflictingReservations = allReservations.filter(
      (res) =>
        res.cellCode === cellCode &&
        res.id !== dataToSave.id && // Exclure la réservation en cours de modification
        // Logique de chevauchement de dates simple (peut être affinée)
        dataToSave.startDate <= res.endDate &&
        dataToSave.endDate >= res.startDate
    );

    let conflictFound = false;
    for (const existingRes of conflictingReservations) {
      // Vérifier chaque jour dans la plage de la nouvelle réservation
      let currentDate = new Date(dataToSave.startDate + "T00:00:00"); // Assurer la comparaison correcte
      const endDate = new Date(dataToSave.endDate + "T00:00:00");

      while (currentDate <= endDate) {
        const currentDateStr = currentDate.toISOString().split("T")[0];

        // Vérifier si ce jour est dans la plage de la réservation existante
        if (
          currentDateStr >= existingRes.startDate &&
          currentDateStr <= existingRes.endDate
        ) {
          // Conflit si :
          // 1. L'une est 'jour entier'
          // 2. Les deux sont 'matin'
          // 3. Les deux sont 'apres-midi'
          if (
            dataToSave.condition === "jour entier" ||
            existingRes.condition === "jour entier"
          ) {
            conflictFound = true;
            break;
          }
          // Conflit uniquement si la date est la même ET les conditions sont incompatibles
          if (
            dataToSave.startDate === dataToSave.endDate &&
            existingRes.startDate === existingRes.endDate &&
            dataToSave.startDate === existingRes.startDate
          ) {
            if (dataToSave.condition === existingRes.condition) {
              conflictFound = true;
              break;
            }
          } else if (
            dataToSave.startDate !== dataToSave.endDate ||
            existingRes.startDate !== existingRes.endDate
          ) {
            // Si l'une des réservations couvre plusieurs jours, elle est considérée comme "jour entier" pour la détection de conflit
            // avec une réservation matin/aprem sur un des jours inclus.
            conflictFound = true;
            break;
          }
        }
        // Passer au jour suivant
        currentDate.setDate(currentDate.getDate() + 1);
      }
      if (conflictFound) break;
    }

    if (conflictFound) {
      alert(
        "Conflitto ! Una prenotazione esiste già per questo ombrello per la stass data e la stessa condizione"
      );
      setIsSaving(false);
      return;
    }
    // --- Fin Vérification de Conflit ---

    try {
      let finalData = { ...dataToSave, cellCode };

      if (!finalData.id) {
        // Nouvelle réservation
        let serialNumber;
        try {
          serialNumber = await getNextSerialNumber();
        } catch (serialError) {
          alert(`Errore durante il salvataggio: ${serialError.message}`);
          setIsSaving(false);
          return;
        }
        finalData = { ...finalData, serialNumber };
        const docRef = await addDoc(reservationsCollectionRef, finalData);
        console.log("Nuova prenotazione creata con ID: ", docRef.id);
        // --- MODIFICATION: Mettre à jour le tableau ---
        setAllReservations((prev) => [
          ...prev,
          { id: docRef.id, ...finalData },
        ]);
      } else {
        // Mise à jour
        const reservationId = finalData.id;
        const docRef = doc(db, "reservations", reservationId);
        const { id, ...updateData } = finalData;
        await setDoc(docRef, updateData, { merge: true });
        console.log("Prenotazione aggiornato ID: ", reservationId);
        // --- MODIFICATION: Mettre à jour le tableau ---
        setAllReservations((prev) =>
          prev.map((res) =>
            res.id === reservationId ? { ...res, ...updateData } : res
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
  };

  // --- MODIFICATION: handleDeleteReservation met à jour le tableau ---
  const handleDeleteReservation = async (reservationId) => {
    if (!reservationId) {
      alert("Errore : ID di prenotazione mancante per la soppressione.");
      return;
    }
    setIsSaving(true);
    try {
      const docRef = doc(db, "reservations", reservationId);
      await deleteDoc(docRef);
      console.log("Réservation supprimée ID: ", reservationId);
      // --- MODIFICATION: Mettre à jour le tableau ---
      setAllReservations((prev) =>
        prev.filter((res) => res.id !== reservationId)
      );
      handleCloseModal();
    } catch (error) {
      console.error("Erreore durante la soppressione:", error);
      alert(`Errore durante la soppressione: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  // --- NOUVEAU: Fonctions pour ouvrir/fermer la liste ---
  const handleOpenList = () => {
    setShowReservationList(true);
  };

  const handleCloseList = () => {
    setShowReservationList(false);
  };
  // --- FIN NOUVEAU ---

  if (isLoading) {
    return <div>Charicamento Beach Plan...</div>;
  }

  return (
    <>
      <div className={styles.controlsHeader}>
        {" "}
        {/* Optional: Wrapper for controls */}
        {/* Sélecteur de date */}
        <div className={styles.dateSelector}>
          <label htmlFor="planDate">BEACH PLAN per il giorno : </label>
          <input
            type="date"
            id="planDate"
            value={selectedDate}
            onChange={handleDateChange}
            min={getTodayString()}
          />
        </div>
        {/* --- NOUVEAU: Bouton pour afficher la liste --- */}
        <button onClick={handleOpenList} className={styles.viewListButton}>
          Visualizza/Stampa Lista
        </button>
        {/* --- FIN NOUVEAU --- */}
      </div>

      {/* Plan de plage */}
      <div className={styles["beach-plan"]}>
        {/* ... (mapping rows/columns inchangé) ... */}
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            {columns.map((col) => {
              const code = `${row}${col}`;
              // --- MODIFICATION: Logique d'affichage basée sur la date sélectionnée ---
              const reservationsForCellOnDate = allReservations.filter(
                (res) =>
                  res.cellCode === code &&
                  selectedDate >= res.startDate &&
                  selectedDate <= res.endDate
              );

              let cellClasses = [styles.cell];
              const hasFullDay = reservationsForCellOnDate.some(
                (res) => res.condition === "jour entier"
              );
              // Vérifier spécifiquement pour la date sélectionnée si c'est une résa d'un jour
              const hasMorning = reservationsForCellOnDate.some(
                (res) =>
                  res.condition === "matin" &&
                  res.startDate === selectedDate &&
                  res.endDate === selectedDate
              );
              const hasAfternoon = reservationsForCellOnDate.some(
                (res) =>
                  res.condition === "apres-midi" &&
                  res.startDate === selectedDate &&
                  res.endDate === selectedDate
              );

              if (hasFullDay || (hasMorning && hasAfternoon)) {
                cellClasses.push(styles.bookedFullDay); // Rouge
              } else if (hasMorning) {
                cellClasses.push(styles.bookedMorning); // Bleue
              } else if (hasAfternoon) {
                cellClasses.push(styles.bookedAfternoon); // Orange
              }
              // --- FIN MODIFICATION ---

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

      {/* Modal de réservation */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cellCode={selectedCellCode}
        reservationData={currentReservationData}
        onSave={handleSaveReservation}
        onDelete={handleDeleteReservation}
        isSaving={isSaving}
        selectedDateForNew={isCreatingComplementary ? null : selectedDate}
      />

      {/* --- NOUVEAU: Affichage conditionnel de la liste --- */}
      {showReservationList && (
        <ReservationList
          reservations={allReservations}
          selectedDate={selectedDate}
          onClose={handleCloseList}
        />
      )}
      {/* --- FIN NOUVEAU --- */}
    </>
  );
}
