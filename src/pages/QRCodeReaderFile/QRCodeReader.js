import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode"; // Import pour html5-qrcode
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase"; // Ajuste le chemin vers ta config firebase
import styles from "./QRCodeReader.module.css"; // Importe le CSS module
import "../../Global.css"; // Si tu as des styles globaux

const QRCodeReader = () => {
  const [scannedCode, setScannedCode] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const qrCodeRegionId = "qr-code-reader-region"; // ID pour le conteneur du scanner

  // --- Fonctions utilitaires (copiées/adaptées de TestQueryName.js) ---
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
  // --- Fin des fonctions utilitaires ---

  // Effet pour chercher les réservations quand un code est scanné
  useEffect(() => {
    const fetchReservations = async () => {
      if (!scannedCode) return;

      setIsLoading(true);
      setError("");
      setReservations([]); // Vide les résultats précédents
      console.log(
        `Recherche des réservations pour le code parasol : ${scannedCode}`
      );

      try {
        const reservationsRef = collection(db, "reservations");
        // Requête pour trouver les réservations actives correspondant au cellCode, triées par date de début
        const q = query(
          reservationsRef,
          where("cellCode", "==", scannedCode),
          where("status", "==", "active"), // Optionnel: ne montrer que les actives ?
          orderBy("startDate") // Trier par date de début
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
  }, [scannedCode]); // Se déclenche quand scannedCode change

  // Effet pour initialiser et nettoyer le scanner
  useEffect(() => {
    let html5QrCodeScanner; // Déclare la variable ici pour qu'elle soit accessible dans le cleanup

    // Ne démarrer le scanner que si aucun code n'a été scanné récemment
    if (!scannedCode) {
      html5QrCodeScanner = new Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10, // Images par seconde pour le scan
          qrbox: { width: 250, height: 250 }, // Taille de la boîte de scan (optionnel)
          rememberLastUsedCamera: true, // Se souvenir de la dernière caméra utilisée
          // supportedScanTypes: [ // Décommenter si besoin de spécifier les types
          //    Html5QrcodeScanType.SCAN_TYPE_CAMERA,
          // ]
        },
        /* verbose= */ false
      );

      const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`Code trouvé ! ${decodedText}`, decodedResult);
        // Mettre à jour l'état AVANT d'essayer de nettoyer
        setScannedCode(decodedText);
        setError("");
        // Le nettoyage se fera via la fonction de retour du useEffect
      };

      const onScanFailure = (errorMessage) => {
        // console.warn(`Échec du scan QR : ${errorMessage}`);
      };

      html5QrCodeScanner
        .render(onScanSuccess, onScanFailure)
        .catch((renderError) => {
          // Gérer les erreurs potentielles au démarrage du rendu (ex: caméra non trouvée)
          console.error("Erreur lors du rendu du scanner:", renderError);
          setError(`Impossibile avviare lo scanner: ${renderError.message}`);
        });
    }

    // Fonction de nettoyage
    return () => {
      // Vérifie si le scanner a été initialisé avant de tenter de le nettoyer
      if (
        html5QrCodeScanner &&
        typeof html5QrCodeScanner.clear === "function"
      ) {
        html5QrCodeScanner
          .clear()
          .then(() => {
            console.log("Scanner nettoyé avec succès.");
          })
          .catch((error) => {
            // Ne pas bloquer si le nettoyage échoue (peut arriver si déjà nettoyé ou non rendu)
            console.warn("Avertissement lors du nettoyage du scanner.", error);
          });
      } else {
        console.log(
          "Nettoyage du scanner non nécessaire ou scanner non initialisé."
        );
      }
    };
  }, [scannedCode]); // Redémarre le scanner si scannedCode est remis à null

  return (
    <div className={styles.QRCodeReaderPage}>
      <div className={styles.Titre}>
        <h1>Scanner QR Code Parasole</h1>
      </div>

      {/* Conteneur où le scanner sera rendu */}
      {!scannedCode && (
        <div id={qrCodeRegionId} className={styles.scannerRegion}></div>
      )}

      {/* Bouton pour réactiver le scan */}
      {scannedCode && !isLoading && (
        <button
          onClick={() => {
            setScannedCode(null);
            setReservations([]);
            setError("");
          }}
          className={styles.rescanButton}
        >
          Scansiona un altro codice
        </button>
      )}

      {/* Affichage chargement, erreurs et résultats */}
      {isLoading && <p>Ricerca prenotazioni in corso...</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}

      {reservations.length > 0 && (
        <div className={styles.resultsContainer}>
          <h2>Prenotazioni per Parasole {scannedCode}:</h2>
          {reservations.map((res) => (
            <div key={res.id} className={styles.reservationCard}>
              <p>
                <strong>Cliente:</strong> {res.prenom} {res.nom}
              </p>
              <p>
                <strong>Periodo:</strong> {formatDateEU(res.startDate)} -{" "}
                {formatDateEU(res.endDate)}
              </p>
              <p>
                <strong>Condizione:</strong>{" "}
                <span style={getConditionStyle(res.condition)}>
                  {formatCondition(res.condition)}
                </span>
              </p>
              <p>
                <strong>Lettini:</strong> {res.numBeds || 0}
              </p>
              <p>
                <strong>P/R:</strong> {res.registiPoltrona || "No"}
              </p>
              <p>
                <strong>Cabina:</strong> {res.cabina || "No"}
              </p>
              {/* Tu peux ajouter d'autres champs si nécessaire */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRCodeReader; // Assure-toi que le nom exporté correspond au nom du composant
