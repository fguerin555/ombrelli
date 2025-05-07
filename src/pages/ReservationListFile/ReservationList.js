// src/pages/ReservationListFile/ReservationList.js
import React from "react";
import styles from "./ReservationList.module.css"; // Assurez-vous d'avoir un fichier CSS

const ReservationList = ({
  reservations, // Toutes les réservations
  selectedDate, // La date sélectionnée
  onClose, // Fonction pour fermer
  rows, // Les lignes (ex: ['A', 'B', 'C', 'D'])
  columns, // Les colonnes (ex: ['01', '02', ..., '36'])
}) => {
  // Fonction helper pour obtenir les détails d'une réservation pour une demi-journée
  const getHalfDayReservationDetails = (cellCode, halfDay) => {
    const validReservations = Array.isArray(reservations) ? reservations : [];
    const relevantReservations = validReservations.filter(
      (res) =>
        res.cellCode === cellCode &&
        res.startDate &&
        res.endDate &&
        selectedDate >= res.startDate &&
        selectedDate <= res.endDate
    );

    let foundRes = null;
    if (halfDay === "matin") {
      foundRes = relevantReservations.find(
        (res) => res.condition === "matin" || res.condition === "jour entier"
      );
    } else if (halfDay === "apres-midi") {
      foundRes = relevantReservations.find(
        (res) =>
          res.condition === "apres-midi" || res.condition === "jour entier"
      );
    }

    if (foundRes) {
      return {
        nom: foundRes.nom || "",
        prenom: foundRes.prenom || "",
        numBeds: foundRes.numBeds !== undefined ? foundRes.numBeds : "",
        cabina: foundRes.cabina || "",
        registiPoltrona: foundRes.registiPoltrona || "",
        serialNumber: foundRes.serialNumber || "",
        conditionSpecific: foundRes.condition,
        startDate: foundRes.startDate,
        endDate: foundRes.endDate,
      };
    } else {
      return {
        nom: "",
        prenom: "",
        numBeds: "",
        cabina: "",
        registiPoltrona: "",
        serialNumber: "",
        conditionSpecific: null,
        startDate: "",
        endDate: "",
      };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error("Erreur de formatage de date:", e);
      return dateStr;
    }
  };

  const formatExtra = (code) => {
    if (code === "R") return "Regista";
    if (code === "P") return "Poltrona";
    return "";
  };

  return (
    <div className={styles.listOverlay}>
      <div className={styles.listContainer}>
        <div className={styles.listHeader}>
          <h2>Lista Prenotazioni per il {formatDate(selectedDate)}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            Chiudi
          </button>
          <button onClick={() => window.print()} className={styles.printButton}>
            Stampa Lista
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.reservationTable}>
            <thead>
              <tr>
                <th>Ombrellone</th>
                <th>Condizione</th>
                <th>Cognome</th>
                <th>Nome</th>
                <th>Lettini</th>
                <th>Extra</th>
                <th>Cabina</th>
                <th>Periodo prenotazione</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(rows) &&
                Array.isArray(columns) &&
                rows.flatMap(
                  (
                    row // Utilisation de flatMap pour la boucle extérieure
                  ) =>
                    columns.map((col) => {
                      const cellCode = `${row}${col}`;
                      const morningDetails = getHalfDayReservationDetails(
                        cellCode,
                        "matin"
                      );
                      const afternoonDetails = getHalfDayReservationDetails(
                        cellCode,
                        "apres-midi"
                      );

                      const isFullDaySameRes =
                        morningDetails.serialNumber &&
                        afternoonDetails.serialNumber &&
                        morningDetails.serialNumber ===
                          afternoonDetails.serialNumber &&
                        morningDetails.conditionSpecific === "jour entier";

                      if (isFullDaySameRes) {
                        return (
                          <tr
                            key={`${cellCode}-FD`}
                            className={styles.bookedRow}
                          >
                            <td>{cellCode}</td>
                            <td>Giorno Intero</td>
                            <td>{morningDetails.nom}</td>
                            <td>{morningDetails.prenom}</td>
                            <td>{morningDetails.numBeds}</td>
                            <td>
                              {formatExtra(morningDetails.registiPoltrona)}
                            </td>
                            <td>{morningDetails.cabina}</td>
                            <td className={styles.dateCell}>
                              {formatDate(morningDetails.startDate)} -{" "}
                              {formatDate(morningDetails.endDate)}
                            </td>
                          </tr>
                        );
                      }

                      // Cas: Matin et/ou Après-midi
                      // Retourne un React.Fragment contenant les deux lignes
                      return (
                        <React.Fragment key={`${cellCode}-Group`}>
                          <tr
                            key={`${cellCode}-M`}
                            className={
                              morningDetails.serialNumber
                                ? styles.bookedRow
                                : styles.freeRow
                            }
                          >
                            <td>{cellCode}</td>
                            <td>Mattina</td>
                            <td>{morningDetails.nom}</td>
                            <td>{morningDetails.prenom}</td>
                            <td>{morningDetails.numBeds}</td>
                            <td>
                              {formatExtra(morningDetails.registiPoltrona)}
                            </td>
                            <td>{morningDetails.cabina}</td>
                            <td className={styles.dateCell}>
                              {morningDetails.nom
                                ? `${formatDate(
                                    morningDetails.startDate
                                  )} - ${formatDate(morningDetails.endDate)}`
                                : ""}
                            </td>
                          </tr>
                          <tr
                            key={`${cellCode}-A`}
                            className={`${
                              afternoonDetails.serialNumber
                                ? styles.bookedRow
                                : styles.freeRow
                            } ${styles.afternoonRow}`}
                          >
                            <td></td>{" "}
                            {/* Cellule vide pour l'alignement, masquée par CSS si besoin */}
                            <td>Pomeriggio</td>
                            <td>{afternoonDetails.nom}</td>
                            <td>{afternoonDetails.prenom}</td>
                            <td>{afternoonDetails.numBeds}</td>
                            <td>
                              {formatExtra(afternoonDetails.registiPoltrona)}
                            </td>
                            <td>{afternoonDetails.cabina}</td>
                            <td className={styles.dateCell}>
                              {afternoonDetails.nom
                                ? `${formatDate(
                                    afternoonDetails.startDate
                                  )} - ${formatDate(afternoonDetails.endDate)}`
                                : ""}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReservationList;
