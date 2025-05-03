import React, { useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase"; // Assure-toi que le chemin est correct
import "./Global.css";
import styles from "./TestQueryName.module.css";

const TestQueryName = () => {
  // États pour les champs de recherche
  const [searchCognome, setSearchCognome] = useState("");
  const [searchNome, setSearchNome] = useState("");
  const [searchSerialNumber, setSearchSerialNumber] = useState("");

  // État pour les résultats et le chargement
  const [allSearchResults, setAllSearchResults] = useState([]); // Stocke TOUS les résultats
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false); // Pour savoir si une recherche a été faite

  // Fonction utilitaire pour formater les dates
  const formatDateEU = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const [year, month, day] = dateString.split("-");
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString; // Retourne la chaîne originale en cas d'erreur
    }
  };

  // Fonction de recherche
  const handleSearch = useCallback(async () => {
    console.log("handleSearch démarrée !"); // Log 1
    setIsLoading(true);
    setSearchPerformed(true); // Marquer qu'une recherche a été lancée

    try {
      const reservationsRef = collection(db, "reservations");
      console.log("Récupération des réservations depuis Firestore..."); // Log 2
      const querySnapshot = await getDocs(reservationsRef);
      const allReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filtrage basé sur les critères (insensible à la casse pour les noms)
      console.log(`Filtrage de ${allReservations.length} réservations...`); // Log 3
      const filteredResults = allReservations.filter((res) => {
        const cognomeMatch =
          !searchCognome ||
          (res.nom &&
            res.nom.toLowerCase().includes(searchCognome.toLowerCase()));
        const nomeMatch =
          !searchNome ||
          (res.prenom &&
            res.prenom.toLowerCase().includes(searchNome.toLowerCase()));
        const serialMatch =
          !searchSerialNumber ||
          (res.serialNumber && res.serialNumber.includes(searchSerialNumber));

        // La réservation doit correspondre à TOUS les critères non vides
        return cognomeMatch && nomeMatch && serialMatch;
      });

      // Trier les résultats (par exemple, par date de début puis nom)
      filteredResults.sort((a, b) => {
        if (a.startDate < b.startDate) return -1;
        if (a.startDate > b.startDate) return 1;
        if (a.nom < b.nom) return -1;
        if (a.nom > b.nom) return 1;
        return 0;
      });

      console.log(
        `Recherche terminée. ${filteredResults.length} résultats trouvés.`
      ); // Log 4
      setAllSearchResults((prevResults) => [...prevResults, filteredResults]); // Ajouter les nouveaux résultats

      // Réinitialiser l'indicateur de recherche effectuée après chaque recherche
      setSearchPerformed(false);
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      alert("Une erreur est survenue pendant la recherche.");
    } finally {
      console.log("Bloc finally atteint, isLoading mis à false."); // Log 5
      setIsLoading(false);
    }
  }, [searchCognome, searchNome, searchSerialNumber]); // Dépendances de la fonction de recherche

  return (
    <div>
      <div className={styles.TestQueryNamePage}>
        <div className={styles.Titre}>
          <h1>Test Query Name</h1>
        </div>
        {/* Section des contrôles de recherche */}
        <div className={styles.searchControls}>
          <input
            type="text"
            placeholder="Cognome..."
            value={searchCognome}
            onChange={(e) => setSearchCognome(e.target.value)}
            className={styles.searchInput}
          />
          <input
            type="text"
            placeholder="Nome..."
            value={searchNome}
            onChange={(e) => setSearchNome(e.target.value)}
            className={styles.searchInput}
          />
          <input
            type="text"
            placeholder="25..... (7 cifre)" // Placeholder plus précis
            value={searchSerialNumber}
            onChange={(e) => setSearchSerialNumber(e.target.value)}
            maxLength={7} // Limiter à 7 caractères
            className={styles.searchInput}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className={styles.searchButton}
          >
            {isLoading ? "Ricerca..." : "Cerca"}
          </button>
        </div>

        {/* Section des résultats */}
        <div className={styles.resultsSection}>
          {isLoading ? (
            <p>Ricerca in corso...</p>
          ) : allSearchResults.length === 0 && searchPerformed ? (
            <p>Nessuna prenotazione trovata con questi criteri.</p>
          ) : (
            allSearchResults.map((searchResults, index) => (
              <div key={index} className={styles.resultsTableContainer}>
                {index > 0 && <hr />}{" "}
                {/* Ligne de séparation entre les tableaux */}
                {searchResults.length === 0 ? (
                  <p>Nessun risultato per questa ricerca.</p>
                ) : (
                  <table className={styles.resultsTable}>
                    <thead>
                      <tr>
                        <th>Ombrellone</th>
                        <th>Cognome</th>
                        <th>Nome</th>
                        <th>Data Inizio</th>
                        <th>Data Fine</th>
                        <th>N° Prenot.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((res) => (
                        <tr key={res.id}>
                          <td>{res.cellCode || "N/A"}</td>
                          <td>{res.nom || ""}</td>
                          <td>{res.prenom || ""}</td>
                          <td>{formatDateEU(res.startDate)}</td>
                          <td>{formatDateEU(res.endDate || res.startDate)}</td>
                          <td>{res.serialNumber || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TestQueryName;
