import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase"; // Ajuste le chemin vers ta config firebase
import styles from "./QRCodeReader.module.css"; // Importe le CSS module
import "../../Global.css"; // Si tu as des styles globaux

const QRCodeReader = ({ initialCodeFromUrl }) => {
  const [scannedCode, setScannedCode] = useState(initialCodeFromUrl || null);
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Fonctions utilitaires ---
  const formatDateEU = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const [year, month, day] = dateString.split("-");
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  const formatCondition = (condition) => {
    switch (condition) {
      case "jour entier":
        return "Giorno intero";
      case "matin":
        return "Mattina";
      case "apres-midi": // Assure-toi que c'est bien "apres-midi" et non "après-midi" dans tes données
        return "Pomeriggio";
      default:
        return condition || "N/D";
    }
  };

  const getConditionStyle = (condition) => {
    switch (condition) {
      case "jour entier":
        return { color: "red", fontWeight: "bold" };
      case "matin":
        return { color: "blue", fontWeight: "bold" };
      case "apres-midi":
        return { color: "orange", fontWeight: "bold" };
      default:
        return {};
    }
  };

  // Met à jour scannedCode si la prop initialCodeFromUrl change (par exemple, si l'utilisateur navigue
  // vers la même page mais avec un code différent dans l'URL)
  useEffect(() => {
    if (initialCodeFromUrl) {
      setScannedCode(initialCodeFromUrl);
    } else {
      // Si initialCodeFromUrl devient null/undefined (par exemple, navigation vers une URL sans code),
      // on pourrait vouloir réinitialiser.
      setScannedCode(null);
      setReservations([]);
      setError("");
    }
  }, [initialCodeFromUrl]);

  // --- Effet pour chercher les réservations quand un code est scanné ---
  useEffect(() => {
    const fetchReservations = async () => {
      if (!scannedCode) {
        setReservations([]); // Vide les réservations si pas de code scanné
        setError(""); // Efface les erreurs précédentes
        return;
      }

      setIsLoading(true);
      setError("");
      setReservations([]); // Vide les résultats précédents
      console.log(
        `Recherche des réservations pour le code parasol : ${scannedCode}`
      );

      try {
        const reservationsRef = collection(db, "reservations");
        const q = query(
          reservationsRef,
          where("cellCode", "==", scannedCode),
          where("status", "==", "active"),
          orderBy("startDate")
        );

        const querySnapshot = await getDocs(q);
        const foundReservations = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log(`Trouvé ${foundReservations.length} réservations.`);
        setReservations(foundReservations);

        if (foundReservations.length === 0) {
          setError(
            `Nessuna prenotazione attiva trovata per il parasole ${scannedCode}.`
          );
        }
      } catch (err) {
        console.error("Errore durante il recupero delle prenotazioni:", err);
        setError(
          "Si è verificato un errore durante la ricerca delle prenotazioni."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [scannedCode]);

  return (
    <div className={styles.QRCodeReaderPage}>
      <div className={styles.Titre}>
        <h1>Dettagli Prenotazione Parasole</h1> {/* Titre mis à jour */}
      </div>

      {!scannedCode && !isLoading && !error && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <p>
            Scansiona un QR code per visualizzare i dettagli della prenotazione.
          </p>
          <p>(Assicurati che l'URL contenga un parametro come "?code=A01")</p>
        </div>
      )}

      {scannedCode && (
        <>
          {isLoading && (
            <p style={{ textAlign: "center", marginTop: "20px" }}>
              Ricerca prenotazioni in corso...
            </p>
          )}
          {error && <p className={styles.errorMessage}>{error}</p>}

          {!isLoading && !error && reservations.length > 0 && (
            <div className={styles.resultsContainer}>
              <h2>Prenotazioni per Parasole {scannedCode}:</h2>
              {reservations.map((reservation) => (
                <div key={reservation.id} className={styles.reservationCard}>
                  <p>
                    <strong>Nome:</strong> {reservation.nom}
                  </p>
                  <p>
                    <strong>Prénom:</strong> {reservation.prenom}
                  </p>
                  <p>
                    <strong>Date de début:</strong>{" "}
                    {formatDateEU(reservation.startDate)}
                  </p>
                  <p>
                    <strong>Date de fin:</strong>{" "}
                    {formatDateEU(reservation.endDate)}
                  </p>
                  <p>
                    <strong>Condition:</strong>{" "}
                    <span style={getConditionStyle(reservation.condition)}>
                      {formatCondition(reservation.condition)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
          {/* Si aucune réservation n'est trouvée mais qu'il n'y a pas d'erreur de chargement,
              l'erreur spécifique "Nessuna prenotazione..." sera déjà affichée par le bloc {error && ...}
              si elle a été définie.
          */}
        </>
      )}
    </div>
  );
};

export default QRCodeReader;
