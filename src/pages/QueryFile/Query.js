import React, { useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import "../../Global.css";
import styles from "./Query.module.css";

// --- Constantes pour la grille interne ---
const QUERY_GRID_ROWS = ["A", "B", "C", "D"];
const QUERY_GRID_COLS = 36;

// --- Fonction simple pour formater la date (alternative à dateUtils) ---
const formatDateSimple = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (
        !isNaN(parseInt(day)) &&
        !isNaN(parseInt(month)) &&
        !isNaN(parseInt(year))
      ) {
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
    }
    return dateStr;
  } catch (e) {
    console.error("Erreur formatage date simple:", e, "pour date:", dateStr);
    return dateStr;
  }
};

// Helper function pour les dates (de l'ancienne version)
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
  // console.log(`getDatesInRange(${startDateStr}, ${endDateStr}) =>`, dates); // Peut être bruyant
  return dates;
};

const Query = () => {
  // États pour le formulaire DANS LE MODAL (de l'ancienne version)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [condition, setCondition] = useState("all"); // 'all', 'reserved', 'not_reserved'

  // États pour le fonctionnement général et le modal (de l'ancienne version)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParasol, setSelectedParasol] = useState(null);

  // États pour les résultats et le chargement/erreurs (de l'ancienne version)
  const [results, setResults] = useState(null); // Sera notre 'dailyStatus'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(null); // Pour afficher les infos de recherche

  // --- Gère le double-clic sur une cellule de la GRILLE INTERNE --- (de l'ancienne version)
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

  // --- Fonction de recherche (déclenchée par le modal) --- (Adaptée pour inclure la condition)
  const handleSearch = async (
    searchStartDate,
    searchEndDate,
    searchCondition // 'all', 'reserved', 'not_reserved'
  ) => {
    setIsModalOpen(false);
    setLoading(true);
    setError(null);
    setResults(null);

    setSearchParams({
      codeParasol: selectedParasol,
      startDate: searchStartDate,
      endDate: searchEndDate,
      condition: searchCondition, // Stocke la condition de recherche
    });

    try {
      const reservationsRef = collection(db, "reservations");
      const q = query(
        reservationsRef,
        where("cellCode", "==", selectedParasol)
      );

      const querySnapshot = await getDocs(q);
      const fetchedReservations = [];
      // console.log(`Recherche Firestore pour cellCode: ${selectedParasol}`); // Peut être bruyant
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let resStartDate, resEndDate;
        try {
          // Gestion des dates (Timestamp ou string)
          resStartDate =
            data.startDate instanceof Timestamp
              ? data.startDate.toDate()
              : new Date(data.startDate + "T00:00:00Z"); // Assume UTC si string
          resEndDate =
            data.endDate instanceof Timestamp
              ? data.endDate.toDate()
              : new Date(data.endDate + "T00:00:00Z"); // Assume UTC si string

          if (isNaN(resStartDate.getTime()) || isNaN(resEndDate.getTime())) {
            console.warn(
              "Dates invalides dans Firestore:",
              doc.id,
              data.startDate,
              data.endDate
            );
            return; // Ignore cette réservation
          }

          fetchedReservations.push({
            id: doc.id,
            ...data, // Inclut prenom, nom, condition, etc.
            startDate: resStartDate, // Garde comme objet Date
            endDate: resEndDate, // Garde comme objet Date
          });
        } catch (conversionError) {
          console.error(
            "Erreur conversion date Firestore:",
            doc.id,
            data,
            conversionError
          );
        }
      });
      // console.log("Total réservations Firestore trouvées:", fetchedReservations.length); // Peut être bruyant

      const requestedDates = getDatesInRange(searchStartDate, searchEndDate);
      if (requestedDates.length === 0 && searchStartDate && searchEndDate) {
        // Affiche une erreur seulement si les dates étaient valides mais la plage est vide (ex: start > end)
        setError("Errore nell'intervallo di date richiesto.");
        setResults([]);
        setLoading(false);
        return;
      }

      let dailyStatus = requestedDates.map((dateStr) => {
        const [year, month, day] = dateStr.split("-").map(Number);
        const currentDateUTC = new Date(Date.UTC(year, month - 1, day)); // Date courante en UTC pour comparaison
        let isReserved = false;
        let reservationDetails = null;

        for (const reservation of fetchedReservations) {
          // Convertir les dates de réservation en UTC pour la comparaison jour par jour
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

          // Comparaison stricte des temps UTC
          if (
            currentDateUTC.getTime() >= resStartUTC.getTime() &&
            currentDateUTC.getTime() <= resEndUTC.getTime()
          ) {
            isReserved = true;
            reservationDetails = {
              firstName: reservation.prenom || "N/A",
              lastName: reservation.nom || "N/A",
              condition: reservation.condition || "N/A", // *** Récupère la condition de la réservation ***
            };
            break; // Une seule réservation suffit pour marquer le jour comme réservé
          }
        }
        return {
          date: dateStr, // Garde le format YYYY-MM-DD
          status: isReserved ? "Prenotato" : "Libero",
          customer: reservationDetails, // Contient maintenant la condition si réservé
        };
      });

      // Appliquer le filtre de condition APRÈS avoir déterminé le statut de chaque jour
      if (searchCondition === "reserved") {
        dailyStatus = dailyStatus.filter((day) => day.status === "Prenotato");
      } else if (searchCondition === "not_reserved") {
        dailyStatus = dailyStatus.filter((day) => day.status === "Libero");
      }

      // console.log("Statut journalier final:", dailyStatus); // Peut être bruyant
      setResults(dailyStatus); // Met à jour l'état des résultats
    } catch (err) {
      console.error("Erreur lors de la recherche Firestore:", err);
      setError("Une erreur est survenue lors de la recherche.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour obtenir le label de la condition (de l'ancienne version)
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

  // --- Composant Modal de Requête --- (de l'ancienne version)
  const QueryModal = () => {
    const [modalStartDate, setModalStartDate] = useState(startDate);
    const [modalEndDate, setModalEndDate] = useState(endDate);
    const [modalCondition, setModalCondition] = useState(condition);
    const [modalError, setModalError] = useState(null);

    const handleSubmit = (e) => {
      e.preventDefault();
      setModalError(null);

      if (!modalStartDate || !modalEndDate) {
        setModalError("Inserire le due date.");
        return;
      }
      // Validation simple du format YYYY-MM-DD (peut être améliorée)
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(modalStartDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(modalEndDate)
      ) {
        setModalError("Formato data non valido (usare YYYY-MM-DD).");
        return;
      }
      const startInputDate = new Date(modalStartDate + "T00:00:00Z");
      const endInputDate = new Date(modalEndDate + "T00:00:00Z");

      if (isNaN(startInputDate.getTime()) || isNaN(endInputDate.getTime())) {
        setModalError("Date non valide.");
        return;
      }
      if (startInputDate > endInputDate) {
        setModalError(
          "La data inizio non può essere posteriore alla data fine."
        );
        return;
      }

      setStartDate(modalStartDate);
      setEndDate(modalEndDate);
      setCondition(modalCondition);
      handleSearch(modalStartDate, modalEndDate, modalCondition);
    };

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <h2>Interrogazione per Ombrellone: {selectedParasol}</h2>
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
                min={modalStartDate} // Ajout du min pour la cohérence
                onChange={(e) => {
                  setModalEndDate(e.target.value);
                  setModalError(null);
                }}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="modalCondition">Mostra Giorni:</label>
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
                  setError(null);
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

  // --- Fonction pour rendre la grille de requête --- (de l'ancienne version)
  const renderQueryGrid = () => {
    return (
      <div className={styles.queryGridContainer}>
        {QUERY_GRID_ROWS.map((rowLabel) => (
          <div key={rowLabel} className={styles.queryRow}>
            {Array.from({ length: QUERY_GRID_COLS }).map((_, index) => {
              const col = index + 1;
              const cellCode = `${rowLabel}${String(col).padStart(2, "0")}`;
              return (
                <div
                  key={cellCode}
                  className={styles.queryCell} // Utilise la classe CSS pour la grille
                  onDoubleClick={() => handleCellDoubleClick(cellCode)}
                  title={`Interroga Ombrellone ${cellCode}`}
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
        <h1>Interrogazione Disponibilità</h1>
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

      {/* Section des résultats (Utilise le NOUVEAU style d'affichage) */}
      {!loading && !isModalOpen && results && searchParams && (
        <div className={styles.resultsContainer}>
          <h2>
            Risultati per {searchParams.codeParasol}
            <span className={styles.dateRange}>
              {" "}
              (dal {formatDateSimple(searchParams.startDate)} al{" "}
              {formatDateSimple(searchParams.endDate)}){" "}
              {/* Utilise formatDateSimple */}
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
              per l'ombrellone {searchParams.codeParasol} nel periodo
              selezionato.
            </p>
          ) : (
            <ul className={styles.resultsList}>
              {results.map((item, index) => (
                <li key={index}>
                  <div>
                    {formatDateSimple(item.date)} -{" "}
                    {/* Utilise formatDateSimple */}
                    {item.status === "Prenotato" && item.customer ? (
                      <>
                        <strong className={styles.prenotato}> Prenotato</strong>
                        {/* *** NOUVELLE PARTIE pour la condition colorée *** */}
                        <span
                          className={`${styles.conditionText} ${
                            item.customer.condition === "jour entier"
                              ? styles.conditionRed
                              : item.customer.condition === "matin"
                              ? styles.conditionBlue
                              : item.customer.condition === "apres-midi"
                              ? styles.conditionOrange
                              : ""
                          }`}
                        >
                          (
                          {item.customer.condition === "jour entier"
                            ? "Giorno Intero"
                            : item.customer.condition === "matin"
                            ? "Mattina"
                            : item.customer.condition === "apres-midi"
                            ? "Pomeriggio"
                            : item.customer.condition || "N/D"}
                          )
                        </span>
                      </>
                    ) : (
                      <strong className={styles.libero}> Libero</strong>
                    )}
                  </div>
                  {/* Affichage Nom Client (si réservé) */}
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
