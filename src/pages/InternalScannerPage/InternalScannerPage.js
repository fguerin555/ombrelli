import React, { useState } from "react";

import { useZxing } from "react-zxing";
import QRCodeReaderResults from "../QRCodeReaderFile/QRCodeReader"; // Notre composant existant
import styles from "./InternalScannerPage.module.css"; // Nous créerons ce fichier CSS

const InternalScannerPage = () => {
  const [scannedCode, setScannedCode] = useState(null);
  const [showScanner, setShowScanner] = useState(true);
  const [error, setError] = useState("");

  const { ref } = useZxing({
    onDecodeResult: (result) => {
      const code = result.getText();
      console.log("Code scanné en interne:", code);
      setScannedCode(code);
      setShowScanner(false); // Masquer le scanner après un scan réussi
      setError("");
    },
    onDecodeError: (decodeError) => {
      // Gérer les erreurs de décodage si nécessaire, mais souvent on les ignore pour permettre de continuer à scanner
      // console.error("Erreur de décodage:", decodeError);
      // setError("Impossible de décoder le QR code. Veuillez réessayer.");
    },
    onError: (error) => {
      // Gérer les erreurs d'initialisation de la caméra, etc.
      console.error("Erreur du scanner:", error);
      if (error.name === "NotAllowedError") {
        setError(
          "L'accès à la caméra est requis. Veuillez autoriser l'accès dans les paramètres de votre navigateur."
        );
      } else {
        setError(
          "Erreur lors de l'initialisation de la caméra. Assurez-vous qu'aucune autre application ne l'utilise."
        );
      }
      setShowScanner(false);
    },
    constraints: { video: { facingMode: "environment" } }, // Utiliser la caméra arrière
    timeBetweenDecodingAttempts: 300, // Temps entre les tentatives de décodage
  });

  const handleRescan = () => {
    setScannedCode(null);
    setError("");
    setShowScanner(true);
  };

  return (
    <div className={styles.internalScannerPage}>
      <h1>Scanner un QR Code</h1>
      {error && <p className={styles.errorMessage}>{error}</p>}

      {showScanner && !error && (
        <div className={styles.scannerContainer}>
          <p>Pointez la caméra vers un QR code.</p>
          <video ref={ref} className={styles.scannerVideo} />
        </div>
      )}

      {!showScanner && !scannedCode && !error && (
        <button onClick={handleRescan} className={styles.actionButton}>
          Activer le Scanner
        </button>
      )}

      {scannedCode && (
        <div className={styles.resultsSection}>
          <button onClick={handleRescan} className={styles.actionButton}>
            Scanner un autre code
          </button>
          <QRCodeReaderResults initialCodeFromUrl={scannedCode} />
        </div>
      )}
    </div>
  );
};

export default InternalScannerPage;
