import React, { useState } from "react"; // useEffect n'est plus nécessaire ici a priori
import { db } from "../../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
// import BeachPlan from "../BeachPlanFile/BeachPlan"; // <-- SUPPRIMÉ : On n'importe plus BeachPlan
import "../../Global.css";
import styles from "./Query.module.css";

// --- Constantes pour la grille interne ---
const QUERY_GRID_ROWS = ["A", "B", "C", "D"];
const QUERY_GRID_COLS = 36;

// Helper function pour les dates (inchangée)
const getDatesInRange = (startDateStr, endDateStr) => {
  const dates = [];
  try {
    const [startYear, startMonth, startDay] = startDateStr
      .split("-")
      .map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
    let currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const finalDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    if (isNaN(currentDate.getTime()) || isNaN(finalDate.getTime())) {
      console.error("Date invalide (NaN):", startDateStr, endDateStr);
      return [];
    }
    if (currentDate > finalDate) {
      console.error("Date début après fin:", startDateStr, endDateStr);
      return [];
    }
    while (currentDate <= finalDate) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  } catch (error) {
    console.error("Erreur getDatesInRange:", error, startDateStr, endDateStr);
    return [];
  }
  console.log(`getDatesInRange(${startDateStr}, ${endDateStr}) =>`, dates);
  return dates;
};

