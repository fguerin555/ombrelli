// /Users/fredericguerin/Desktop/ombrelli/src/pages/TestQueryPlanFile/TestQueryPlan.js
import React, { useState, useCallback, useMemo } from "react";
import "../../Global.css";
import styles from "./TestQueryPlan.module.css";
import ReservationModal from "../BeachPlanFile/ReservationModal"; //
import { useAuth } from "../../contexts/AuthContext"; // Importer useAuth

// --- Fonctions Utilitaires (similaires à BeachPlan) ---
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
    const date = new Date(dateStr);
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

// !!! IMPORTANT : Remplacez ces placeholders par les VRAIS UID que vous avez mis dans vos règles Firestore !!!
const ADMIN_UIDS = [
  "TTbEHi8QRCTyMADYPt2N8yKB8Yg2",
  "BmT4kbaXHjguZecqMnQGEJGnqwL2",
]; // Exemple, à remplacer

// Le composant accepte maintenant allReservations et les fonctions de sauvegarde/suppression en props
const TestQueryPlan = ({
  allReservations, // Prop depuis BeachPlan.js
  onSaveReservation, // Prop depuis BeachPlan.js (handleSaveReservation)
  onDeleteReservation, // Prop depuis BeachPlan.js (handleDeleteReservation)
}) => {
  // --- États ---
  // const [allReservations, setAllReservations] = useState([]); // RETIRÉ - Utilise la prop
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [isModalSaving, setIsModalSaving] = useState(false); // État pour le chargement du modal local
  const [selectedCondition, setSelectedCondition] = useState("booked_full");
  const [filteredCells, setFilteredCells] = useState([]);

  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [conditionUsedForLastSearch, setConditionUsedForLastSearch] =
    useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCellForModal, setSelectedCellForModal] = useState(null);
  const [reservationToEdit, setReservationToEdit] = useState(null);

  // --- Infos Utilisateur/Admin ---
  const { currentUser } = useAuth(); // Récupérer l'utilisateur actuel
  const isCurrentUserAdmin =
    currentUser && ADMIN_UIDS.includes(currentUser.uid); // Déterminer si admin

  // --- Chargement initial des données ---
  // RETIRÉ - fetchReservations et le useEffect correspondant, car les données viennent des props
  // const fetchReservations = useCallback(async () => { ... }, []);
  // useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // --- Calcul optimisé de la map des réservations ---
  const reservationsMap = useMemo(() => {
    // console.log("TestQueryPlan: Recalculating reservationsMap based on prop...");
    const map = new Map();
    if (!Array.isArray(allReservations)) {
      // Sécurité si la prop n'est pas prête
      console.warn(
        "TestQueryPlan: allReservations prop is not an array or undefined."
      );
      return map;
    }
    allReservations.forEach((res) => {
      if (!res.cellCode || !res.startDate || !res.endDate) return;
      // S'assurer que startDate et endDate sont des chaînes YYYY-MM-DD
      const resStartDateStr =
        res.startDate instanceof Date
          ? res.startDate.toISOString().slice(0, 10)
          : typeof res.startDate === "string"
          ? res.startDate
          : null;
      const resEndDateStr =
        res.endDate instanceof Date
          ? res.endDate.toISOString().slice(0, 10)
          : typeof res.endDate === "string"
          ? res.endDate
          : null;

      if (!resStartDateStr || !resEndDateStr) return; // Ignorer si les dates ne sont pas valides

      let loopDateStr = resStartDateStr;
      const stopDateStr = resEndDateStr;

      // Boucle sur les dates en chaînes pour éviter les problèmes de fuseau horaire avec les objets Date
      while (loopDateStr <= stopDateStr) {
        const key = `${res.cellCode}_${loopDateStr}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push({
          condition: res.condition,
          bookingId: res.serialNumber || res.id,
        });
        if (loopDateStr === stopDateStr) break; // Évite boucle infinie si addDays a un souci
        const nextDay = addDays(loopDateStr, 1);
        if (!nextDay) break; // Sécurité
        loopDateStr = nextDay;
      }
    });
    return map;
  }, [allReservations]); // Recalculer seulement si la prop allReservations change

  // --- Logique de Filtrage (déclenchée par le bouton) ---
  const handleSearch = useCallback(() => {
    if (!startDate || !endDate || startDate > endDate) {
      alert("Seleziona un periodo valido prima di cercare.");
      setFilteredCells([]);
      setSearchPerformed(true);
      return;
    }
    setIsSearching(true);
    setSearchPerformed(true);

    const results = [];
    allCellCodes.forEach((cellCode) => {
      let match = true;
      let currentDayStr = startDate;
      const lastDayStr = endDate;

      while (currentDayStr <= lastDayStr) {
        const key = `${cellCode}_${currentDayStr}`;
        const conditionsForTheDay = reservationsMap.get(key) || [];

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
            dayMatchesCondition = hasFullDay || (hasMorning && hasAfternoon);
            break;
          case "booked_morning":
            dayMatchesCondition = hasMorning && !hasFullDay && !hasAfternoon;
            break;
          case "booked_afternoon":
            dayMatchesCondition = hasAfternoon && !hasFullDay && !hasMorning;
            break;
          case "free_full":
            dayMatchesCondition = !hasFullDay && !hasMorning && !hasAfternoon;
            break;
          case "free_only_morning":
            dayMatchesCondition = !hasFullDay && !hasMorning && hasAfternoon;
            break;
          case "free_only_afternoon":
            dayMatchesCondition = !hasFullDay && !hasAfternoon && hasMorning;
            break;
          default:
            dayMatchesCondition = false;
        }

        if (!dayMatchesCondition) {
          match = false;
          break;
        }
        if (currentDayStr === lastDayStr) break;
        const nextDay = addDays(currentDayStr, 1);
        if (!nextDay) break;
        currentDayStr = nextDay;
      }

      if (match) {
        results.push(cellCode);
      }
    });

    // console.log(
    //   `Ricerca completata, ${results.length} ombrelloni corrispondono.`
    // );
    setFilteredCells(results);
    setConditionUsedForLastSearch(selectedCondition);
    setIsSearching(false);
  }, [reservationsMap, startDate, endDate, selectedCondition]);

  // --- Gestion du Modal ---
  const handleCellClick = (cellCode) => {
    if (!filteredCells.includes(cellCode)) {
      // console.log(`Clic sur ${cellCode} ignoré (non filtré)`);
      return;
    }

    const isFreeCondition =
      conditionUsedForLastSearch === "free_full" ||
      conditionUsedForLastSearch === "free_only_morning" ||
      conditionUsedForLastSearch === "free_only_afternoon";

    if (isFreeCondition) {
      let newCondition = "jour entier";
      if (conditionUsedForLastSearch === "free_only_morning") {
        newCondition = "matin";
      } else if (conditionUsedForLastSearch === "free_only_afternoon") {
        newCondition = "apres-midi";
      }

      // startDate et endDate du filtre sont déjà des chaînes YYYY-MM-DD
      const newReservationPayload = {
        nom: "",
        prenom: "",
        startDate: startDate,
        endDate: endDate,
        condition: newCondition,
        numBeds: 2,
        registiPoltrona: "",
        serialNumber: null,
        id: null,
        cabina: null,
      };
      setSelectedCellForModal(cellCode);
      setReservationToEdit(newReservationPayload); // Dates sont déjà des strings YYYY-MM-DD
      setIsModalOpen(true);
      // console.log(`Ouverture modal pour NOUVELLE réservation sur ${cellCode}`);
    } else {
      // Cas où l'on clique sur une cellule déjà réservée (selon les filtres)
      const reservationsForCellOnRefDate = allReservations.filter((res) => {
        // S'assurer que res.startDate et res.endDate sont des strings YYYY-MM-DD pour la comparaison
        const resStartDateStr =
          res.startDate instanceof Date
            ? res.startDate.toISOString().slice(0, 10)
            : typeof res.startDate === "string"
            ? res.startDate
            : null;
        const resEndDateStr =
          res.endDate instanceof Date
            ? res.endDate.toISOString().slice(0, 10)
            : typeof res.endDate === "string"
            ? res.endDate
            : null;
        if (!resStartDateStr || !resEndDateStr) return false;

        return (
          res.cellCode === cellCode &&
          startDate >= resStartDateStr &&
          startDate <= resEndDateStr
        );
      });

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

      // Fonction pour s'assurer que les dates sont des strings YYYY-MM-DD
      const formatReservationDates = (resData) => {
        if (!resData) return null;
        return {
          ...resData,
          startDate:
            resData.startDate instanceof Date
              ? resData.startDate.toISOString().slice(0, 10)
              : typeof resData.startDate === "string"
              ? resData.startDate
              : null,
          endDate:
            resData.endDate instanceof Date
              ? resData.endDate.toISOString().slice(0, 10)
              : typeof resData.endDate === "string"
              ? resData.endDate
              : null,
        };
      };

      if (fullDayRes) {
        dataForModalOnClick = formatReservationDates(fullDayRes);
      } else if (morningResOnly && afternoonResOnly) {
        if (morningResOnly.id !== afternoonResOnly.id) {
          dataForModalOnClick = {
            morning: formatReservationDates(morningResOnly),
            afternoon: formatReservationDates(afternoonResOnly),
            type: "dual",
          };
        } else {
          // Si c'est la même résa qui couvre matin et aprem (ce qui ne devrait pas arriver si ce n'est pas 'jour entier')
          // On prend la première trouvée.
          dataForModalOnClick = formatReservationDates(morningResOnly);
        }
      } else if (morningResOnly) {
        dataForModalOnClick = formatReservationDates(morningResOnly);
      } else if (afternoonResOnly) {
        dataForModalOnClick = formatReservationDates(afternoonResOnly);
      }

      if (dataForModalOnClick) {
        setSelectedCellForModal(cellCode);
        setReservationToEdit(dataForModalOnClick); // Les dates sont maintenant formatées
        setIsModalOpen(true);
        // console.log(
        //   `Ouverture modal pour ${cellCode} avec données:`,
        //   dataForModalOnClick
        // );
      } else {
        // console.log(
        //   `Aucune donnée de réservation pertinente à afficher dans le modal pour ${cellCode} le ${startDate}.`
        // );
      }
    }
  };

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCellForModal(null);
    setReservationToEdit(null);
  }, []); // Dépendances : setIsModalOpen, setSelectedCellForModal, setReservationToEdit

  // Wrapper pour la sauvegarde
  const handleModalSaveWrapper = async (dataFromModal) => {
    if (typeof onSaveReservation !== "function") {
      console.error(
        "onSaveReservation prop is not a function in TestQueryPlan"
      );
      alert("Errore interno: Funzione di salvataggio non disponibile.");
      return;
    }
    setIsModalSaving(true);
    try {
      await onSaveReservation(dataFromModal); // Appelle la fonction de BeachPlan.js
      handleCloseModal(); // Si succès, fermer le modal local
    } catch (error) {
      // L'erreur (et l'alerte) devrait avoir été gérée et levée par onSaveReservation de BeachPlan.js
      console.warn(
        "Salvataggio fallito, modal non chiuso (TestQueryPlan):",
        error.message
      );
      // Ne pas fermer le modal pour que l'utilisateur puisse corriger si l'erreur vient de BeachPlan
    } finally {
      setIsModalSaving(false);
    }
  };

  // Wrapper pour la suppression
  const handleModalDeleteWrapper = async (reservationId) => {
    if (typeof onDeleteReservation !== "function") {
      console.error(
        "onDeleteReservation prop is not a function in TestQueryPlan"
      );
      alert("Errore interno: Funzione di eliminazione non disponibile.");
      return;
    }
    setIsModalSaving(true);
    try {
      await onDeleteReservation(reservationId); // Appelle la fonction de BeachPlan.js
      handleCloseModal(); // Si succès, fermer le modal local
    } catch (error) {
      console.warn(
        "Eliminazione fallita, modal non chiuso (TestQueryPlan):",
        error.message
      );
    } finally {
      setIsModalSaving(false);
    }
  };
  // --- Fonction pour vérifier si une cellule est réservée matin/aprem par différents clients sur TOUTE la période ---
  const checkIfSplitBookingForPeriod = (cellCode, start, end, map) => {
    let currentDayStr = start;
    const lastDayStr = end;

    if (currentDayStr > lastDayStr) return false;

    while (currentDayStr <= lastDayStr) {
      const key = `${cellCode}_${currentDayStr}`;
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
      if (currentDayStr === lastDayStr) break;
      const nextDay = addDays(currentDayStr, 1);
      if (!nextDay) break;
      currentDayStr = nextDay;
    }
    return true;
  };

  // --- Rendu du Plan Filtré ---
  const renderFilteredPlan = () => {
    if (isSearching) {
      return <div className={styles.loadingIndicator}>Ricerca in corso...</div>;
    }

    if (searchPerformed && filteredCells.length === 0) {
      return (
        <div className={styles.noResults}>
          Nessun ombrellone corrisponde ai criteri per l'intero periodo.
        </div>
      );
    }

    if (!searchPerformed) {
      return (
        <div className={styles.noResults}>
          Seleziona i criteri e clicca 'Cerca'.
        </div>
      );
    }

    // Si on arrive ici, on affiche le plan
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
  }; // Fin de renderFilteredPlan

  return (
    <div>
      <div className={styles.TestQueryPlanPage}>
        <div className={styles.Titre}>
          <h1>Mappa prenotati/liberi (matt./pome./intero) periodo</h1>
        </div>

        <div className={styles.controlsHeader}>
          <div className={styles.filterGroup}>
            <label htmlFor="startDate">Dal:</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
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
          <button onClick={handleSearch} className={styles.searchButton}>
            {isSearching ? "Ricerca..." : "Cerca"}
          </button>
        </div>

        {renderFilteredPlan()}

        {isModalOpen && selectedCellForModal && reservationToEdit && (
          <ReservationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSave={handleModalSaveWrapper} // AJOUT: Utilise le wrapper pour la sauvegarde
            onDelete={handleModalDeleteWrapper} // AJOUT: Utilise le wrapper pour la suppression
            cellCode={selectedCellForModal}
            allReservations={allReservations} // MODIFIÉ: Utilise la prop de BeachPlan
            selectedDate={startDate} // Utilise la date de début du filtre comme contexte pour le modal
            reservationData={reservationToEdit}
            isSaving={isModalSaving} // AJOUT: Utilise l'état de sauvegarde local du modal
            isCurrentUserAdmin={isCurrentUserAdmin} // Passer le statut admin
          />
        )}
      </div>
    </div>
  );
};

export default TestQueryPlan;
