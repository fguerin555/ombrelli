import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase"; // Ajuste le chemin vers ta config firebase
import styles from "./QRCodeReader.module.css"; // Importe le CSS module
import "../../Global.css"; // Si tu as des styles globaux

const QRCodeReader = ({ initialCodeFromUrl }) => {
  console.log(
    "QRCodeReader - Prop initialCodeFromUrl reçue:",
    initialCodeFromUrl
  );
  const [scannedCode, setScannedCode] = useState(initialCodeFromUrl || null);
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  console.log(
    "QRCodeReader - État scannedCode (initial ou après set):",
    scannedCode
  );

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

  // Met à jour scannedCode si la prop initialCodeFromUrl change
  useEffect(() => {
    if (initialCodeFromUrl) {
      console.log(
        "QRCodeReader - useEffect[initialCodeFromUrl] - Mise à jour de scannedCode avec:",
        initialCodeFromUrl
      );
      setScannedCode(initialCodeFromUrl);
    } else {
      console.log(
        "QRCodeReader - useEffect[initialCodeFromUrl] - initialCodeFromUrl est null/undefined, réinitialisation de scannedCode."
      );
      setScannedCode(null);
      setReservations([]);
      setError("");
    }
  }, [initialCodeFromUrl]);

  // --- Effet pour chercher les réservations quand un code est scanné ---
  useEffect(() => {
    const fetchReservations = async () => {
      console.log(
        "QRCodeReader - useEffect[scannedCode] - Début de fetchReservations. scannedCode actuel:",
        scannedCode
      );
      if (!scannedCode) {
        setReservations([]);
        setError("");
        return;
      }

      setIsLoading(true);
      setError("");
      setReservations([]);
      console.log(
        `Recherche des réservations pour le code parasol : ${scannedCode}`
      );

      try {
        const reservationsRef = collection(db, "reservations");
        console.log(
          "QRCodeReader - fetchReservations - Requête Firestore pour cellCode:",
          scannedCode
        );
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

        console.log(
          `QRCodeReader - fetchReservations - Trouvé ${foundReservations.length} réservations:`,
          foundReservations
        );
        setReservations(foundReservations);

        if (foundReservations.length === 0) {
          setError(
            `Nessuna prenotazione attiva trovata per il parasole ${scannedCode}.`
          );
        }
      } catch (err) {
        console.error(
          "QRCodeReader - fetchReservations - Errore durante il recupero delle prenotazioni:",
          err
        );
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
        <h1>Dettagli Prenotazione Ombrellone</h1>
      </div>

      {!scannedCode && !isLoading && !error && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <p>
            Scansiona un QR code con lo scanner del tuo smartphone per
            visualizzare i dettagli della prenotazione.
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
                  <p>
                    <strong>Numero di lettini:</strong> {reservation.numBeds}
                  </p>
                  <p>
                    <strong>Supp Poltrona/Regista:</strong>{" "}
                    {reservation.registiPoltrona}
                  </p>
                  <p>
                    <strong>Cabina:</strong> {reservation.cabina}
                  </p>
                  {/* Ici, nous ajouterons les nouvelles informations plus tard */}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QRCodeReader;
