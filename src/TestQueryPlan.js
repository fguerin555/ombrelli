// /Users/fredericguerin/Desktop/ombrelli/src/TestQueryPlan.js
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
  const [selectedCellForModal, setSelectedCellForModal] = useState(null); // Gardé pour la prop cellCode du modal
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
      // Correction de la syntaxe ici
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

    if (isFreeCondition) {
      // CAS 1: Clic sur une cellule affichée comme LIBRE (pour créer)
      let newCondition = "jour entier";
      if (conditionUsedForLastSearch === "free_only_morning") {
        newCondition = "matin";
      } else if (conditionUsedForLastSearch === "free_only_afternoon") {
        newCondition = "apres-midi";
      }

      const newReservationPayload = {
        nom: "",
        prenom: "",
        startDate: startDate, // Date de début de la période de recherche
        endDate: endDate, // Date de fin de la période de recherche
        condition: newCondition,
        numBeds: 2,
        registiPoltrona: "",
        serialNumber: null,
        id: null, // Indique une nouvelle réservation
        cabina: null,
        // cellCode n'est pas nécessaire ici, il sera passé comme prop au modal
      };
      setSelectedCellForModal(cellCode);
      setReservationToEdit(newReservationPayload);
      setIsModalOpen(true);
      console.log(`Ouverture modal pour NOUVELLE réservation sur ${cellCode}`);

      // CAS 2: Clic sur une cellule affichée comme RÉSERVÉE (pour voir/modifier)
    } else {
      // Analyser les réservations pour cellCode au startDate de la recherche
      // pour simuler le comportement de BeachPlan.js pour un jour donné.
      // Le `startDate` de la recherche agit ici comme le `selectedDate` de BeachPlan.js.
      const reservationsForCellOnRefDate = allReservations.filter(
        (res) =>
          res.cellCode === cellCode &&
          res.startDate && // Assurer que startDate existe
          res.endDate && // Assurer que endDate existe
          startDate >= res.startDate && // Utiliser le startDate de la recherche comme date de référence
          startDate <= res.endDate
      );

      const fullDayRes = reservationsForCellOnRefDate.find(
        (res) => res.condition === "jour entier"
      );
      const morningResOnly = reservationsForCellOnRefDate.find(
        (res) => res.condition === "matin"
      );
      const afternoonResOnly = reservationsForCellOnRefDate.find(
        (res) => res.condition === "apres-midi"
      );

      let dataForModalOnClick = null;

      if (fullDayRes) {
        dataForModalOnClick = { ...fullDayRes };
      } else if (morningResOnly && afternoonResOnly) {
        // Important: vérifier si ce sont des réservations différentes (par ID)
        if (morningResOnly.id !== afternoonResOnly.id) {
          dataForModalOnClick = {
            morning: { ...morningResOnly },
            afternoon: { ...afternoonResOnly },
            type: "dual", // C'est la structure attendue par ReservationModal
          };
        } else {
          // Cas improbable où matin et après-midi sont la même résa mais pas "jour entier"
          // On prend l'une ou l'autre.
          dataForModalOnClick = { ...morningResOnly };
        }
      } else if (morningResOnly) {
        dataForModalOnClick = { ...morningResOnly };
      } else if (afternoonResOnly) {
        dataForModalOnClick = { ...afternoonResOnly };
      } else {
        console.log(
          `Aucune réservation spécifique (jour entier, matin, ou après-midi) trouvée pour ${cellCode} le ${startDate} pour construire dataForModalOnClick.`
        );
        // Si aucun des cas ci-dessus n'est trouvé, cela signifie qu'il n'y a pas de réservation claire
        // pour cette cellule à cette date de référence pour un affichage simple ou dual.
        // On pourrait choisir de ne pas ouvrir le modal ou d'ouvrir un modal "nouvelle réservation"
        // mais comme on est dans le 'else' de 'isFreeCondition', on s'attend à une réservation.
        // Il est possible que le filtre de TestQueryPlan montre la cellule comme réservée sur la période,
        // mais qu'au `startDate` spécifique, il n'y ait pas de résa simple/dual claire.
        // Pour l'instant, on ne fait rien si dataForModalOnClick reste null.
      }

      if (dataForModalOnClick) {
        setSelectedCellForModal(cellCode);
        setReservationToEdit(dataForModalOnClick); // C'est cette donnée qui sera passée au modal
        setIsModalOpen(true);
        console.log(
          `Ouverture modal pour ${cellCode} avec données:`,
          dataForModalOnClick
        );
      } else {
        console.log(
          `Aucune donnée de réservation pertinente à afficher dans le modal pour ${cellCode} le ${startDate}.`
        );
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellForModal(null);
    setReservationToEdit(null); // Réinitialiser la réservation à éditer
  };

  // --- LOGIQUE DE SAUVEGARDE (handleSaveReservation) ---
  const handleSaveReservation = async (reservationDataFromModal) => {
    const currentCellCode =
      selectedCellForModal || reservationDataFromModal.cellCode;
    if (!currentCellCode) {
      console.error(
        "Erreur: currentCellCode est indéfini dans handleSaveReservation."
      );
      alert("Erreur interne: Code cellule manquant.");
      return;
    }

    setIsLoading(true); // Utiliser isLoading ou isSearching pour la sauvegarde

    const {
      modifySingleDay,
      targetDate,
      targetDateCondition,
      id: reservationId,
      serialNumber: existingSerialNumber,
      ...dataToSave
    } = reservationDataFromModal;

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

          const targetDayData = {
            ...originalData,
            ...dataToSave,
            startDate: targetDate,
            endDate: targetDate,
            condition: targetDateCondition,
            serialNumber: targetDaySerialNumber,
            cellCode: currentCellCode,
            createdAt: originalData.createdAt || serverTimestamp(),
            status: "active",
            modifiedAt: serverTimestamp(),
          };
          delete targetDayData.id;
          const targetDayDocRef = doc(collection(db, "reservations"));
          transaction.set(targetDayDocRef, targetDayData);
          newReservationsForState.push({
            id: targetDayDocRef.id,
            ...targetDayData,
          });

          if (originalData.startDate < targetDate) {
            const newEndDate = addDays(targetDate, -1);
            if (!newEndDate)
              throw new Error("Errore calcolo data fine periodo 'avant'.");
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginalForState.endDate = newEndDate;
          }

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
              cellCode: currentCellCode,
              createdAt: originalData.createdAt || serverTimestamp(),
              status: "active",
              modifiedAt: serverTimestamp(),
            };
            delete afterData.id;
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservationsForState.push({ id: afterDocRef.id, ...afterData });

            if (originalData.startDate >= targetDate) {
              transaction.delete(originalDocRef);
              updatesToOriginalForState.deleted = true;
            }
          }

          if (
            originalData.startDate === targetDate &&
            originalData.endDate === targetDate
          ) {
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true;
          } else if (
            originalData.startDate > targetDate ||
            originalData.endDate < targetDate
          ) {
            if (!updatesToOriginalForState.deleted) {
              transaction.delete(originalDocRef);
              updatesToOriginalForState.deleted = true;
            }
          }
        });

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
            })),
          ];
          return newState;
        });
        console.log("Split completato con successo.");
      } else {
        // --- CAS 2: Sauvegarde Normale ---
        console.log(`Tentativo di salvataggio normale per ${currentCellCode}`);
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
          const currentCabin = dataToSave.cabina;

          const potentialConflicts = allReservations.filter(
            (res) =>
              res.id !== reservationId &&
              res.startDate &&
              res.endDate &&
              currentStart <= res.endDate &&
              currentEnd >= res.startDate &&
              (res.cellCode === currentCellCode ||
                (currentCabin && res.cabina && currentCabin === res.cabina))
          );

          for (const existingRes of potentialConflicts) {
            if (existingRes.cellCode === currentCellCode) {
              const existingCondition = existingRes.condition;
              if (
                currentCondition === "jour entier" ||
                existingCondition === "jour entier" ||
                (currentCondition === "matin" &&
                  existingCondition === "matin") ||
                (currentCondition === "apres-midi" &&
                  existingCondition === "apres-midi")
              ) {
                conflictFound = true;
                conflictMessage = `Conflitto Ombrellone ${currentCellCode} rilevato (${
                  existingRes.condition
                }) con N° ${existingRes.serialNumber || existingRes.id} (${
                  existingRes.startDate
                } - ${existingRes.endDate}).`;
                break;
              }
            }
            if (
              currentCabin &&
              existingRes.cabina &&
              currentCabin === existingRes.cabina
            ) {
              conflictFound = true;
              conflictMessage = `Conflitto Cabina ${currentCabin} rilevato con N° ${
                existingRes.serialNumber || existingRes.id
              } (${existingRes.startDate} - ${existingRes.endDate}).`;
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
          setIsLoading(false);
          return;
        }

        let finalData = {
          ...dataToSave,
          cellCode: currentCellCode,
          modifiedAt: serverTimestamp(),
        };

        if (!reservationId) {
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
          const docRef = doc(db, "reservations", reservationId);
          finalData.serialNumber = existingSerialNumber;
          if (!finalData.createdAt) {
            finalData.createdAt = serverTimestamp();
          }
          await setDoc(docRef, finalData, { merge: true });
          setAllReservations((prev) =>
            prev.map((res) =>
              res.id === reservationId
                ? { ...res, ...finalData, modifiedAt: new Date() }
                : res
            )
          );
        }
      }

      alert("Prenotazione salvata con successo!");
      handleCloseModal();
      await fetchReservations();
      handleSearch();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la réservation:", error);
      alert(`Errore durante il salvataggio: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Fonction pour vérifier si une cellule est réservée matin/aprem par différents clients sur TOUTE la période ---
  const checkIfSplitBookingForPeriod = (cellCode, start, end, map) => {
    let currentDay = new Date(start);
    const lastDay = new Date(end);

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

      const isSplitToday =
        morningRes &&
        afternoonRes &&
        !fullDayRes &&
        morningRes.bookingId !== afternoonRes.bookingId;

      if (!isSplitToday) {
        return false;
      }

      currentDay.setDate(currentDay.getDate() + 1);
    }
    return true;
  };

  // --- Rendu du Plan Filtré ---
  const renderFilteredPlan = () => {
    if (isLoading && !searchPerformed)
      return <div className={styles.loadingIndicator}>Caricamento dati...</div>;
    if (isSearching)
      return <div className={styles.loadingIndicator}>Ricerca in corso...</div>;

    if (searchPerformed && filteredCells.length === 0)
      return (
        <div className={styles.noResults}>
          Nessun ombrellone corrisponde ai criteri per l'intero periodo.
        </div>
      );

    if (!searchPerformed)
      return (
        <div className={styles.noResults}>
          Seleziona i criteri e clicca 'Cerca'.
        </div>
      );

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
                const isSplitBooking = checkIfSplitBookingForPeriod(
                  cellCode,
                  startDate,
                  endDate,
                  reservationsMap
                );

                if (isSplitBooking) {
                  morningClass = styles.colorMatin;
                  afternoonClass = styles.colorApresMidi;
                } else {
                  switch (conditionUsedForLastSearch) {
                    case "booked_full":
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

              const isClickableForModal = isCellFiltered;

              return (
                <div
                  key={cellCode}
                  className={`${styles.cell} ${
                    !isCellFiltered ? styles.filteredOut : ""
                  } ${isClickableForModal ? styles.clickable : ""}`}
                  title={
                    isCellFiltered
                      ? `Ombrellone ${cellCode} - Corrisponde (Clicca per dettagli/modifica)`
                      : `Ombrellone ${cellCode} - Non corrisponde`
                  }
                  onClick={() => handleCellClick(cellCode)}
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

        <div className={styles.controlsHeader}>
          <div className={styles.filterGroup}>
            {" "}
            {/* Nouveau groupe pour la date de début */}
            <label htmlFor="startDate">Dal:</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            {" "}
            {/* Nouveau groupe pour la date de fin */}
            <label htmlFor="endDate">Al:</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            {" "}
            {/* Nouveau groupe pour la condition */}
            <label htmlFor="condition">Mostra Ombrelloni:</label>
            <select
              id="condition"
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
            >
              {/* Les options restent les mêmes */}
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
          <button
            onClick={handleSearch}
            disabled={isSearching || isLoading}
            className={styles.searchButton}
          >
            {isSearching ? "Ricerca..." : "Cerca"}
          </button>
        </div>

        {renderFilteredPlan()}

        {isModalOpen && selectedCellForModal && reservationToEdit && (
          <ReservationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSave={handleSaveReservation}
            cellCode={selectedCellForModal}
            allReservations={allReservations}
            selectedDate={startDate} // Le startDate de la recherche, qui a servi de référence pour construire reservationToEdit
            reservationData={reservationToEdit}
          />
        )}
      </div>
    </div>
  );
};

export default TestQueryPlan;
