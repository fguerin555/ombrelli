import React, { useState } from "react";
import { db } from "../../firebase"; // Assurez-vous que le chemin est correct
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import "../../Global.css";
import styles from "./Query.module.css";

// Helper function pour obtenir toutes les dates entre deux dates (inclusives) en UTC
const getDatesInRange = (startDateStr, endDateStr) => {
  const dates = [];
  try {
    // Parse les chaînes d'entrée comme dates UTC à minuit
    const [startYear, startMonth, startDay] = startDateStr
      .split("-")
      .map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);

    // Crée des objets Date représentant minuit UTC
    let currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const finalDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    // Vérifie la validité et l'ordre des dates
    if (isNaN(currentDate.getTime()) || isNaN(finalDate.getTime())) {
      console.error(
        "Date invalide détectée dans getDatesInRange (NaN):",
        startDateStr,
        endDateStr
      );
      return []; // Retourne vide si une date est invalide
    }
    if (currentDate > finalDate) {
      console.error(
        "Date de début après date de fin dans getDatesInRange:",
        startDateStr,
        endDateStr
      );
      return []; // Retourne vide si l'ordre est incorrect
    }

    // Boucle tant que currentDate (UTC) est <= finalDate (UTC)
    while (currentDate <= finalDate) {
      // Formate la date UTC actuelle en chaîne YYYY-MM-DD
      dates.push(currentDate.toISOString().split("T")[0]);

      // Incrémente le jour en utilisant les méthodes UTC pour éviter les pbs de fuseau horaire
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  } catch (error) {
    console.error(
      "Erreur dans getDatesInRange:",
      error,
      "avec dates:",
      startDateStr,
      endDateStr
    );
    return []; // Retourne un tableau vide en cas d'erreur inattendue
  }
  console.log(`getDatesInRange(${startDateStr}, ${endDateStr}) =>`, dates); // Log pour vérifier la sortie
  return dates;
};

