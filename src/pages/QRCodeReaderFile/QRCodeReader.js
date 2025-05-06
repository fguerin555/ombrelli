import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode"; // Import pour html5-qrcode
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase"; // Ajuste le chemin vers ta config firebase
import styles from "./QRCodeReader.module.css"; // Importe le CSS module
import "../../Global.css"; // Si tu as des styles globaux

const QRCodeReader = () => {
  const [scannedCode, setScannedCode] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const qrCodeRegionId = "qr-code-reader-region";

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

  // --- Effet pour chercher les réservations quand un code est scanné ---
  useEffect(() => {
    const fetchReservations = async () => {
      if (!scannedCode) {
        setReservations([]); // Vide les réservations si pas de code scanné
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

  // --- Effet pour gérer le cycle de vie du scanner ---
  useEffect(() => {
    let scannerInstance = null; // Variable locale pour cette instance de l'effet

    if (isScanning) {
      // Le div avec qrCodeRegionId est maintenant dans le DOM car isScanning est true
      scannerInstance = new Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
        },
        /* verbose= */ false
      );

      const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`Code trouvé ! ${decodedText}`, decodedResult);
        setScannedCode(decodedText);
        // setIsScanning(false) va déclencher le nettoyage de cet effet,
        // qui appellera scannerInstance.clear()
        setIsScanning(false);
      };

      const onScanFailure = (errorMessage) => {
        // Gérer les échecs de scan (souvent des "QR code not found")
        // console.warn(`Échec du scan QR : ${errorMessage}`);
      };

      scannerInstance
        .render(onScanSuccess, onScanFailure)
        .catch((renderError) => {
          console.error("Erreur lors du rendu du scanner:", renderError);
          setError(`Impossibile avviare lo scanner: ${renderError.message}`);
          setIsScanning(false); // Assure que le mode scan est désactivé en cas d'erreur
        });
    }

    // Fonction de nettoyage pour arrêter le scanner lors du démontage du composant
    // ou lorsque isScanning devient false
    return () => {
      if (scannerInstance) {
        scannerInstance.clear().catch((clearError) => {
          // Il est possible que clear() soit appelé sur une instance déjà nettoyée ou non rendue,
          // donc on logue l'erreur mais on ne la considère pas comme critique.
          console.warn(
            "Avertissement lors du nettoyage du scanner (clear):",
            clearError
          );
        });
      }
    };
  }, [isScanning]); // Dépend de isScanning.

  const startScanning = () => {
    setIsScanning(true);
    setError(""); // Réinitialise les erreurs
    setScannedCode(null); // Réinitialise le code scanné précédent
    setReservations([]); // Vide les réservations précédentes
  };

  const handleNewScanChoice = (choice) => {
    if (choice === "Si") {
      startScanning(); // Relance un nouveau scan
    } else {
      // Si "No", on ne fait rien de spécial, l'utilisateur peut quitter la page ou autre
      // On s'assure que le mode scan est désactivé
      setIsScanning(false);
      setScannedCode(null); // Optionnel: effacer le dernier code si on ne veut plus l'afficher
      setReservations([]);
    }
  };

  return (
    <div className={styles.QRCodeReaderPage}>
      <div className={styles.Titre}>
        <h1>Scanner QR Code Parasole</h1>
      </div>

      {/* Conteneur où le scanner sera rendu, uniquement si isScanning est true */}
      {isScanning && (
        <div id={qrCodeRegionId} className={styles.scannerRegion}></div>
      )}

      {/* Bouton "Scan" : s'affiche si on n'est pas en train de scanner ET qu'aucun code n'a été traité */}
      {!isScanning && !scannedCode && (
        <button onClick={startScanning} className={styles.scanButton}>
          Scan
        </button>
      )}

      {/* Affichage du code scanné, des résultats et des options "Nuovo Scan?" */}
      {/* S'affiche si un code a été scanné ET qu'on n'est PAS en train de scanner activement */}
      {!isScanning && scannedCode && (
        <>
          {isLoading && <p>Ricerca prenotazioni in corso...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}

          {!isLoading && reservations.length > 0 && (
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

          {!isLoading && ( // N'afficher les boutons "Nuovo Scan?" qu'après le chargement
            <div className={styles.newScanPrompt}>
              <p>Nuovo Scan?</p>
              <div className={styles.buttonGroup}>
                <button
                  onClick={() => handleNewScanChoice("Si")}
                  className={styles.newScanButton}
                >
                  Si
                </button>
                <button
                  onClick={() => handleNewScanChoice("No")}
                  className={styles.newScanButton}
                >
                  No
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QRCodeReader;
