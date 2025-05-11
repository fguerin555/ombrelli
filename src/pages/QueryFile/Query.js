// /Users/fredericguerin/Desktop/ombrelli/src/pages/QueryFile/Query.js
import React, { useState } from "react";
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

// --- Fonction pour convertir 'R'/'P' en texte complet ---
const formatExtra = (code) => {
  if (code === "R") return "Regista";
  if (code === "T") return "Transat";
  return ""; // Retourne une chaîne vide si ce n'est ni R ni P ou si code est undefined/null
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
  return dates;
};

const Query = ({ allReservations }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [condition, setCondition] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParasol, setSelectedParasol] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(null);

  const handleCellDoubleClick = (cellCode) => {
    setSelectedParasol(cellCode);
    setStartDate("");
    setEndDate("");
    setCondition("all");
    setError(null);
    setResults(null);
    setIsModalOpen(true);
  };

  const handleSearch = async (
    searchStartDate,
    searchEndDate,
    searchCondition
  ) => {
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
      // Vérifier si allReservations est disponible et est un tableau
      if (!Array.isArray(allReservations)) {
        console.error(
          "allReservations n'est pas un tableau ou est indéfini dans Query.js:",
          allReservations
        );
        setError(
          "Erreur interne: Données de réservation non disponibles pour la recherche."
        );
        setLoading(false);
        return;
      }

      // Filtrer allReservations pour le parasol sélectionné
      const reservationsForSelectedParasol = allReservations.filter(
        (res) => res.cellCode === selectedParasol
      );

      const fetchedReservations = [];
      reservationsForSelectedParasol.forEach((res) => {
        // Itérer sur les réservations filtrées
        let resStartDate, resEndDate;
        try {
          // Les dates dans allReservations (après sanitization dans BeachPlan.js) sont des strings "YYYY-MM-DD"
          // ou des chaînes vides. Il faut les convertir en objets Date pour la logique existante.
          if (!res.startDate || !res.endDate) {
            console.warn(
              "Réservation avec dates manquantes ou invalides (Query.js):",
              res.id,
              res.startDate,
              res.endDate
            );
            return; // Ignorer cette réservation si les dates sont manquantes
          }
          resStartDate = new Date(res.startDate + "T00:00:00Z"); // Convertir la string en Date
          resEndDate = resEndDate = new Date(res.endDate + "T00:00:00Z"); // Convertir la string en Date

          if (isNaN(resStartDate.getTime()) || isNaN(resEndDate.getTime())) {
            console.warn(
              "Dates invalides après conversion (Query.js):",
              res.id,
              res.startDate, // string originale
              res.endDate // string originale
            );
            return;
          }

          fetchedReservations.push({
            ...res, // Contient déjà id, nom, prenom, condition, etc.
            startDate: resStartDate, // Objet Date
            endDate: resEndDate, // Objet Date
          });
        } catch (conversionError) {
          console.error(
            "Erreur lors de la conversion des dates (Query.js):",
            res.id,
            res, // Affiche l'objet res complet pour le débogage
            conversionError
          );
        }
      });

      const requestedDates = getDatesInRange(searchStartDate, searchEndDate);
      if (requestedDates.length === 0 && searchStartDate && searchEndDate) {
        setError("Errore nell'intervallo di date richiesto.");
        setResults([]);
        setLoading(false);
        return;
      }

      let dailyStatusList = []; // Sera une liste d'objets, potentiellement plusieurs par date

      for (const dateStr of requestedDates) {
        const [year, month, day] = dateStr.split("-").map(Number);
        const currentDateUTC = new Date(Date.UTC(year, month - 1, day));

        let morningReservationDetails = null;
        let afternoonReservationDetails = null;
        let fullDayReservationDetails = null;

        for (const reservation of fetchedReservations) {
          // Assurez-vous que reservation.startDate et reservation.endDate sont bien des objets Date
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

          if (
            currentDateUTC.getTime() >= resStartUTC.getTime() &&
            currentDateUTC.getTime() <= resEndUTC.getTime()
          ) {
            const details = {
              firstName: reservation.prenom || "N/A",
              lastName: reservation.nom || "N/A",
              condition: reservation.condition || "N/A",
              numBeds:
                reservation.numBeds !== undefined ? reservation.numBeds : "",
              registiPoltrona: reservation.registiPoltrona || "",
              cabina: reservation.cabina || "",
            };

            if (reservation.condition === "jour entier") {
              fullDayReservationDetails = details;
              break; // Une réservation "jour entier" prime pour cette date
            } else if (reservation.condition === "matin") {
              morningReservationDetails = details;
            } else if (reservation.condition === "apres-midi") {
              afternoonReservationDetails = details;
            }
          }
        }

        if (fullDayReservationDetails) {
          dailyStatusList.push({
            date: dateStr,
            periodDisplay: "Giorno Intero", // Pour l'affichage
            status: "Prenotato",
            customer: fullDayReservationDetails,
          });
        } else {
          if (morningReservationDetails) {
            dailyStatusList.push({
              date: dateStr,
              periodDisplay: "Mattina",
              status: "Prenotato",
              customer: morningReservationDetails,
            });
          }
          if (afternoonReservationDetails) {
            dailyStatusList.push({
              date: dateStr,
              periodDisplay: "Pomeriggio",
              status: "Prenotato",
              customer: afternoonReservationDetails,
            });
          }
          if (!morningReservationDetails && !afternoonReservationDetails) {
            // Si ni matin, ni après-midi (et pas jour entier)
            dailyStatusList.push({
              date: dateStr,
              periodDisplay: "Libero",
              status: "Libero",
              customer: null,
            });
          }
        }
      }

      if (searchCondition === "reserved") {
        dailyStatusList = dailyStatusList.filter(
          (day) => day.status === "Prenotato"
        );
      } else if (searchCondition === "not_reserved") {
        dailyStatusList = dailyStatusList.filter(
          (day) => day.status === "Libero"
        );
      }

      setResults(dailyStatusList);
    } catch (err) {
      console.error("Erreur lors de la recherche Firestore:", err);
      setError("Errore durante la ricerca nel database.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

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
                min={modalStartDate}
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
                  className={styles.queryCell}
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

  return (
    <div className={styles.queryContainer}>
      <div className={styles.titre}>
        <h1>Ricerca per ombrellone e periodo</h1>
        <p>
          Doppio click su un ombrellone per definire il periodo della ricerca.
        </p>
      </div>

      {renderQueryGrid()}
      {isModalOpen && <QueryModal />}

      {loading && (
        <div className={styles.loadingIndicator}>
          <p>Caricamento risultati...</p>
        </div>
      )}

      {!loading && !isModalOpen && error && (
        <p className={styles.error}>{error}</p>
      )}

      {!loading && !isModalOpen && results && searchParams && (
        <div className={styles.resultsContainer}>
          <h2>
            Risultati per {searchParams.codeParasol}
            <span className={styles.dateRange}>
              {" "}
              (dal {formatDateSimple(searchParams.startDate)} al{" "}
              {formatDateSimple(searchParams.endDate)}){" "}
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
              {results.map((item, index) => {
                return (
                  <React.Fragment
                    key={`${item.date}-${item.periodDisplay}-${index}-group`}
                  >
                    <li
                      key={`${item.date}-${item.periodDisplay}-${index}-item`}
                    >
                      <div>
                        {formatDateSimple(item.date)}

                        {item.status === "Prenotato" && item.customer ? (
                          <>
                            <strong className={styles.prenotato}>
                              {" "}
                              Prenotato
                            </strong>
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
                              {" ("}
                              {item.customer.condition === "jour entier"
                                ? "Giorno Intero"
                                : item.customer.condition === "matin"
                                ? "Mattina"
                                : item.customer.condition === "apres-midi"
                                ? "Pomeriggio"
                                : item.customer.condition || "N/D"}
                              {")"}
                            </span>
                            {/* Affichage des détails supplémentaires */}
                            <span className={styles.customerDetails}>
                              {` - Lettini: ${item.customer.numBeds}`}
                              {item.customer.registiPoltrona &&
                                ` - Supplemento: ${formatExtra(
                                  item.customer.registiPoltrona
                                )}`}
                              {item.customer.cabina &&
                                ` - Cabina: ${item.customer.cabina}`}
                              {` - `}
                              <span className={styles.customerName}>
                                {`${item.customer.firstName} ${item.customer.lastName}`}
                              </span>
                            </span>
                          </>
                        ) : (
                          <strong className={styles.libero}> Libero</strong>
                        )}
                      </div>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Query;
