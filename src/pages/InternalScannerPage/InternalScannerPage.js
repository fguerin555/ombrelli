import React, { useState } from "react";
import { useZxing } from "react-zxing";
import QRCodeReaderResults from "../QRCodeReaderFile/QRCodeReader"; // Notre composant existant
import styles from "./InternalScannerPage.module.css";

const InternalScannerPage = () => {
  const [scannedCode, setScannedCode] = useState(null);
  const [showScanner, setShowScanner] = useState(true); // Afficher le scanner par défaut
  const [scannerKey, setScannerKey] = useState(Date.now()); // Nouvel état pour la clé
  const [isScannerPaused, setIsScannerPaused] = useState(false);
  const [error, setError] = useState("");

  const { ref } = useZxing({
    paused: isScannerPaused, // Utiliser l'état pour contrôler la pause

    onDecodeResult: (result) => {
      let codeValue = result.getText();
      console.log("Code brut scanné en interne:", codeValue);

      try {
        if (typeof codeValue === "string" && codeValue) {
          const url = new URL(codeValue);
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
        console.log(
          "La valeur scannée n'est pas une URL valide ou erreur de parsing, utilisation directe:",
          codeValue
        );
      }

      setScannedCode(codeValue);
      setShowScanner(false); // Masquer le scanner après un scan réussi
      setIsScannerPaused(true); // Mettre en pause après un scan réussi
      setError(""); // Effacer les erreurs précédentes en cas de succès
    },
    onDecodeError: (decodeError) => {
      // Gérer les erreurs de décodage si nécessaire, mais souvent on les ignore
      // pour permettre de continuer à scanner.
      // console.error("Erreur de décodage:", decodeError);
      // setError("Impossible de décoder le QR code. Veuillez réessayer.");
    },
    onError: (error) => {
      // Gérer les erreurs d'initialisation de la caméra, etc.
      console.error("Erreur du scanner:", error);
      if (error.name === "NotAllowedError") {
        setError(
          "È richiesto l'accesso alla videocamera. Si prega di consentire l'accesso nelle impostazioni del browser."
        );
      } else {
        setError(
          "Errore durante l'inizializzazione della fotocamera. Assicurati che nessun'altra applicazione la stia usando o sia connessa."
        );
      }
      setShowScanner(false); // Masquer le scanner en cas d'erreur d'initialisation
    },
    constraints: { video: { facingMode: "environment" } }, // Utiliser la caméra arrière
    timeBetweenDecodingAttempts: 300, // Temps entre les tentatives de décodage
  });

  const handleRescan = () => {
    setScannedCode(null);
    setError("");
    setShowScanner(true); // Important: réactiver le scanner
    setIsScannerPaused(false); // Réactiver le scanner
    setScannerKey(Date.now()); // Changer la clé pour forcer le remontage de la vidéo
  };

  return (
    <div className={styles.internalScannerPage}>
      <h1>Scansiona un codice QR</h1>
      {error && <p className={styles.errorMessage}>{error}</p>}

      {showScanner && !error && (
        <div className={styles.scannerContainer}>
          <p>Puntare la fotocamera verso un codice QR.</p>
          <video
            key={scannerKey}
            ref={ref}
            className={styles.scannerVideo}
          />{" "}
          {/* Ajout de la prop key */}
        </div>
      )}

      {/* Bouton pour activer le scanner si masqué et pas d'erreur et pas de code scanné */}
      {!showScanner && !scannedCode && !error && (
        <button onClick={handleRescan} className={styles.actionButton}>
          Attivare lo scanner
        </button>
      )}

      {scannedCode && (
        <div className={styles.resultsSection}>
          <button onClick={handleRescan} className={styles.actionButton}>
            Scansiona un altro codice
          </button>
          <QRCodeReaderResults initialCodeFromUrl={scannedCode} />
        </div>
      )}
    </div>
  );
};

export default InternalScannerPage;
