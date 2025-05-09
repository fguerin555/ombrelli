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
  const [allSearchResults, setAllSearchResults] = useState([]); // Stocke les résultats des recherches réussies (array d'arrays)
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

  // Fonction pour traduire et formater la condition pour l'affichage
  const formatCondition = (condition) => {
    switch (condition) {
      case "jour entier":
        return "Giorno intero";
      case "matin":
        return "Mattina";
      case "apres-midi":
        return "Pomeriggio";
      default:
        return condition || "N/D"; // Retourne la condition originale ou N/D si vide
    }
  };

  // Fonction pour convertir 'R'/'P' en texte complet
  const formatExtra = (code) => {
    if (code === "R") return "Regista";
    if (code === "T") return "Transat";
    return ""; // Retourne une chaîne vide si ce n'est ni R ni P ou si code est undefined/null
  };

  // Fonction pour obtenir le style de couleur basé sur la condition Firestore
  const getConditionStyle = (condition) => {
    switch (condition) {
      case "jour entier":
        return { color: "red", fontWeight: "bold" };
      case "matin":
        return { color: "blue", fontWeight: "bold" };
      case "apres-midi":
        return { color: "orange", fontWeight: "bold" };
      default:
        return {}; // Pas de style spécifique par défaut
    }
  };

  // Fonction utilitaire pour vérifier si au moins une recherche a trouvé des résultats
  const hasAnyResults = (resultsArray) => {
    // Vérifie si le tableau principal n'est pas vide (car on n'y met que des résultats non vides)
    return resultsArray.length > 0;
  };

  // Fonction de recherche
  const handleSearch = useCallback(async () => {
    console.log("handleSearch démarrée !"); // Log 1
    setIsLoading(true); // Démarre le chargement
    setSearchPerformed(true); // Marquer qu'une recherche a été lancée

    try {
      const reservationsRef = collection(db, "reservations");
      console.log("Récupération des réservations depuis Firestore..."); // Log 2
      const querySnapshot = await getDocs(reservationsRef);
      const allReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filtrage basé sur les critères
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
          (res.serialNumber &&
            res.serialNumber.toString().includes(searchSerialNumber));

        return cognomeMatch && nomeMatch && serialMatch;
      });

      // Trier les résultats
      filteredResults.sort((a, b) => {
        if (a.startDate < b.startDate) return -1;
        if (a.startDate > b.startDate) return 1;
        const nameA = a.nom || "";
        const nameB = b.nom || "";
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      console.log(
        `Recherche terminée. ${filteredResults.length} résultats trouvés.`
      ); // Log 4

      // Ajouter le nouveau tableau de résultats UNIQUEMENT s'il n'est pas vide
      if (filteredResults.length > 0) {
        setAllSearchResults((prevResults) => [...prevResults, filteredResults]);
      }
      // Si filteredResults est vide, on ne fait rien, il n'est pas ajouté à l'historique.
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      alert("Une erreur est survenue pendant la recherche.");
    } finally {
      console.log("Bloc finally atteint, isLoading mis à false."); // Log 5
      setIsLoading(false); // Fin du chargement
    }
  }, [searchCognome, searchNome, searchSerialNumber]); // Dépendances

  return (
    <div>
      <div className={styles.TestQueryNamePage}>
        <div className={styles.Titre}>
          <h1>Ricerca per Cognome/ N° Prenotazione</h1>
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
            placeholder="N° Prenot. (7 cifre)"
            value={searchSerialNumber}
            onChange={(e) => setSearchSerialNumber(e.target.value)}
            maxLength={7}
            className={`${styles.searchInput} ${styles.serialInput}`}
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
            <p>Ricerca in corso...</p> // S'affiche PENDANT la recherche
          ) : !searchPerformed ? (
            <p>Inserisci i criteri e clicca 'Cerca'.</p> // Avant la 1ère recherche
          ) : hasAnyResults(allSearchResults) ? (
            // Si au moins une recherche a trouvé des résultats
            allSearchResults.map((resultSet, index) => (
              // On affiche chaque ensemble de résultats trouvé
              <div key={index} className={styles.resultsTableContainer}>
                {index > 0 && <hr className={styles.resultSeparator} />}
                {/* Séparateur */}
                {/* On affiche directement le tableau car resultSet n'est jamais vide ici */}
                <table className={styles.resultsTable}>
                  <thead>
                    <tr>
                      <th>Ombrellone</th>
                      <th>Cognome</th>
                      <th>Nome</th>
                      <th>Data Inizio</th>
                      <th>Data Fine</th>
                      <th>Condizione</th>
                      <th>Lettini</th>
                      <th>Extra</th>
                      <th>Cabina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultSet.map((res) => (
                      <tr key={res.id}>
                        <td>{res.cellCode || "N/A"}</td>
                        <td>{res.nom || ""}</td>
                        <td>{res.prenom || ""}</td>
                        <td>{formatDateEU(res.startDate)}</td>
                        <td>{formatDateEU(res.endDate || res.startDate)}</td>
                        <td style={getConditionStyle(res.condition)}>
                          {formatCondition(res.condition)}
                        </td>
                        <td>{res.numBeds !== undefined ? res.numBeds : ""}</td>
                        <td>{formatExtra(res.registiPoltrona)}</td>
                        <td>{res.cabina || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            // Si AUCUNE recherche n'a jamais trouvé de résultat
            <p>Nessuna prenotazione trovata con questi criteri.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestQueryName;