const Query = () => {
  // États pour le formulaire DANS LE MODAL (inchangés)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [condition, setCondition] = useState("all");

  // États pour le fonctionnement général et le modal (inchangés)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParasol, setSelectedParasol] = useState(null);

  // États pour les résultats et le chargement/erreurs (inchangés)
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(null);

  // --- Gère le double-clic sur une cellule de la GRILLE INTERNE ---
  const handleCellDoubleClick = (cellCode) => {
    console.log("Query Grid: Cell double-clicked:", cellCode);
    setSelectedParasol(cellCode);
    setStartDate(""); // Réinitialise les dates pour la nouvelle requête
    setEndDate("");
    setCondition("all");
    setError(null); // Efface les erreurs précédentes du modal ou globales
    setResults(null); // Efface les résultats précédents
    setIsModalOpen(true); // Ouvre le modal de requête
  };

  // --- Fonction de recherche (déclenchée par le modal) --- (inchangée)
  const handleSearch = async (
    searchStartDate,
    searchEndDate,
    searchCondition
  ) => {
    // La validation est maintenant faite dans le handleSubmit du modal avant d'appeler handleSearch

    setIsModalOpen(false);
    setLoading(true);
    setError(null);
    setResults(null);

    setSearchParams({
      codeParasol: selectedParasol,
      startDate: searchStartDate,
      endDate: searchEndDate,
      condition: searchCondition,
    });

    try {
      const reservationsRef = collection(db, "reservations");
      const q = query(
        reservationsRef,
        where("cellCode", "==", selectedParasol)
      );

      const querySnapshot = await getDocs(q);
      const fetchedReservations = [];
      console.log(`Recherche Firestore pour cellCode: ${selectedParasol}`);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let resStartDate, resEndDate;
        try {
          resStartDate =
            data.startDate instanceof Timestamp
              ? data.startDate.toDate()
              : new Date(data.startDate + "T00:00:00Z");
          resEndDate =
            data.endDate instanceof Timestamp
              ? data.endDate.toDate()
              : new Date(data.endDate + "T00:00:00Z");
          if (isNaN(resStartDate.getTime()) || isNaN(resEndDate.getTime())) {
            console.warn(
              "Dates invalides:",
              doc.id,
              data.startDate,
              data.endDate
            );
            return;
          }
          // Log avec les noms de champs Firestore corrects
          console.log("Réservation traitée:", {
            id: doc.id,
            cellCode: data.cellCode,
            startDate: resStartDate.toISOString().split("T")[0],
            endDate: resEndDate.toISOString().split("T")[0],
            prenom: data.prenom,
            nom: data.nom,
          });
          fetchedReservations.push({
            id: doc.id,
            ...data,
            startDate: resStartDate,
            endDate: resEndDate,
          });
        } catch (conversionError) {
          console.error(
            "Erreur conversion date:",
            doc.id,
            data,
            conversionError
          );
        }
      });
      console.log("Total réservations trouvées:", fetchedReservations.length);

      const requestedDates = getDatesInRange(searchStartDate, searchEndDate);
      if (requestedDates.length === 0) {
        setError("Errore nella generazione dell'intervallo di date.");
        setResults([]);
        setLoading(false);
        return;
      }

      let dailyStatus = requestedDates.map((dateStr) => {
        const [year, month, day] = dateStr.split("-").map(Number);
        const currentDateUTC = new Date(Date.UTC(year, month - 1, day));
        let isReserved = false;
        let reservationDetails = null;
        for (const reservation of fetchedReservations) {
          const resStartUTC = new Date(
            Date.UTC(
              reservation.startDate.getUTCFullYear(),
              reservation.startDate.getUTCMonth(),
              reservation.startDate.getUTCDate()
            )
          );
          const resEndUTC = new Date(
            Date.UTC(
              reservation.endDate.getUTCFullYear(),
              reservation.endDate.getUTCMonth(),
              reservation.endDate.getUTCDate()
            )
          );
          const comparisonResult =
            currentDateUTC.getTime() >= resStartUTC.getTime() &&
            currentDateUTC.getTime() <= resEndUTC.getTime();
          if (comparisonResult) {
            isReserved = true;
            // Lire depuis 'prenom' et 'nom'
            reservationDetails = {
              firstName: reservation.prenom || "N/A",
              lastName: reservation.nom || "N/A",
            };
            break;
          }
        }
        return {
          date: dateStr,
          status: isReserved ? "Prenotato" : "Libero",
          customer: isReserved ? reservationDetails : null,
        };
      });

      if (searchCondition === "reserved") {
        dailyStatus = dailyStatus.filter((day) => day.status === "Prenotato");
      } else if (searchCondition === "not_reserved") {
        dailyStatus = dailyStatus.filter((day) => day.status === "Libero");
      }

      console.log("Statut journalier après filtre:", dailyStatus);
      setResults(dailyStatus);
    } catch (err) {
      console.error("Erreur lors de la recherche Firestore:", err);
      setError("Une erreur est survenue lors de la recherche.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour obtenir le label de la condition (inchangée)
  const getConditionLabel = () => {
    switch (searchParams?.condition) {
      case "reserved":
        return "Prenotato";
      case "not_reserved":
        return "Libero";
      default:
        return "Tutti";
    }
  };

  // --- Composant Modal de Requête --- (inchangé)
  const QueryModal = () => {
    const [modalStartDate, setModalStartDate] = useState(startDate);
    const [modalEndDate, setModalEndDate] = useState(endDate);
    const [modalCondition, setModalCondition] = useState(condition);
    // État d'erreur spécifique au modal
    const [modalError, setModalError] = useState(null);

    const handleSubmit = (e) => {
      e.preventDefault();
      setModalError(null); // Reset error on new submit attempt

      // --- Validation des dates DANS le modal ---
      if (!modalStartDate || !modalEndDate) {
        setModalError("Inserire le due date.");
        return;
      }
      const startInputDate = new Date(modalStartDate + "T00:00:00Z");
      const endInputDate = new Date(modalEndDate + "T00:00:00Z");

      if (isNaN(startInputDate.getTime()) || isNaN(endInputDate.getTime())) {
        setModalError("Formato data sbagliato.");
        return;
      }
      if (startInputDate > endInputDate) {
        setModalError(
          "La data inizio non può essere posteriore alla data fine."
        );
        return;
      }
      // --- Fin Validation ---

      // Si validation OK, met à jour les états principaux et lance la recherche
      setStartDate(modalStartDate);
      setEndDate(modalEndDate);
      setCondition(modalCondition);
      handleSearch(modalStartDate, modalEndDate, modalCondition);
    };

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <h2>Interrogazione per Ombrellone: {selectedParasol}</h2>
          {/* Affiche l'erreur spécifique au modal ici */}
          {modalError && <p className={styles.modalError}>{modalError}</p>}
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="modalStartDate">Data Inizio:</label>
              <input
                type="date"
                id="modalStartDate"
                value={modalStartDate}
                onChange={(e) => {
                  setModalStartDate(e.target.value);
                  setModalError(null);
                }}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="modalEndDate">Data Fine:</label>
              <input
                type="date"
                id="modalEndDate"
                value={modalEndDate}
                onChange={(e) => {
                  setModalEndDate(e.target.value);
                  setModalError(null);
                }}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="modalCondition">Condizione:</label>
              <select
                id="modalCondition"
                value={modalCondition}
                onChange={(e) => {
                  setModalCondition(e.target.value);
                  setModalError(null);
                }}
              >
                <option value="all">Tutti (Libero / Prenotato)</option>
                <option value="reserved">Solo Prenotato</option>
                <option value="not_reserved">Solo Libero</option>
              </select>
            </div>
            <div className={styles.modalActions}>
              <button type="submit" className={styles.searchButton}>
                Cerca
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null); /* Efface aussi l'erreur globale */
                }}
                className={styles.cancelButton}
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // --- NOUVEAU : Fonction pour rendre la grille de requête ---
  const renderQueryGrid = () => {
    return (
      <div className={styles.queryGridContainer}>
        {" "}
        {/* Nouveau conteneur pour la grille */}
        {QUERY_GRID_ROWS.map((rowLabel) => (
          <div key={rowLabel} className={styles.queryRow}>
            {" "}
            {/* Nouvelle classe pour la rangée */}
            {Array.from({ length: QUERY_GRID_COLS }).map((_, index) => {
              const col = index + 1;
              const cellCode = `${rowLabel}${String(col).padStart(2, "0")}`;
              return (
                <div
                  key={cellCode}
                  className={styles.queryCell} // Nouvelle classe pour la cellule (toujours blanche)
                  onDoubleClick={() => handleCellDoubleClick(cellCode)}
                  title={`Interroga Ombrellone ${cellCode}`} // Info-bulle
                >
                  {cellCode}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // --- Rendu principal du composant Query ---
  return (
    <div className={styles.queryContainer}>
      <div className={styles.titre}>
        <h1>Interrogazione Prenotazioni</h1>
        <p>
          Doppio click su un ombrellone per definire il periodo della ricerca.
        </p>
      </div>

      {/* Affiche la grille de requête interne */}
      {renderQueryGrid()}

      {/* Affiche le modal si isModalOpen est true */}
      {isModalOpen && <QueryModal />}

      {/* Indicateur de chargement global */}
      {loading && (
        <div className={styles.loadingIndicator}>
          <p>Caricamento risultati...</p>
        </div>
      )}

      {/* Affichage de l'erreur globale (si pas de chargement et modal fermé) */}
      {!loading && !isModalOpen && error && (
        <p className={styles.error}>{error}</p>
      )}

      {/* Section des résultats */}
      {!loading && !isModalOpen && results && searchParams && (
        <div className={styles.resultsContainer}>
          <h2>
            Risultati per {searchParams.codeParasol}
            <span className={styles.dateRange}>
              {" "}
              (dal {searchParams.startDate} al {searchParams.endDate})
            </span>
          </h2>
          {searchParams.condition !== "all" && (
            <p className={styles.conditionHeader}>
              Visualizzazione giorni con stato:{" "}
              <strong>{getConditionLabel()}</strong>
            </p>
          )}
          {results.length === 0 ? (
            <p className={styles.noResults}>
              Nessuna data corrisponde alla condizione '{getConditionLabel()}'
              per l'ombrellone {searchParams.codeParasol} tra il{" "}
              {searchParams.startDate} e il {searchParams.endDate}.
            </p>
          ) : (
            <ul className={styles.resultsList}>
              {results.map((item, index) => (
                <li
                  key={index}
                  className={
                    item.status === "Prenotato"
                      ? styles.prenotato
                      : styles.libero
                  }
                >
                  <div>
                    {item.date}: <strong>{item.status}</strong>
                  </div>
                  {item.status === "Prenotato" && item.customer && (
                    <span className={styles.customerName}>
                      {item.customer.firstName} {item.customer.lastName}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Query;
