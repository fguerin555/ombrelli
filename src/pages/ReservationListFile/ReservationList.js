import React, { useMemo } from "react";
import "../../Global.css";
import styles from "./ReservationList.module.css";

// Helper function to format details
const formatDetails = (reservation) => {
  if (!reservation) return ""; // For blank rows
  const beds = reservation.numBeds || 0;
  const rp = reservation.registiPoltrona
    ? ` / ${reservation.registiPoltrona}`
    : "";
  return `${beds}${rp}`;
};

// Helper function for sorting cell codes (A01, A02, ..., B01, ...)
const sortCellCodes = (a, b) => {
  const rowA = a.charAt(0);
  const rowB = b.charAt(0);
  const numA = parseInt(a.slice(1), 10);
  const numB = parseInt(b.slice(1), 10);

  if (rowA < rowB) return -1;
  if (rowA > rowB) return 1;
  return numA - numB;
};

const ReservationList = ({ reservations, selectedDate, onClose }) => {
  const processedRows = useMemo(() => {
    const relevantReservations = reservations.filter(
      (res) => selectedDate >= res.startDate && selectedDate <= res.endDate
    );

    const reservationsByCell = {};

    // Group reservations by cellCode for the selected date
    relevantReservations.forEach((res) => {
      if (!reservationsByCell[res.cellCode]) {
        reservationsByCell[res.cellCode] = {
          morning: null,
          afternoon: null,
          fullDay: null,
        };
      }

      // Check if it's a single-day reservation for the selected date
      const isSingleDayOnSelected =
        res.startDate === selectedDate && res.endDate === selectedDate;

      if (res.condition === "jour entier") {
        reservationsByCell[res.cellCode].fullDay = res;
      } else if (res.condition === "matin" && isSingleDayOnSelected) {
        reservationsByCell[res.cellCode].morning = res;
      } else if (res.condition === "apres-midi" && isSingleDayOnSelected) {
        reservationsByCell[res.cellCode].afternoon = res;
      } else if (
        res.condition !== "jour entier" &&
        !isSingleDayOnSelected &&
        selectedDate >= res.startDate &&
        selectedDate <= res.endDate
      ) {
        // If a multi-day reservation is NOT 'jour entier', treat it as full day for listing purposes on intermediate days
        reservationsByCell[res.cellCode].fullDay = res; // Or handle as error? Assuming multi-day should be 'jour entier'
      }
    });

    const finalRows = [];

    // Get sorted cell codes
    const sortedCellCodes = Object.keys(reservationsByCell).sort(sortCellCodes);

    sortedCellCodes.forEach((cellCode) => {
      const data = reservationsByCell[cellCode];
      const fullDayRes = data.fullDay;
      const morningRes = data.morning;
      const afternoonRes = data.afternoon;

      if (fullDayRes) {
        // Full day reservation takes precedence
        finalRows.push({
          key: `${cellCode}-fullday`,
          cellCode: cellCode,
          cognome: fullDayRes.nom || "",
          nome: fullDayRes.prenom || "",
          periodo: "Giorno", // Whole Day
          details: formatDetails(fullDayRes),
          sortOrder: 2, // Middle sort order for full day
        });
      } else {
        // Handle morning/afternoon
        const hasMorning = !!morningRes;
        const hasAfternoon = !!afternoonRes;

        if (hasMorning && hasAfternoon) {
          // Both exist, add both rows
          finalRows.push({
            key: `${cellCode}-morning`,
            cellCode: cellCode,
            cognome: morningRes.nom || "",
            nome: morningRes.prenom || "",
            periodo: "Mattina", // Morning
            details: formatDetails(morningRes),
            sortOrder: 1, // Morning first
          });
          finalRows.push({
            key: `${cellCode}-afternoon`,
            cellCode: cellCode,
            cognome: afternoonRes.nom || "",
            nome: afternoonRes.prenom || "",
            periodo: "Pomeriggio", // Afternoon
            details: formatDetails(afternoonRes),
            sortOrder: 3, // Afternoon last
          });
        } else if (hasMorning) {
          // Only morning exists, add morning row + blank afternoon row
          finalRows.push({
            key: `${cellCode}-morning`,
            cellCode: cellCode,
            cognome: morningRes.nom || "",
            nome: morningRes.prenom || "",
            periodo: "Mattina",
            details: formatDetails(morningRes),
            sortOrder: 1,
          });
          finalRows.push({
            // Blank afternoon row
            key: `${cellCode}-afternoon-blank`,
            cellCode: cellCode,
            cognome: "",
            nome: "",
            periodo: "Pomeriggio",
            details: "",
            isBlank: true, // Flag for styling
            sortOrder: 3,
          });
        } else if (hasAfternoon) {
          // Only afternoon exists, add blank morning row + afternoon row
          finalRows.push({
            // Blank morning row
            key: `${cellCode}-morning-blank`,
            cellCode: cellCode,
            cognome: "",
            nome: "",
            periodo: "Mattina",
            details: "",
            isBlank: true,
            sortOrder: 1,
          });
          finalRows.push({
            key: `${cellCode}-afternoon`,
            cellCode: cellCode,
            cognome: afternoonRes.nom || "",
            nome: afternoonRes.prenom || "",
            periodo: "Pomeriggio",
            details: formatDetails(afternoonRes),
            sortOrder: 3,
          });
        }
        // If neither morning nor afternoon (shouldn't happen with current logic if cellCode is in keys), do nothing
      }
    });

    // Final sort: primarily by cellCode, secondarily by sortOrder (Mattina -> Giorno -> Pomeriggio)
    // The main sort is already done by iterating sortedCellCodes. We just need internal order.
    // The sortOrder property handles the internal order (blank morning, real morning, full day, blank afternoon, real afternoon)

    return finalRows;
  }, [reservations, selectedDate]);

  return (
    <div className={styles.listOverlay}>
      <div className={styles.listContainer}>
        <div className={styles.listHeader}>
          <h2>Lista Prenotazioni per il {selectedDate}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            Chiudi
          </button>
          <button onClick={() => window.print()} className={styles.printButton}>
            Stampa
          </button>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.reservationTable}>
            <thead>
              <tr>
                <th>Ombrello</th>
                <th>Cognome</th>
                <th>Nome</th>
                <th>Periodo</th>
                <th>Dettagli (Lettini / R/P)</th>
              </tr>
            </thead>
            <tbody>
              {processedRows.length > 0 ? (
                processedRows.map((row) => (
                  <tr
                    key={row.key}
                    className={row.isBlank ? styles.blankRow : ""}
                  >
                    <td>{row.cellCode}</td>
                    <td>{row.cognome}</td>
                    <td>{row.nome}</td>
                    <td>{row.periodo}</td>
                    <td>{row.details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    Nessuna prenotazione trovata per questa data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReservationList;
