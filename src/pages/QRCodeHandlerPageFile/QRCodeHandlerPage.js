import React from "react";
import { useSearchParams } from "react-router-dom";
import QRCodeReader from "../QRCodeReaderFile/QRCodeReader"; // Ajuste le chemin si nécessaire

const QRCodeHandlerPage = () => {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code");
  console.log("QRCodeHandlerPage - codeFromUrl:", codeFromUrl); // Gardé pour le débogage console

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
            https://fguerin555.github.io/ombrelli/qr-scan-resultat?code=A01
          </code>
        </p>
      </div>
    );
  }

  // Passe le code extrait de l'URL au composant QRCodeReader
  return <QRCodeReader initialCodeFromUrl={codeFromUrl} />;
};

export default QRCodeHandlerPage;
