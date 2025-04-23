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
    const relevantReservations = reservations.filter(
      (res) =>
        res.cellCode === cellCode &&
        res.startDate && // Vérification existence dates
        res.endDate &&
        selectedDate >= res.startDate &&
        selectedDate <= res.endDate
    );

    let foundRes = null;
    if (halfDay === "matin") {
      // Cherche une résa 'matin' ou 'jour entier'
      foundRes = relevantReservations.find(
        (res) => res.condition === "matin" || res.condition === "jour entier"
      );
    } else if (halfDay === "apres-midi") {
      // Cherche une résa 'apres-midi' ou 'jour entier'
      foundRes = relevantReservations.find(
        (res) =>
          res.condition === "apres-midi" || res.condition === "jour entier"
      );
    }

    if (foundRes) {
      return {
        nom: foundRes.nom || "",
        prenom: foundRes.prenom || "",
        numBeds: foundRes.numBeds !== undefined ? foundRes.numBeds : "", // Affiche vide si undefined
        serialNumber: foundRes.serialNumber || "",
        conditionSpecific: foundRes.condition, // Pour savoir si c'était matin/apresmidi/jour entier
      };
    } else {
      // Retourne des champs vides si non réservé
      return {
        nom: "",
        prenom: "",
        numBeds: "",
        serialNumber: "",
        conditionSpecific: null,
      };
    }
  };

  // Formater la date pour l'affichage du titre
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
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
          {" "}
          {/* Conteneur pour le défilement */}
          <table className={styles.reservationTable}>
            <thead>
              <tr>
                <th>Ombrellone</th>
                <th>Condizione</th>
                <th>Cognome</th>
                <th>Nome</th>
                <th>Lettini</th>
                <th>N° Pren.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
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

                  // --- LIGNE isCompletelyFree SUPPRIMÉE CAR INUTILISÉE ---

                  // Détermine si c'est réservé toute la journée par la même réservation
                  const isFullDaySameRes =
                    morningDetails.serialNumber &&
                    afternoonDetails.serialNumber &&
                    morningDetails.serialNumber ===
                      afternoonDetails.serialNumber &&
                    morningDetails.conditionSpecific === "jour entier";

                  // Si réservé toute la journée par la même réservation, afficher une seule ligne fusionnée visuellement
                  if (isFullDaySameRes) {
                    return (
                      <tr key={`${cellCode}-FD`} className={styles.bookedRow}>
                        <td>{cellCode}</td>
                        <td>Giorno Intero</td>
                        <td>{morningDetails.nom}</td>
                        <td>{morningDetails.prenom}</td>
                        <td>{morningDetails.numBeds}</td>
                        <td>{morningDetails.serialNumber}</td>
                      </tr>
                    );
                  }

                  // Sinon, afficher les deux lignes (matin et après-midi)
                  return (
                    <React.Fragment key={cellCode}>
                      {/* Ligne Matin */}
                      <tr
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
                        <td>{morningDetails.serialNumber}</td>
                      </tr>
                      {/* Ligne Après-midi */}
                      <tr
                        className={
                          afternoonDetails.serialNumber
                            ? styles.bookedRow
                            : styles.freeRow
                        }
                      >
                        <td></td> {/* Laisser vide pour alignement visuel */}
                        <td>Pomeriggio</td>
                        <td>{afternoonDetails.nom}</td>
                        <td>{afternoonDetails.prenom}</td>
                        <td>{afternoonDetails.numBeds}</td>
                        <td>{afternoonDetails.serialNumber}</td>
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