const Query = () => {
  const [codeParasol, setCodeParasol] = useState(""); // Input state still uses 'codeParasol'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [condition, setCondition] = useState("all"); // 'all', 'reserved', 'not_reserved'
  const [results, setResults] = useState(null); // null: pas de recherche, []: aucun résultat, [...]: résultats
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(null); // Pour afficher les paramètres de recherche avec les résultats

  const handleSearch = async (e) => {
    e.preventDefault(); // Empêche le rechargement de la page
    setError(null); // Réinitialiser l'erreur au début

    // --- Validation du Code Parasol (input value) ---
    const parasolRegex = /^[A-D](0[1-9]|[1-2][0-9]|3[0-6])$/i; // i = insensible à la casse
    const normalizedCodeParasol = codeParasol.trim().toUpperCase(); // Normaliser avant de tester

    if (!parasolRegex.test(normalizedCodeParasol)) {
      setError(
        "Codice Ombrello sbagliato usa A01-A36, B01-B36, C01-C36, D01-D36."
      );
      setResults(null);
      setLoading(false); // Assurez-vous que le chargement s'arrête
      return; // Arrêter la fonction ici
    }
    // --- Fin Validation ---

    // Validation des dates
    if (!startDate || !endDate) {
      setError("insérire les due date");
      setResults(null);
      return;
    }
    // Utilisation de l'approche UTC pour la comparaison des dates d'entrée
    const startInputDate = new Date(startDate + "T00:00:00Z");
    const endInputDate = new Date(endDate + "T00:00:00Z");

    if (isNaN(startInputDate.getTime()) || isNaN(endInputDate.getTime())) {
      setError("Formato data sbagliato.");
      setResults(null);
      return;
    }

    if (startInputDate > endInputDate) {
      setError("La data inizio non può essere posteroire a la data fine.");
      setResults(null);
      return;
    }

    setLoading(true);
    setResults(null); // Réinitialise les résultats précédents
    // Sauvegarde les paramètres AVEC le code normalisé pour l'affichage
    setSearchParams({
      codeParasol: normalizedCodeParasol, // Garde le nom de l'input pour l'affichage
      startDate,
      endDate,
      condition,
    });

    try {
      // 1. Récupérer TOUTES les réservations pour le 'cellCode' donné (normalisé)
      const reservationsRef = collection(db, "reservations");
      // --- CORRECTION ICI ---
      const q = query(
        reservationsRef,
        where("cellCode", "==", normalizedCodeParasol) // Utilise le nom de champ correct "cellCode"
      );
      // --- FIN CORRECTION ---

      const querySnapshot = await getDocs(q);
      const fetchedReservations = [];
      // Log avec le nom de champ correct pour la clarté
      console.log(
        `Recherche Firestore pour cellCode: ${normalizedCodeParasol}`
      );
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Log avec le nom de champ correct
        console.log("Document Firestore brut:", doc.id, data);

        let resStartDate, resEndDate;
        try {
          // Conversion en objets Date JS (préférer .toDate() pour Timestamps)
          // Si ce sont des strings YYYY-MM-DD, les traiter comme UTC
          resStartDate =
            data.startDate instanceof Timestamp
              ? data.startDate.toDate() // .toDate() retourne un objet Date JS standard
              : new Date(data.startDate + "T00:00:00Z"); // Traiter string comme UTC

          resEndDate =
            data.endDate instanceof Timestamp
              ? data.endDate.toDate()
              : new Date(data.endDate + "T00:00:00Z"); // Traiter string comme UTC

          // Vérifier si les dates sont valides APRÈS conversion
          if (isNaN(resStartDate.getTime()) || isNaN(resEndDate.getTime())) {
            console.warn(
              "Dates invalides après conversion pour doc:",
              doc.id,
              "Dates brutes:",
              data.startDate,
              data.endDate
            );
            return; // Ne pas ajouter cette réservation si les dates sont invalides
          }

          console.log("Réservation traitée:", {
            id: doc.id,
            cellCode: data.cellCode, // Utiliser data.cellCode ici aussi pour la cohérence du log
            startDate: resStartDate.toISOString().split("T")[0],
            endDate: resEndDate.toISOString().split("T")[0],
          });

          fetchedReservations.push({
            id: doc.id,
            ...data, // Garder les données originales si besoin
            startDate: resStartDate, // Stocker les dates comme objets Date
            endDate: resEndDate,
          });
        } catch (conversionError) {
          console.error(
            "Erreur de conversion de date pour doc:",
            doc.id,
            data,
            conversionError
          );
        }
      });
      console.log(
        "Total réservations trouvées et traitées pour ce cellCode:", // Mise à jour du log
        fetchedReservations.length
      );

      // 2. Générer la liste de toutes les dates (YYYY-MM-DD) dans la période demandée par l'utilisateur (en utilisant la fonction UTC)
      const requestedDates = getDatesInRange(startDate, endDate);

      // Vérifier si getDatesInRange a retourné des dates
      if (requestedDates.length === 0) {
        console.error(
          "getDatesInRange n'a retourné aucune date. Vérifiez les dates d'entrée et les logs de la fonction."
        );
        if (startInputDate <= endInputDate) {
          setError(
            "Erreur interne lors de la génération de la plage de dates."
          );
        } else {
          setError(
            "La date de début ne peut pas être postérieure à la date de fin."
          );
        }
        setResults([]); // Mettre un tableau vide pour indiquer "aucun résultat" plutôt que null
        setLoading(false);
        return;
      }

      // 3. Déterminer le statut (Libero/Prenotato) pour chaque date demandée
      console.log(
        "Début du mappage pour dailyStatus sur les dates:",
        requestedDates
      );
      let dailyStatus = requestedDates.map((dateStr) => {
        // Créer la date du jour à vérifier (à minuit UTC)
        const [year, month, day] = dateStr.split("-").map(Number);
        const currentDateUTC = new Date(Date.UTC(year, month - 1, day)); // Minuit UTC
        // --- LOG DÉTAILLÉ POUR LE JOUR COURANT ---
        console.log(
          `\n--- Vérification pour le jour : ${dateStr} (UTC: ${currentDateUTC.toISOString()}) ---`
        );

        let isReserved = false;
        let reservationFound = false; // Flag pour voir si on trouve la réservation attendue

        for (const reservation of fetchedReservations) {
          // Convertir les dates de début/fin de réservation en minuit UTC pour une comparaison fiable
          const resStartUTC = new Date(
            Date.UTC(
              reservation.startDate.getUTCFullYear(),
              reservation.startDate.getUTCMonth(),
              reservation.startDate.getUTCDate()
            )
          );
          const resEndUTC = new Date(
            Date.UTC(
              reservation.endDate.getUTCFullYear(),
              reservation.endDate.getUTCMonth(),
              reservation.endDate.getUTCDate()
            )
          );

          // --- LOG DÉTAILLÉ POUR CHAQUE RÉSERVATION COMPARÉE ---
          console.log(`  Comparaison avec Réservation ID: ${reservation.id}`);
          console.log(
            `    Reservation Start UTC: ${resStartUTC.toISOString()}`
          );
          console.log(`    Reservation End UTC:   ${resEndUTC.toISOString()}`);

          // Comparaison en utilisant les timestamps UTC
          const comparisonResult =
            currentDateUTC.getTime() >= resStartUTC.getTime() &&
            currentDateUTC.getTime() <= resEndUTC.getTime();

          console.log(
            `    Current >= Start? : ${
              currentDateUTC.getTime() >= resStartUTC.getTime()
            } (${currentDateUTC.getTime()} >= ${resStartUTC.getTime()})`
          );
          console.log(
            `    Current <= End?   : ${
              currentDateUTC.getTime() <= resEndUTC.getTime()
            } (${currentDateUTC.getTime()} <= ${resEndUTC.getTime()})`
          );
          console.log(`    => Résultat Comparaison: ${comparisonResult}`);
          // --- FIN LOG DÉTAILLÉ ---

          if (comparisonResult) {
            console.log(
              `    MATCH TROUVÉ! ${dateStr} est dans la réservation ${reservation.id}.`
            );
            isReserved = true;
            reservationFound = true; // On a trouvé la réservation
            break; // Ce jour est couvert par au moins une réservation
          }
        }

        // --- LOG APRÈS AVOIR VÉRIFIÉ TOUTES LES RÉSERVATIONS POUR CE JOUR ---
        if (!reservationFound && fetchedReservations.length > 0) {
          console.log(`  Aucune réservation trouvée ne couvre ${dateStr}.`);
        } else if (fetchedReservations.length === 0) {
          console.log(`  Aucune réservation à vérifier pour ${dateStr}.`);
        }
        console.log(
          `--- Statut final pour ${dateStr}: ${
            isReserved ? "Prenotato" : "Libero"
          } ---`
        );
        // --- FIN LOG ---

        return { date: dateStr, status: isReserved ? "Prenotato" : "Libero" };
      });
      console.log("Statut journalier avant filtre:", dailyStatus);

      // 4. Filtrer les résultats selon la condition choisie
      if (condition === "reserved") {
        dailyStatus = dailyStatus.filter((day) => day.status === "Prenotato");
      } else if (condition === "not_reserved") {
        dailyStatus = dailyStatus.filter((day) => day.status === "Libero");
      }
      // Si condition === 'all', on ne filtre pas

      console.log("Statut journalier après filtre:", dailyStatus);
      setResults(dailyStatus);
    } catch (err) {
      console.error("Erreur lors de la recherche Firestore:", err);
      setError(
        "Une erreur est survenue lors de la recherche. Vérifiez la console pour plus de détails."
      );
      setResults(null); // Erreur -> pas de résultat affiché
    } finally {
      setLoading(false);
    }
  };

  const getConditionLabel = () => {
    switch (searchParams?.condition) {
      case "reserved":
        return "Prenotato"; // Traduction
      case "not_reserved":
        return "Libero"; // Traduction
      default:
        return "Tutti"; // Traduction
    }
  };

  return (
    <div className={styles.queryContainer}>
      <div className={styles.titre}>
        <h1>Interrogazione Prenotazioni</h1> {/* Traduction */}
      </div>

      <form onSubmit={handleSearch} className={styles.queryForm}>
        <div className={styles.formGroup}>
          {/* L'input garde le label "Code Parasol" pour l'utilisateur */}
          <label htmlFor="codeParasol">Codice Ombrellone:</label>{" "}
          {/* Traduction */}
          <input
            type="text"
            id="codeParasol" // L'id peut rester codeParasol
            value={codeParasol} // Lié à l'état codeParasol
            onChange={(e) => setCodeParasol(e.target.value)}
            placeholder="Es: A01" // Traduction
            required
            pattern="^[a-dA-D](0[1-9]|[1-2][0-9]|3[0-6])$"
            title="Formato: A01-A36, B01-B36, C01-C36, D01-D36" // Traduction
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="startDate">Data Inizio:</label> {/* Traduction */}
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="endDate">Data Fine:</label> {/* Traduction */}
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="condition">Condizione:</label> {/* Traduction */}
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            <option value="all">Tutti (Libero / Prenotato)</option>{" "}
            {/* Traduction */}
            <option value="reserved">Solo Prenotato</option> {/* Traduction */}
            <option value="not_reserved">Solo Libero</option> {/* Traduction */}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={styles.searchButton}
        >
          {loading ? "Ricerca..." : "Cerca"} {/* Traduction */}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {/* Indicateur de chargement plus visible */}
      {loading && (
        <div className={styles.loadingIndicator}>
          <p>Caricamento risultati...</p> {/* Traduction */}
        </div>
      )}

      {/* Section des résultats */}
      {!loading && results && searchParams && (
        <div className={styles.resultsContainer}>
          <h2>
            {/* Utiliser searchParams.codeParasol qui est la valeur normalisée de l'input */}
            Risultati per {searchParams.codeParasol} {/* Traduction */}
            <span className={styles.dateRange}>
              {" "}
              (dal {searchParams.startDate} al {searchParams.endDate}){" "}
              {/* Traduction */}
            </span>
          </h2>

          {/* Affichage de la condition si elle n'est pas 'all' */}
          {searchParams.condition !== "all" && (
            <p className={styles.conditionHeader}>
              Visualizzazione giorni con stato: {/* Traduction */}
              <strong>{getConditionLabel()}</strong>
            </p>
          )}

          {/* Gérer le cas où results est un tableau vide après filtrage */}
          {results.length === 0 ? (
            <p className={styles.noResults}>
              Nessuna data corrisponde alla condizione '{getConditionLabel()}'
              per l'ombrellone {searchParams.codeParasol} tra il{" "}
              {/* Traduction */}
              {searchParams.startDate} e il {searchParams.endDate}.
            </p>
          ) : (
            <ul className={styles.resultsList}>
              {results.map((item, index) => (
                <li
                  key={index}
                  className={
                    item.status === "Prenotato"
                      ? styles.prenotato
                      : styles.libero
                  }
                >
                  {/* Afficher la date et le statut */}
                  {item.date}: <strong>{item.status}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Query;
