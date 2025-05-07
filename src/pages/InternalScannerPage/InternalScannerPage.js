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
      let codeValue = result.getText();
      console.log("Code brut scanné en interne:", codeValue); // Log du code brut

      // Essayer d'extraire le paramètre 'code' si c'est une URL
      try {
        // Vérifier si codeValue est une chaîne et non null/undefined avant de créer l'URL
        if (typeof codeValue === "string" && codeValue) {
          const url = new URL(codeValue); // Peut lever une erreur si codeValue n'est pas une URL valide
          const params = new URLSearchParams(url.search);
          if (params.has("code")) {
            codeValue = params.get("code");
            console.log("Code extrait de l'URL:", codeValue);
          } else {
            console.log(
              "URL scannée, mais pas de paramètre 'code' trouvé. Utilisation de la valeur brute:",
              codeValue
            );
          }
        }
      } catch (e) {
        // Si ce n'est pas une URL valide (ex: c'est déjà "A01"), on suppose que c'est directement le code
        console.log(
          "La valeur scannée n'est pas une URL valide ou erreur de parsing, utilisation directe:",
          codeValue
        );
      }

      setScannedCode(codeValue);
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
