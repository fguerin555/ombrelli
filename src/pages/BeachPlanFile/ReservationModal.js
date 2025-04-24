// src/pages/BeachPlanFile/ReservationModal.js
import React, { useState, useEffect, useCallback } from "react";
import styles from "./ReservationModal.module.css";

// --- Fonctions Utilitaires ---
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const capitalizeFirstLetter = (string) => {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr; // Retourne la chaîne originale en cas d'erreur
  }
};

// Séquence valide des cabines
const VALID_CABINS = "ABCDEFGHIJKLMNOPQRSTUWXYZ".split("");

// Fonction pour vérifier le chevauchement de dates
const datesOverlap = (start1, end1, start2, end2) => {
  // S'assurer que toutes les dates sont valides avant comparaison
  if (!start1 || !end1 || !start2 || !end2) return false;
  // Convertir en objets Date pour une comparaison fiable (ignorer l'heure)
  // Utiliser UTC pour éviter les problèmes de fuseau horaire lors de la comparaison des dates seules
  try {
    const dStart1 = new Date(start1 + "T00:00:00Z");
    const dEnd1 = new Date(end1 + "T00:00:00Z");
    const dStart2 = new Date(start2 + "T00:00:00Z");
    const dEnd2 = new Date(end2 + "T00:00:00Z");

    // Vérifier si les dates sont valides après conversion
    if (isNaN(dStart1) || isNaN(dEnd1) || isNaN(dStart2) || isNaN(dEnd2)) {
      console.warn("Date invalide détectée dans datesOverlap:", {
        start1,
        end1,
        start2,
        end2,
      });
      return false;
    }

    // Vérifier le chevauchement
    return dStart1 <= dEnd2 && dEnd1 >= dStart2;
  } catch (e) {
    console.error("Erreur dans datesOverlap:", e);
    return false; // En cas d'erreur de parsing, considérer qu'il n'y a pas de chevauchement
  }
};
// --- Fin Fonctions Utilitaires ---

