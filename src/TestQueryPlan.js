import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  doc, // Ajout de doc
  getDocs,
  query,
  addDoc,
  runTransaction, // Ajout de runTransaction
  serverTimestamp, // Ajout de serverTimestamp
  setDoc, // Ajout de setDoc
} from "firebase/firestore";
import { db } from "./firebase"; // Assurez-vous que le chemin est correct
import "./Global.css";
import styles from "./TestQueryPlan.module.css";
import ReservationModal from "./pages/BeachPlanFile/ReservationModal"; // Chemin confirmé
import { getNextSerialNumber } from "./utils/bookingUtils/reservationUtils"; // Ajuste le chemin si nécessaire

// --- Fonctions Utilitaires (similaires à BeachPlan) ---
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Fonction addDays (nécessaire pour le split)
const addDays = (dateStr, days) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr); // Utilisation directe du constructeur Date
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
const allCellCodes = rows.flatMap((row) =>
  columns.map((col) => `${row}${col}`)
);

const TestQueryPlan = () => {
  // --- États ---
  const [allReservations, setAllReservations] = useState([]);
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [selectedCondition, setSelectedCondition] = useState("booked_full"); // Valeur par défaut
  const [filteredCells, setFilteredCells] = useState([]); // Cellules qui correspondent
  const [isLoading, setIsLoading] = useState(true); // Chargement initial des données
  const [isSearching, setIsSearching] = useState(false); // Chargement de la recherche manuelle
  const [searchPerformed, setSearchPerformed] = useState(false); // Recherche lancée au moins une fois?
  const [conditionUsedForLastSearch, setConditionUsedForLastSearch] =
    useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCellForModal, setSelectedCellForModal] = useState(null);
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalEndDate, setModalEndDate] = useState("");
  const [reservationToEdit, setReservationToEdit] = useState(null); // Pour passer la résa au modal

  // --- Chargement initial des données ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "reservations"));
      const querySnapshot = await getDocs(q);
      const fetchedReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Assurer que les champs critiques existent
        startDate: doc.data().startDate || "",
        endDate: doc.data().endDate || "",
        condition: doc.data().condition || "jour entier", // Default si manquant
        cellCode: doc.data().cellCode || "",
        serialNumber: doc.data().serialNumber || null, // Assurer que serialNumber existe
        cabina: doc.data().cabina !== undefined ? doc.data().cabina : null, // Assurer que cabina existe (peut être null)
      }));
      setAllReservations(fetchedReservations);
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      alert("Erreur lors du chargement des réservations.");
      setAllReservations([]);
    } finally {
      setIsLoading(false); // Fin du chargement initial
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- Calcul optimisé de la map des réservations ---
  const reservationsMap = useMemo(() => {
    console.log("Recalculating reservationsMap..."); // Pour débugger la fréquence
    const map = new Map();
    allReservations.forEach((res) => {
      if (!res.cellCode || !res.startDate || !res.endDate) return;
      let loopDate = new Date(res.startDate);
      const stopDate = new Date(res.endDate);
      while (loopDate <= stopDate) {
        const dateStr = loopDate.toISOString().split("T")[0];
        const key = `${res.cellCode}_${dateStr}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        // Stocker la condition ET un identifiant unique (ex: serialNumber ou id)
        map.get(key).push({
          condition: res.condition,
          bookingId: res.serialNumber || res.id,
        });
        loopDate.setDate(loopDate.getDate() + 1);
      }
    });
    return map;
  }, [allReservations]); // Recalculer seulement si allReservations change

  // --- Logique de Filtrage (déclenchée par le bouton) ---
  const handleSearch = useCallback(() => {
    if (!startDate || !endDate || startDate > endDate) {
      alert("Seleziona un periodo valido prima di cercare.");
      setFilteredCells([]);
      setSearchPerformed(true); // Marquer qu'une tentative de recherche a eu lieu (même si invalide)
      return;
    }
    setIsSearching(true); // Début de la recherche
    setSearchPerformed(true); // Marquer qu'une recherche valide a été lancée

    const results = [];
    // Utiliser la map mémoïsée

    allCellCodes.forEach((cellCode) => {
      let match = true;
      let currentDay = new Date(startDate);
      const lastDay = new Date(endDate);

      while (currentDay <= lastDay) {
        const dayStr = currentDay.toISOString().split("T")[0];
        const key = `${cellCode}_${dayStr}`;
        const conditionsForTheDay = reservationsMap.get(key) || []; // Conditions pour cette cellule ce jour là

        // Vérifier l'existence des conditions
        const hasFullDay = conditionsForTheDay.some(
          (c) => c.condition === "jour entier"
        );
        const hasMorning = conditionsForTheDay.some(
          (c) => c.condition === "matin"
        );
        const hasAfternoon = conditionsForTheDay.some(
          (c) => c.condition === "apres-midi"
        );

        let dayMatchesCondition = false;
        switch (selectedCondition) {
          case "booked_full":
            // Inclut aussi le cas matin + aprem par différents clients
            dayMatchesCondition = hasFullDay || (hasMorning && hasAfternoon);
            break;
          case "booked_morning":
            dayMatchesCondition = hasMorning && !hasFullDay && !hasAfternoon; // Exclure aussi l'après-midi
            break;
          case "booked_afternoon":
            dayMatchesCondition = hasAfternoon && !hasFullDay && !hasMorning; // Exclure aussi le matin
            break;
          case "free_full":
            dayMatchesCondition = !hasFullDay && !hasMorning && !hasAfternoon;
            break;
          case "free_only_morning": // Libre SEULEMENT le matin = Après-midi réservé
            dayMatchesCondition = !hasFullDay && !hasMorning && hasAfternoon;
            break;
          case "free_only_afternoon": // Libre SEULEMENT l'après-midi = Matin réservé
            dayMatchesCondition = !hasFullDay && !hasAfternoon && hasMorning;
            break;
          default:
            dayMatchesCondition = false;
        }

        if (!dayMatchesCondition) {
          match = false;
          break; // Inutile de vérifier les autres jours pour cette cellule
        }
        currentDay.setDate(currentDay.getDate() + 1); // Passer au jour suivant
      } // Fin boucle while jours

      if (match) {
        results.push(cellCode);
      }
    }); // Fin boucle forEach cellCodes

    console.log(
      `Ricerca completata, ${results.length} ombrelloni corrispondono.`
    );
    setFilteredCells(results);
    setConditionUsedForLastSearch(selectedCondition); // Mémoriser la condition utilisée pour cette recherche
    setIsSearching(false); // Fin de la recherche
  }, [reservationsMap, startDate, endDate, selectedCondition]); // Ajouter reservationsMap aux dépendances

  // --- Gestion du Modal ---
  const handleCellClick = (cellCode) => {
    // Vérifier si la cellule fait partie des résultats affichés
    if (!filteredCells.includes(cellCode)) {
      console.log(`Clic sur ${cellCode} ignoré (non filtré)`);
      return; // Ne rien faire si la cellule est grisée
    }

    const isFreeCondition =
      conditionUsedForLastSearch === "free_full" ||
      conditionUsedForLastSearch === "free_only_morning" ||
      conditionUsedForLastSearch === "free_only_afternoon";

    // CAS 1: Clic sur une cellule affichée comme LIBRE (pour créer)
    if (isFreeCondition) {
      setSelectedCellForModal(cellCode);
      setReservationToEdit(null); // Pas de réservation à éditer
      // Pré-remplir les dates du modal avec celles de la recherche
      setModalStartDate(startDate);
      setModalEndDate(endDate);
      setIsModalOpen(true);
      console.log(`Ouverture modal pour NOUVELLE réservation sur ${cellCode}`);

      // CAS 2: Clic sur une cellule affichée comme RÉSERVÉE (pour voir/modifier)
    } else {
      // Trouver la/les réservation(s) pour cette cellule à la date de début de la période
      const key = `${cellCode}_${startDate}`;
      const bookingsOnStartDate = reservationsMap.get(key) || [];

      if (bookingsOnStartDate.length > 0) {
        // Prendre la première réservation trouvée pour cette date comme référence
        const firstBookingInfo = bookingsOnStartDate[0];
        const fullReservationData = allReservations.find(
          (res) => (res.serialNumber || res.id) === firstBookingInfo.bookingId
        );

        if (fullReservationData) {
          setSelectedCellForModal(cellCode);
          setReservationToEdit(fullReservationData); // Passer la réservation trouvée
          setModalStartDate(startDate); // On peut aussi passer les dates de la résa trouvée si pertinent
          setModalEndDate(endDate);
          setIsModalOpen(true);
          console.log(
            `Ouverture modal pour VOIR/MODIFIER réservation sur ${cellCode} (ID: ${fullReservationData.id})`
          );
        } else {
          console.warn(
            `Réservation avec ID ${firstBookingInfo.bookingId} non trouvée dans allReservations.`
          );
        }
      } else {
        console.log(
          `Aucune réservation trouvée pour ${cellCode} le ${startDate} malgré le filtre.`
        );
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellForModal(null);
    setModalStartDate("");
    setModalEndDate("");
    setReservationToEdit(null); // Réinitialiser la réservation à éditer
  };

  // --- LOGIQUE DE SAUVEGARDE (handleSaveReservation) ---
  const handleSaveReservation = async (reservationData) => {
    const currentCellCode = selectedCellForModal || reservationData.cellCode; // Utiliser cellCode du modal si MAJ
    if (!currentCellCode) return;

    setIsLoading(true); // Utiliser isLoading ou isSaving pour la sauvegarde

    const {
      // cellCode, // On utilise currentCellCode défini ci-dessus
      modifySingleDay,
      targetDate,
      targetDateCondition,
      id: reservationId, // ID de la réservation à modifier/splitter
      serialNumber: existingSerialNumber, // SN existant si modification
      ...dataToSave // Le reste des données du formulaire
    } = reservationData;

    try {
      // --- CAS 1: Modification d'un seul jour (SPLIT) ---
      if (
        modifySingleDay &&
        targetDate &&
        targetDateCondition &&
        reservationId
      ) {
        console.log(
          `Tentativo di split per ${currentCellCode} il ${targetDate}`
        );
        let targetDaySerialNumber = null;
        let afterSerialNumber = null;

        // Pré-générer les numéros de série nécessaires
        targetDaySerialNumber = await getNextSerialNumber();
        const originalResCheck = allReservations.find(
          (res) => res.id === reservationId
        );
        if (originalResCheck && originalResCheck.endDate > targetDate) {
          afterSerialNumber = await getNextSerialNumber(); // SN pour la partie "après"
        }

        const newReservationsForState = [];
        const updatesToOriginalForState = { deleted: false, endDate: null };

        await runTransaction(db, async (transaction) => {
          const originalDocRef = doc(db, "reservations", reservationId);
          const originalDoc = await transaction.get(originalDocRef);
          if (!originalDoc.exists())
            throw new Error("Prenotazione originale non trovata per lo split.");
          const originalData = originalDoc.data();

          // --- Vérification Conflit pour le jour cible (simplifiée, à affiner) ---
          // Il faudrait vérifier si targetDateCondition entre en conflit avec une autre résa ce jour-là

          // 1. Créer résa jour cible
          const targetDayData = {
            ...originalData, // Base de l'originale
            ...dataToSave, // Données modifiées (nom, lits, etc.)
            startDate: targetDate,
            endDate: targetDate,
            condition: targetDateCondition,
            serialNumber: targetDaySerialNumber,
            cellCode: currentCellCode, // Assurer le bon cellCode
            createdAt: originalData.createdAt || serverTimestamp(),
            status: "active", // Ajout du statut pour le jour cible du split
            modifiedAt: serverTimestamp(),
          };
          delete targetDayData.id; // Ne pas copier l'ID original
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
            // Si targetDate est le premier jour, l'originale sera supprimée ou deviendra la partie "après"
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
              ...originalData, // Base de l'originale
              startDate: newStartDate,
              endDate: originalData.endDate, // Garde la date de fin originale
              serialNumber: afterSerialNumber,
              cellCode: currentCellCode, // Assurer le bon cellCode
              createdAt: originalData.createdAt || serverTimestamp(),
              status: "active", // Ajout du statut pour la période aprés le  split
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

            // Si la période "avant" n'existait pas, il faut supprimer l'originale car elle est remplacée par "après"
            if (originalData.startDate >= targetDate) {
              transaction.delete(originalDocRef);
              updatesToOriginalForState.deleted = true;
              console.log(
                "Split: Prenotazione originale eliminata (remplacée par 'après').",
                originalData.serialNumber
              );
            }
          } else {
            // Si targetDate est le dernier jour, et qu'il y avait une période avant, l'originale est juste modifiée (endDate)
            // Si targetDate est le seul jour, l'originale est supprimée (géré ci-dessous)
            console.log("Split: Giorno target è endDate originale.");
          }

          // 4. Supprimer l'originale si elle n'a plus de période valide (cas où targetDate était le seul jour)
          if (
            originalData.startDate === targetDate &&
            originalData.endDate === targetDate
          ) {
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true;
            console.log(
              "Split: Prenotazione originale eliminata (jour unique remplacé).",
              originalData.serialNumber
            );
          } else if (
            originalData.startDate > targetDate ||
            originalData.endDate < targetDate
          ) {
            // Cas où l'originale devient invalide après MAJ/création (ne devrait pas arriver avec la logique ci-dessus mais sécurité)
            if (!updatesToOriginalForState.deleted) {
              // Ne pas essayer de supprimer 2x
              transaction.delete(originalDocRef);
              updatesToOriginalForState.deleted = true;
              console.log(
                "Split: Prenotazione originale eliminata (devenue invalide).",
                originalData.serialNumber
              );
            }
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
              createdAt: new Date(),
              modifiedAt: new Date(),
            })), // Simplifié pour l'état local
          ];
          return newState;
        });
        console.log("Split completato con successo.");

        // --- CAS 2: Sauvegarde Normale (Nouvelle ou Mise à jour globale) ---
      } else {
        console.log(`Tentativo di salvataggio normale per ${currentCellCode}`);
        // --- Vérification Conflit Globale (Ombrellone + Cabine) ---
        let conflictFound = false;
        let conflictMessage = "";

        if (
          dataToSave.startDate &&
          dataToSave.endDate &&
          dataToSave.startDate <= dataToSave.endDate
        ) {
          const currentStart = dataToSave.startDate;
          const currentEnd = dataToSave.endDate;
          const currentCondition = dataToSave.condition;
          const currentCabin = dataToSave.cabina; // Peut être null

          const potentialConflicts = allReservations.filter(
            (res) =>
              res.id !== reservationId && // Exclure soi-même si update
              res.startDate &&
              res.endDate &&
              currentStart <= res.endDate &&
              currentEnd >= res.startDate && // Overlap dates
              (res.cellCode === currentCellCode ||
                (currentCabin && res.cabina && currentCabin === res.cabina)) // Même ombrellone OU même cabine
          );

          for (const existingRes of potentialConflicts) {
            // Conflit Ombrellone
            console.log(
              `Vérification conflit: Courant (${currentCondition}) vs Existant (${existingRes.condition}) pour ${currentCellCode}`
            ); // Log conflit
            if (existingRes.cellCode === currentCellCode) {
              const existingCondition = existingRes.condition;
              // Vérification plus explicite, similaire à BeachPlan et ReservationModal
              if (
                currentCondition === "jour entier" ||
                existingCondition === "jour entier" ||
                (currentCondition === "matin" &&
                  existingCondition === "matin") ||
                (currentCondition === "apres-midi" &&
                  existingCondition === "apres-midi")
              ) {
                console.log("--> Conflit Ombrellone DETECTE!"); // Log détection
                conflictFound = true;
                conflictMessage = `Conflitto Ombrellone ${currentCellCode} rilevato (${
                  existingRes.condition
                }) con N° ${existingRes.serialNumber || existingRes.id} (${
                  existingRes.startDate
                } - ${existingRes.endDate}).`; // Message plus détaillé
                break;
              }
            }
            // Conflit Cabine
            if (
              currentCabin &&
              existingRes.cabina &&
              currentCabin === existingRes.cabina
            ) {
              console.log("--> Conflit Cabine DETECTE!"); // Log détection
              conflictFound = true;
              conflictMessage = `Conflitto Cabina ${currentCabin} rilevato con N° ${
                existingRes.serialNumber || existingRes.id
              } (${existingRes.startDate} - ${existingRes.endDate}).`; // Message plus détaillé
              break;
            }
          }
        } else if (dataToSave.startDate > dataToSave.endDate) {
          conflictFound = true;
          conflictMessage =
            "La data di fine non può essere anteriore alla data di inizio.";
        }

        if (conflictFound) {
          console.log("Conflit trouvé, affichage alerte:", conflictMessage); // Log avant alerte
          alert(conflictMessage);
          setIsLoading(false);
          return;
        }
        // --- Fin Vérification Conflit Globale ---

        // --- Logique de sauvegarde Add/Set ---
        let finalData = {
          ...dataToSave,
          cellCode: currentCellCode, // Assurer le bon cellCode
          modifiedAt: serverTimestamp(),
        };

        if (!reservationId) {
          // --- NOUVELLE réservation ---
          const newSerialNumber = await getNextSerialNumber();
          finalData = {
            ...finalData,
            serialNumber: newSerialNumber,
            createdAt: serverTimestamp(),
            status: "active",
          };
          const docRef = await addDoc(
            collection(db, "reservations"),
            finalData
          );
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
          if (
            !finalData.createdAt // Ajouter createdAt si manquant (vieilles données?)
          ) {
            finalData.createdAt = serverTimestamp();
          }
          await setDoc(docRef, finalData, { merge: true }); // Utiliser set avec merge pour MAJ ou recréer si supprimé
          console.log("Prenotazione aggiornata:", reservationId);
          setAllReservations((prev) =>
            prev.map((res) =>
              res.id === reservationId
                ? { ...res, ...finalData, modifiedAt: new Date() }
                : res
            )
          );
        }
      } // --- Fin CAS 1 / CAS 2 ---

      alert("Prenotazione salvata con successo!");
      handleCloseModal();
      await fetchReservations(); // Recharger toutes les réservations
      handleSearch(); // Relancer la recherche pour MAJ l'affichage
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la réservation:", error);
      alert(`Errore durante il salvataggio: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }; // --- Fin handleSaveReservation ---

  // --- Fonction pour vérifier si une cellule est réservée matin/aprem par différents clients sur TOUTE la période ---
  const checkIfSplitBookingForPeriod = (cellCode, start, end, map) => {
    let currentDay = new Date(start);
    const lastDay = new Date(end);

    // Si la période est invalide, retourner false
    if (currentDay > lastDay) return false;

    while (currentDay <= lastDay) {
      const dayStr = currentDay.toISOString().split("T")[0];
      const key = `${cellCode}_${dayStr}`;
      const bookingsForTheDay = map.get(key) || [];

      const morningRes = bookingsForTheDay.find((b) => b.condition === "matin");
      const afternoonRes = bookingsForTheDay.find(
        (b) => b.condition === "apres-midi"
      );
      const fullDayRes = bookingsForTheDay.find(
        (b) => b.condition === "jour entier"
      );

      // Condition pour être un "split booking" CE JOUR-LÀ:
      const isSplitToday =
        morningRes &&
        afternoonRes &&
        !fullDayRes &&
        morningRes.bookingId !== afternoonRes.bookingId;

      if (!isSplitToday) {
        return false; // Condition non remplie pour ce jour
      }

      currentDay.setDate(currentDay.getDate() + 1);
    }
    // Si on a passé tous les jours sans retourner false
    return true;
  };

  // --- Rendu du Plan Filtré ---
  const renderFilteredPlan = () => {
    // Afficher chargement initial des données
    if (isLoading && !searchPerformed)
      return <div className={styles.loadingIndicator}>Caricamento dati...</div>;
    // Afficher chargement pendant la recherche manuelle
    if (isSearching)
      return <div className={styles.loadingIndicator}>Ricerca in corso...</div>;

    // Si une recherche a été faite mais sans résultat
    if (searchPerformed && filteredCells.length === 0)
      return (
        <div className={styles.noResults}>
          Nessun ombrellone corrisponde ai criteri per l'intero periodo.
        </div>
      );

    // Si aucune recherche n'a encore été faite
    if (!searchPerformed)
      return (
        <div className={styles.noResults}>
          Seleziona i criteri e clicca 'Cerca'.
        </div>
      );

    // Si la recherche a été faite et a des résultats
    return (
      <div className={styles.beach_plan}>
        {rows.map((row) => (
          <React.Fragment key={row}>
            {columns.map((col) => {
              const cellCode = `${row}${col}`;
              const isCellFiltered = filteredCells.includes(cellCode);

              let morningClass = styles.colorEmpty;
              let afternoonClass = styles.colorEmpty;

              if (isCellFiltered) {
                // Vérification spéciale pour le cas matin/aprem par différents clients
                const isSplitBooking = checkIfSplitBookingForPeriod(
                  cellCode,
                  startDate,
                  endDate,
                  reservationsMap // Passer la map mémoïsée
                );

                if (isSplitBooking) {
                  // Appliquer les couleurs spécifiques bleu/orange
                  morningClass = styles.colorMatin;
                  afternoonClass = styles.colorApresMidi;
                } else {
                  // Sinon, appliquer la couleur basée sur le filtre utilisé
                  switch (conditionUsedForLastSearch) {
                    case "booked_full": // Cas normal jour entier (ou matin+aprem même client)
                      morningClass = afternoonClass = styles.colorJourEntier;
                      break;
                    case "booked_morning":
                      morningClass = styles.colorMatin;
                      afternoonClass = styles.colorEmpty;
                      break;
                    case "booked_afternoon":
                      morningClass = styles.colorEmpty;
                      afternoonClass = styles.colorApresMidi;
                      break;
                    case "free_full":
                      morningClass = afternoonClass = styles.colorEmpty;
                      break;
                    case "free_only_morning":
                      morningClass = styles.colorEmpty;
                      afternoonClass = styles.colorApresMidi;
                      break;
                    case "free_only_afternoon":
                      morningClass = styles.colorMatin;
                      afternoonClass = styles.colorEmpty;
                      break;
                    default:
                      morningClass = afternoonClass = styles.colorEmpty;
                  }
                }
              }

              // Rendre TOUTES les cellules filtrées cliquables
              const isClickableForModal = isCellFiltered;

              return (
                <div
                  key={cellCode}
                  className={`${styles.cell} ${
                    !isCellFiltered ? styles.filteredOut : ""
                  } ${isClickableForModal ? styles.clickable : ""}`} // Appliquer .clickable si filtré
                  title={
                    isCellFiltered
                      ? `Ombrellone ${cellCode} - Corrisponde (Clicca per dettagli/modifica)`
                      : `Ombrellone ${cellCode} - Non corrisponde`
                  }
                  onClick={() => handleCellClick(cellCode)} // Toujours appeler handleCellClick si filtré
                >
                  <div className={`${styles.cellHalf} ${morningClass}`}>
                    {cellCode}
                  </div>
                  <div className={`${styles.cellHalf} ${afternoonClass}`}></div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className={styles.TestQueryPlanPage}>
        <div className={styles.Titre}>
          <h1>Test Query Plan</h1>
        </div>

        {/* Contrôles de Période et Condition */}
        <div className={styles.controlsHeader}>
          <div className={styles.dateSelector}>
            <label htmlFor="startDate">Dal:</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <label htmlFor="endDate">Al:</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className={styles.conditionSelector}>
            <label htmlFor="condition">Mostra Ombrelloni:</label>
            <select
              id="condition"
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
            >
              <optgroup label="Prenotati">
                <option value="booked_full">Prenotati Giorni Interi</option>
                <option value="booked_morning">Prenotati Solo Mattina</option>
                <option value="booked_afternoon">
                  Prenotati Solo Pomeriggio
                </option>
              </optgroup>
              <optgroup label="Liberi">
                <option value="free_full">Liberi Giorni Interi</option>
                <option value="free_only_morning">
                  Liberi Solo Mattina (Pomeriggio occupato)
                </option>
                <option value="free_only_afternoon">
                  Liberi Solo Pomeriggio (Mattina occupato)
                </option>
              </optgroup>
            </select>
          </div>
          {/* --- Bouton Cerca --- */}
          <button
            onClick={handleSearch}
            disabled={isSearching || isLoading} // Désactivé pendant chargement initial ou recherche
            className={styles.searchButton}
          >
            {isSearching ? "Ricerca..." : "Cerca"}
          </button>
        </div>

        {/* Affichage du Plan Filtré */}
        {renderFilteredPlan()}

        {/* Modal de Réservation */}
        {isModalOpen && selectedCellForModal && (
          <ReservationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSave={handleSaveReservation}
            cellCode={selectedCellForModal}
            defaultStartDate={modalStartDate}
            defaultEndDate={modalEndDate}
            allReservations={allReservations} // <-- Passer allReservations
            selectedDate={startDate} // <-- Passer la date de début comme référence pour le split
            reservationToEdit={reservationToEdit} // <-- Passer la réservation à éditer/voir
            // onDelete n'est pas géré dans ce contexte, mais pourrait l'être si nécessaire
          />
        )}
      </div>
    </div>
  );
};

export default TestQueryPlan;
