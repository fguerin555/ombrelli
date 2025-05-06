import React from "react";
import { useSearchParams } from "react-router-dom";
import QRCodeReader from "../QRCodeReaderFile/QRCodeReader"; // Ajuste le chemin si nécessaire

const QRCodeHandlerPage = () => {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  if (!codeFromUrl) {
    return (
      <div style={{ padding: "20px", textAlign: "center", marginTop: "30px" }}>
        <h1>Paramètre 'code' manquant dans l'URL.</h1>
        <p>
          Veuillez scanner un QR code valide contenant une URL avec un paramètre
          'code'.
        </p>
        <p>
          Exemple d'URL attendue :{" "}
          <code>
            https://votre-domaine.com/votre-app/qr-scan-resultat?code=A01
          </code>
        </p>
      </div>
    );
  }

  // Passe le code extrait de l'URL au composant QRCodeReader
  // QRCodeReader a déjà été modifié pour accepter cette prop 'initialCodeFromUrl'
  return <QRCodeReader initialCodeFromUrl={codeFromUrl} />;
};

export default QRCodeHandlerPage;
