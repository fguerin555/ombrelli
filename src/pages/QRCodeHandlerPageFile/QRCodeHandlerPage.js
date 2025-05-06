import React from "react";
// import { useSearchParams } from "react-router-dom"; // Temporairement commenté pour le test
// import QRCodeReader from "../QRCodeReaderFile/QRCodeReader"; // Temporairement commenté pour le test

const QRCodeHandlerPage = () => {
  // Retourne un message de test très simple pour vérifier si le composant est atteint
  return (
    <div
      style={{
        backgroundColor: "lightyellow",
        padding: "30px",
        margin: "20px",
        border: "2px solid orange",
        fontSize: "20px",
        textAlign: "center",
      }}
    >
      <h1>Test de Rendu QRCodeHandlerPage</h1>
      <p>
        Si vous voyez ceci, QRCodeHandlerPage est bien atteint par le routeur.
      </p>
      <p>L'URL devrait être /ombrelli/qr-scan-resultat?code=VOTRE_CODE</p>
    </div>
  );
};

export default QRCodeHandlerPage;