const ReservationModal = ({
  isOpen,
  onClose,
  cellCode,
  reservationData,
  onSave,
  onDelete,
  isSaving,
  selectedDate,
  allReservations,
}) => {
  // Reçu depuis BeachPlan
  const [formData, setFormData] = useState({});
  const [isNew, setIsNew] = useState(true);
  const todayString = getTodayString();
  const [singleDayCondition, setSingleDayCondition] = useState("");
  const [showSingleDayOptions, setShowSingleDayOptions] = useState(false);

  // États pour la gestion de la cabine
  const [requestCabin, setRequestCabin] = useState(false); // L'utilisateur demande-t-il une cabine ?
  const [assignedCabin, setAssignedCabin] = useState(""); // La cabine assignée automatiquement
  const [cabinError, setCabinError] = useState(""); // Message d'erreur si aucune cabine dispo

  // Fonction pour trouver la prochaine cabine disponible
  const findNextAvailableCabin = useCallback(
    (startDate, endDate) => {
      if (!startDate || !endDate || !Array.isArray(allReservations)) {
        console.log("findNextAvailableCabin: Prérequis non remplis", {
          startDate,
          endDate,
          allReservationsValid: Array.isArray(allReservations),
        });
        return null; // Pas assez d'infos ou pas de réservations existantes
      }

      // 1. Trouver les cabines déjà réservées pendant la période souhaitée
      const conflictingCabins = allReservations
        .filter(
          (res) =>
            res.cabina && // Filtrer celles qui ont une cabine assignée
            res.id !== formData.id && // Exclure la réservation actuelle si on édite
            datesOverlap(startDate, endDate, res.startDate, res.endDate) // Vérifier le chevauchement
        )
        .map((res) => res.cabina); // Obtenir les lettres des cabines

      const uniqueConflictingCabins = [...new Set(conflictingCabins)]; // Liste unique des cabines en conflit
      console.log(
        "Cabines en conflit pour",
        startDate,
        "-",
        endDate,
        ":",
        uniqueConflictingCabins
      );

      // 2. Trouver la première cabine valide qui n'est PAS dans la liste des conflits
      for (const cabin of VALID_CABINS) {
        if (!uniqueConflictingCabins.includes(cabin)) {
          console.log("Cabine trouvée:", cabin);
          return cabin; // Trouvé !
        }
      }

      // 3. Si on arrive ici, toutes les cabines sont prises
      console.log("Aucune cabine disponible trouvée.");
      return null;
    },
    [allReservations, formData.id]
  ); // Dépend de toutes les réservations et de l'ID actuel

  // useEffect pour initialiser le formulaire et l'état de la cabine quand le modal s'ouvre ou reservationData change
  useEffect(() => {
    if (isOpen) {
      const initialData = reservationData || {};
      const isActuallyNew = !initialData.id;
      setIsNew(isActuallyNew);

      const initialCondition = initialData.condition || "jour entier";
      // Utiliser selectedDate comme fallback si les dates de reservationData sont manquantes
      const initialStartDate =
        initialData.startDate || selectedDate || todayString;
      const initialEndDate = initialData.endDate || selectedDate || todayString;

      setFormData({
        id: initialData.id || null,
        nom: capitalizeFirstLetter(initialData.nom || ""),
        prenom: capitalizeFirstLetter(initialData.prenom || ""),
        numBeds:
          initialData.numBeds === undefined
            ? 2
            : Math.min(Math.max(initialData.numBeds, 0), 3), // Assurer 0-3
        registiPoltrona: initialData.registiPoltrona || "",
        startDate: initialStartDate,
        endDate: initialEndDate,
        condition: initialCondition,
        serialNumber: initialData.serialNumber || null,
        // Ne pas inclure cabina ici, géré par les états dédiés
      });

      // Initialiser la demande de cabine et la cabine assignée
      const initialRequestCabin = !!initialData.cabina; // Vrai si une cabine existait
      setRequestCabin(initialRequestCabin);
      setAssignedCabin(initialData.cabina || ""); // Afficher la cabine existante
      setCabinError(""); // Reset error

      // Logique pour "For this day" (inchangée)
      const isEditingExisting = !isActuallyNew;
      const isMultiDay = initialStartDate !== initialEndDate;
      const isSelectedDateWithinRange =
        selectedDate &&
        selectedDate >= initialStartDate &&
        selectedDate <= initialEndDate;
      setShowSingleDayOptions(
        isEditingExisting && isMultiDay && isSelectedDateWithinRange
      );
      // Pré-remplir la condition du jour unique avec la condition globale initiale
      setSingleDayCondition(initialCondition);
    } else {
      // Reset quand le modal se ferme
      setShowSingleDayOptions(false);
      setSingleDayCondition("");
      setRequestCabin(false);
      setAssignedCabin("");
      setCabinError("");
      setFormData({}); // Vider le formulaire
    }
  }, [reservationData, isOpen, todayString, selectedDate]); // Dépendances pour l'initialisation

  // useEffect pour recalculer la cabine si les dates changent OU si on la demande/annule
  useEffect(() => {
    // Ne rien faire si le modal n'est pas ouvert
    if (!isOpen) return;

    if (requestCabin) {
      // Recalculer seulement si les dates sont valides et dans le bon ordre
      if (
        formData.startDate &&
        formData.endDate &&
        formData.startDate <= formData.endDate
      ) {
        console.log(
          "Recalcul de la cabine pour:",
          formData.startDate,
          "-",
          formData.endDate
        );
        const nextCabin = findNextAvailableCabin(
          formData.startDate,
          formData.endDate
        );
        if (nextCabin) {
          setAssignedCabin(nextCabin);
          setCabinError("");
        } else {
          setAssignedCabin(""); // Aucune cabine trouvée
          setCabinError("Nessuna cabina disponibile per queste date.");
        }
      } else {
        // Dates invalides ou manquantes, on ne peut pas calculer
        setAssignedCabin("");
        setCabinError("Selezionare date valide per assegnare una cabina.");
      }
    } else {
      // Si on ne demande pas de cabine, s'assurer que tout est vide
      setAssignedCabin("");
      setCabinError("");
    }
  }, [
    isOpen,
    requestCabin,
    formData.startDate,
    formData.endDate,
    findNextAvailableCabin,
  ]); // Dépendances pour le recalcul

  // Gère les changements dans les champs du formulaire
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Gérer le changement de la checkbox "Cabina"
    if (name === "requestCabin") {
      setRequestCabin(checked);
      // Le useEffect [requestCabin, ...] se chargera du recalcul ou du nettoyage
      return;
    }

    // Gérer le changement de la condition spécifique au jour
    if (name === "singleDayCondition") {
      setSingleDayCondition(value);
      return;
    }

    // Traitement spécifique pour certains champs
    let processedValue = value;
    if (name === "registiPoltrona") {
      const upperValue = value.toUpperCase();
      // Autoriser seulement R, P ou vide
      processedValue = ["R", "P", ""].includes(upperValue)
        ? upperValue
        : formData.registiPoltrona;
    } else if (name === "nom" || name === "prenom") {
      processedValue = capitalizeFirstLetter(value);
    } else if (type === "number") {
      // Utiliser valueAsNumber pour obtenir un nombre ou NaN
      const numValue = e.target.valueAsNumber;
      processedValue = isNaN(numValue) ? "" : numValue; // Mettre '' si invalide au lieu de garder l'ancien
      if (name === "numBeds") {
        if (processedValue < 0) processedValue = 0;
        if (processedValue > 3) processedValue = 3;
      }
    }

    // Mise à jour de l'état formData
    setFormData((prev) => {
      const newState = { ...prev, [name]: processedValue };

      // Ajustement automatique de la date de fin si la date de début la dépasse
      if (
        name === "startDate" &&
        newState.endDate &&
        newState.endDate < processedValue
      ) {
        newState.endDate = processedValue;
      }
      // Ajustement automatique de la date de début si la date de fin est avant
      if (
        name === "endDate" &&
        newState.startDate &&
        processedValue < newState.startDate
      ) {
        newState.startDate = processedValue;
      }

      // Mise à jour de la visibilité des options "For this day"
      const isMultiDay = newState.startDate !== newState.endDate;
      const isSelectedDateWithinRange =
        selectedDate &&
        selectedDate >= newState.startDate &&
        selectedDate <= newState.endDate;
      setShowSingleDayOptions(
        !isNew && isMultiDay && isSelectedDateWithinRange
      );

      return newState;
    });
  };

  // Gère la soumission du formulaire (sauvegarde)
  const handleSave = (e) => {
    e.preventDefault();

    // --- Validations avant sauvegarde ---
    if (!formData.nom || !formData.prenom) {
      alert("Cognome e Nome sono obbligatori.");
      return;
    }
    if (formData.endDate < formData.startDate) {
      alert("La data di fine non può essere anteriore alla data di inizio.");
      return;
    }
    // numBeds est déjà contraint entre 0 et 3 par handleChange, mais vérifions si c'est un nombre valide
    if (formData.numBeds === "" || isNaN(formData.numBeds)) {
      alert("Il numero di lettini non è valido.");
      return;
    }
    // Validation Cabine: Si demandée mais non assignée (erreur)
    if (requestCabin && !assignedCabin) {
      alert(
        cabinError ||
          "Impossibile assegnare una cabina. Verificare le date o la disponibilità."
      );
      return;
    }

    // Préparer les données à envoyer à BeachPlan.js
    let dataToSend = {
      ...formData,
      cellCode, // Ajouter le code de la cellule
      // Ajouter la cabine si demandée ET assignée, sinon null
      // `null` est important pour écraser/supprimer une cabine existante dans Firestore si on décoche
      cabina: requestCabin && assignedCabin ? assignedCabin : null,
    };

    // Ajouter les infos pour le split si nécessaire
    if (
      showSingleDayOptions &&
      singleDayCondition &&
      singleDayCondition !== formData.condition
    ) {
      dataToSend = {
        ...dataToSend,
        modifySingleDay: true,
        targetDate: selectedDate,
        targetDateCondition: singleDayCondition,
      };
    } else {
      // S'assurer que modifySingleDay est false si on ne split pas
      dataToSend.modifySingleDay = false;
    }

    // Appeler la fonction onSave passée en prop
    onSave(dataToSend);
  };

  // Gère le clic sur le bouton Supprimer
  const handleDeleteClick = () => {
    // La confirmation est maintenant gérée dans BeachPlan.js avant d'appeler onDelete
    onDelete(formData.id);
  };

  // Ne rien rendre si le modal n'est pas ouvert
  if (!isOpen) return null;

  // Détermine si le bouton Save doit être désactivé
  const isSaveDisabled =
    isSaving || (requestCabin && !assignedCabin && !!cabinError); // Désactivé si saving OU si cabine demandée mais erreur

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Prenotazione per {cellCode}</h2>

        {/* Afficher le numéro de série si existant */}
        {formData.serialNumber && (
          <p className={styles.serialNumber}>
            Numero di prenotazione : <strong>{formData.serialNumber}</strong>
          </p>
        )}

        <form onSubmit={handleSave}>
          {/* Champs Nom, Prénom */}
          <div className={styles.formGroup}>
            <label htmlFor="nom">Cognome:</label>
            <input
              id="nom"
              name="nom"
              value={formData.nom || ""}
              onChange={handleChange}
              required
              autoComplete="family-name"
              type="text"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="prenom">Nome:</label>
            <input
              id="prenom"
              name="prenom"
              value={formData.prenom || ""}
              onChange={handleChange}
              required
              autoComplete="given-name"
              type="text"
            />
          </div>

          {/* Champs Lits, Registi/Poltrona */}
          <div className={styles.formGroup}>
            <label htmlFor="numBeds">Numero lettini (0-3):</label>
            <input
              id="numBeds"
              name="numBeds"
              value={formData.numBeds === undefined ? "" : formData.numBeds}
              onChange={handleChange}
              required
              min="0"
              max="3"
              type="number"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="registiPoltrona">
              + Registi (R) / Poltrona (P):
            </label>
            <input
              id="registiPoltrona"
              name="registiPoltrona"
              value={formData.registiPoltrona || ""}
              onChange={handleChange}
              maxLength="1"
              placeholder="R / P (opzionale)"
              style={{ textTransform: "uppercase" }}
              type="text"
            />
          </div>

          {/* Champs Dates */}
          <div className={styles.formGroup}>
            <label htmlFor="startDate">Primo Giorno:</label>
            <input
              id="startDate"
              name="startDate"
              value={formData.startDate || ""}
              onChange={handleChange}
              required
              min={todayString}
              type="date"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="endDate">Ultimo Giorno:</label>
            <input
              id="endDate"
              name="endDate"
              value={formData.endDate || ""}
              onChange={handleChange}
              required
              min={formData.startDate || todayString}
              type="date"
            />
          </div>

          {/* Champ Cabina */}
          <div
            className={styles.formGroup}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <label htmlFor="requestCabin" style={{ marginBottom: 0 }}>
              Richiedi Cabina:
            </label>
            <input
              type="checkbox"
              id="requestCabin"
              name="requestCabin"
              checked={requestCabin}
              onChange={handleChange}
              style={{ width: "auto", cursor: "pointer" }}
            />
            {/* Affichage de la cabine assignée ou de l'erreur/statut */}
            {requestCabin && (
              <span
                className={`${styles.assignedCabinInfo} ${
                  cabinError ? styles.errorText : ""
                }`}
              >
                {assignedCabin
                  ? `Assegnata: ${assignedCabin}`
                  : cabinError || "Ricerca..."}
              </span>
            )}
          </div>
          {/* Afficher l'erreur de manière plus proéminente si elle existe (redondant avec le span mais peut être stylé différemment) */}
          {/* {requestCabin && cabinError && <p className={styles.errorText} style={{ marginTop: '-5px' }}>{cabinError}</p>} */}

          {/* Champ Condition (Globale) */}
          <div className={styles.formGroup}>
            <label htmlFor="condition">Condizione (Periodo Intero):</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition || "jour entier"}
              onChange={handleChange}
              required
            >
              <option value="jour entier">Giorno Intero</option>
              <option value="matin">Mattina</option>
              <option value="apres-midi">Pomeriggio</option>
            </select>
          </div>

          {/* Section conditionnelle pour modifier un jour unique */}
          {showSingleDayOptions && (
            <div className={styles.singleDaySection}>
              <hr />
              <p>
                Modifica solo per il giorno:{" "}
                <strong>{formatDateForDisplay(selectedDate)}</strong>
              </p>
              <div className={styles.formGroup}>
                <label htmlFor="singleDayCondition">
                  Condizione per questo giorno:
                </label>
                <select
                  id="singleDayCondition"
                  name="singleDayCondition"
                  value={singleDayCondition}
                  onChange={handleChange}
                >
                  <option value="jour entier">Giorno Intero</option>
                  <option value="matin">Mattina</option>
                  <option value="apres-midi">Pomeriggio</option>
                </select>
              </div>
              <small>
                Selezionando una condizione diversa qui, la prenotazione
                originale verrà modificata solo per questa data.
              </small>
              <hr />
            </div>
          )}

          {/* Boutons d'action */}
          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} disabled={isSaving}>
              Esci
            </button>
            {/* Afficher Supprimer seulement si ce n'est pas une nouvelle réservation */}
            {!isNew && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={handleDeleteClick}
                disabled={isSaving || !formData.id}
              >
                Elimina
              </button>
            )}
            <button type="submit" disabled={isSaveDisabled}>
              {isSaving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
