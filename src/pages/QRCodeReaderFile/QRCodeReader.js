import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import styles from "./QRCodeReader.module.css";
import "../../Global.css";

const QRCodeReader = () => {
  const [scannedCode, setScannedCode] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const qrCodeRegionId = "qr-code-reader-region";

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
      case "apres-midi":
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

  useEffect(() => {
    const fetchReservations = async () => {
      if (!scannedCode) return;

      setIsLoading(true);
      setError("");
      setReservations([]);

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

        setReservations(foundReservations);

        if (foundReservations.length === 0) {
          setError(
            `Nessuna prenotazione attiva trovata per il parasole ${scannedCode}.`
          );
        }
      } catch (err) {
        setError(
          "Si è verificato un errore durante la ricerca delle prenotazioni."
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchReservations();
  }, [scannedCode]);

  useEffect(() => {
    let html5QrCodeScanner;

    const startScanning = () => {
      setIsScanning(true);
      setError("");

      html5QrCodeScanner = new Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
        },
        false
      );

      const onScanSuccess = (decodedText, decodedResult) => {
        setScannedCode(decodedText);
        setError("");
        stopScanning();
      };

      const onScanFailure = (errorMessage) => {
        // (Optional) Handle scan failures, e.g., show a message
      };

      html5QrCodeScanner
        .render(onScanSuccess, onScanFailure)
        .catch((renderError) => {
          setError(`Impossibile avviare lo scanner: ${renderError.message}`);
          stopScanning();
        });
    };

    const stopScanning = () => {
      setIsScanning(false);
      if (html5QrCodeScanner) {
        html5QrCodeScanner.stop().catch((err) => {
          console.error("Error stopping scanner:", err);
        });
      }
    };

    if (isScanning) {
      startScanning();
    }

    return () => {
      if (html5QrCodeScanner) {
        html5QrCodeScanner.stop().catch((err) => {
          console.error("Error stopping scanner on unmount:", err);
        });
      }
    };
  }, [isScanning]);

  const newScan = (choice) => {
    if (choice === "Si") {
      setScannedCode(null);
      setIsScanning(true); // Start a new scan immediately
    } else {
      setIsScanning(false); // Stop scanning if "No" is chosen
    }
  };

  return (
    <div className={styles.QRCodeReaderPage}>
      <div className={styles.Titre}>
        <h1>Scanner QR Code Parasole</h1>
      </div>

      {isScanning && (
        <div id={qrCodeRegionId} className={styles.scannerRegion}></div>
      )}

      {!isScanning && !scannedCode && (
        <button
          onClick={() => setIsScanning(true)}
          className={styles.scanButton}
        >
          Scan
        </button>
      )}

      {scannedCode && (
        <>
          {isLoading && <p>Ricerca prenotazioni in corso...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}
          {reservations.length > 0 && (
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

          <div className={styles.buttonGroup}>
            <button
              onClick={() => newScan("Si")}
              className={styles.newScanButton}
            >
              Si
            </button>
            <button
              onClick={() => newScan("No")}
              className={styles.newScanButton}
            >
              No
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default QRCodeReader;
