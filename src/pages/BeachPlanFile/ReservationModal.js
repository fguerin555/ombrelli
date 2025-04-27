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
    console.warn("Formatage date échoué pour:", dateStr);
    return dateStr;
  }
};

const VALID_CABINS = "ABCDEFGHIJKLMNOPQRSTUWXYZ".split("");

const datesOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;
  // Comparaison directe des chaînes YYYY-MM-DD
  return start1 <= end2 && end1 >= start2;
};
// --- Fin Fonctions Utilitaires ---

const ReservationModal = ({
  isOpen,
  onClose,
  cellCode,
  reservationData, // Données initiales (peut être null pour nouvelle)
  onSave, // Fonction appelée pour sauvegarder
  onDelete, // Fonction appelée pour supprimer
  isSaving, // Indicateur de sauvegarde en cours
  selectedDate, // Date sélectionnée sur le plan
  allReservations, // Toutes les réservations pour vérifs (cabine, conflits)
}) => {
  // --- États Internes ---
  const [formData, setFormData] = useState({}); // Données du formulaire
  const [isNew, setIsNew] = useState(true); // Est-ce une nouvelle réservation ?
  const todayString = getTodayString(); // Date du jour

  // États pour la logique complexe (split, demi-journées)
  const [mode, setMode] = useState("loading"); // 'loading', 'view', 'addHalfDay', 'editExisting'
  const [freeHalfDay, setFreeHalfDay] = useState(null); // 'matin' ou 'apres-midi' si libre
  const [existingHalfDayCondition, setExistingHalfDayCondition] =
    useState(null); // Condition existante si demi-journée
  const [singleDayCondition, setSingleDayCondition] = useState(""); // Condition choisie pour le split
  const [showSingleDayOptions, setShowSingleDayOptions] = useState(false); // Afficher options split ?

  // États pour la gestion de la cabine
  const [requestCabin, setRequestCabin] = useState(false); // Checkbox cochée ?
  const [assignedCabin, setAssignedCabin] = useState(""); // Cabine trouvée/assignée
  const [cabinError, setCabinError] = useState(""); // Erreur si pas de cabine dispo

  // État pour l'erreur de conflit d'ombrellone
  const [umbrellaConflictError, setUmbrellaConflictError] = useState("");

  // --- Fonctions Callback Mémorisées ---

  // Trouve la prochaine cabine dispo pour une période donnée
  const findNextAvailableCabin = useCallback(
    (startDate, endDate) => {
      if (!startDate || !endDate || !Array.isArray(allReservations))
        return null;
      const conflictingCabins = allReservations
        .filter(
          (res) =>
            res.cabina &&
            res.id !== formData.id && // Exclure la réservation actuelle si on édite
            datesOverlap(startDate, endDate, res.startDate, res.endDate)
        )
        .map((res) => res.cabina);
      const uniqueConflictingCabins = [...new Set(conflictingCabins)];
      for (const cabin of VALID_CABINS) {
        if (!uniqueConflictingCabins.includes(cabin)) return cabin;
      }
      return null; // Aucune trouvée
    },
    [allReservations, formData.id] // Dépend de toutes les réservations et de l'ID actuel
  );

  // Réinitialise le formulaire pour une NOUVELLE réservation (utilisé par useEffect et handleAddHalfDayClick)
  const resetFormForNew = useCallback(
    (condition = "jour entier", keepDates = false) => {
      setFormData((prev) => ({
        id: null, // Pas d'ID pour une nouvelle
        serialNumber: null, // Pas de SN pour une nouvelle
        nom: "",
        prenom: "",
        numBeds: 2,
        registiPoltrona: "",
        startDate: keepDates ? prev.startDate : selectedDate || todayString,
        endDate: keepDates ? prev.endDate : selectedDate || todayString,
        condition: condition,
      }));
      setRequestCabin(false); // Pas de cabine par défaut
      setAssignedCabin("");
      setCabinError("");
      setUmbrellaConflictError(""); // Reset aussi l'erreur d'ombrellone
      setShowSingleDayOptions(false); // Cacher options split
    },
    [selectedDate, todayString] // Dépendances de useCallback
  );

  // --- useEffect Principal: Initialisation et Détermination du Mode ---
  // Gère l'état initial du modal quand il s'ouvre ou que les données changent
  useEffect(() => {
    if (isOpen) {
      setMode("loading"); // Commence en chargement
      setFreeHalfDay(null);
      setExistingHalfDayCondition(null);
      setUmbrellaConflictError(""); // Reset erreur ombrellone à l'ouverture

      const initialData = reservationData || {};
      const isActuallyNew = !initialData.id;
      setIsNew(isActuallyNew);

      // 1. Charger données initiales dans le formulaire
      const initialCondition = initialData.condition || "jour entier";
      const initialStartDate =
        initialData.startDate || selectedDate || todayString;
      const initialEndDate = initialData.endDate || selectedDate || todayString;

      setFormData({
        id: initialData.id || null,
        serialNumber: initialData.serialNumber || null,
        nom: capitalizeFirstLetter(initialData.nom || ""),
        prenom: capitalizeFirstLetter(initialData.prenom || ""),
        numBeds:
          initialData.numBeds === undefined
            ? 2
            : Math.min(Math.max(Number(initialData.numBeds) || 0, 0), 3),
        registiPoltrona: initialData.registiPoltrona || "",
        startDate: initialStartDate,
        endDate: initialEndDate,
        condition: initialCondition,
      });

      // Initialiser état cabine
      const initialRequestCabin = !!initialData.cabina;
      setRequestCabin(initialRequestCabin);
      setAssignedCabin(initialData.cabina || "");
      setCabinError("");

      // 2. Déterminer le Mode d'affichage/édition
      let determinedMode = "editExisting"; // Mode par défaut

      // Cas spécifique: réservation existante demi-journée sur la date sélectionnée
      if (
        !isActuallyNew &&
        initialCondition !== "jour entier" &&
        selectedDate >= initialStartDate &&
        selectedDate <= initialEndDate
      ) {
        setExistingHalfDayCondition(initialCondition);
        const otherHalf = initialCondition === "matin" ? "apres-midi" : "matin";

        // Vérifier si l'autre moitié est libre sur cette date
        const conflictWithOtherHalf = allReservations.some(
          (res) =>
            res.id !== initialData.id && // Exclure soi-même
            res.cellCode === cellCode &&
            selectedDate >= res.startDate &&
            selectedDate <= res.endDate &&
            (res.condition === otherHalf || res.condition === "jour entier")
        );

        if (!conflictWithOtherHalf) {
          setFreeHalfDay(otherHalf);
          determinedMode = "view"; // Mode 'vue' pour proposer choix (ajouter/modifier)
        } else {
          determinedMode = "editExisting"; // Autre moitié prise, on ne peut qu'éditer l'existante
        }
      }
      // Cas: réservation existante (jour entier ou hors date sélectionnée)
      else if (!isActuallyNew) {
        determinedMode = "editExisting"; // Mode édition classique
      }
      // Cas: cellule vide (nouvelle réservation)
      else {
        determinedMode = "editExisting"; // Mode édition pour créer la nouvelle
        resetFormForNew("jour entier", false); // Préparer form pour nouvelle (assure SN=null)
      }
      setMode(determinedMode); // Appliquer le mode déterminé

      // 3. Gérer l'option "split" (uniquement en mode édition existante)
      const isMultiDay = initialStartDate !== initialEndDate;
      const isSelectedDateWithinRange =
        selectedDate &&
        selectedDate >= initialStartDate &&
        selectedDate <= initialEndDate;

      // La lecture de 'mode' ici utilise la valeur déterminée plus tôt dans *cette* exécution de l'effet.
      // Ajouter 'mode' aux dépendances causerait des boucles infinies car l'effet le définit aussi.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const shouldShowSplit = // <-- Commentaire ESLint bien placé ici
        !isActuallyNew && // Doit être une résa existante
        isMultiDay && // Doit couvrir plusieurs jours
        isSelectedDateWithinRange && // La date sélectionnée doit être dans la plage
        determinedMode === "editExisting"; // <-- 'mode' est lu ici

      setShowSingleDayOptions(shouldShowSplit);
      // Pré-remplir la condition du jour unique avec la condition globale si split possible
      setSingleDayCondition(shouldShowSplit ? initialCondition : "");
    } else {
      // Modal fermé: Reset complet de tous les états
      setMode("loading");
      setFormData({}); // Vider formulaire
      setIsNew(true);
      setFreeHalfDay(null);
      setExistingHalfDayCondition(null);
      setRequestCabin(false);
      setAssignedCabin("");
      setCabinError("");
      setUmbrellaConflictError("");
      setShowSingleDayOptions(false);
      setSingleDayCondition("");
    }
  }, [
    // <-- Tableau de dépendances du 1er useEffect (sans 'mode')
    reservationData,
    isOpen,
    selectedDate,
    todayString,
    allReservations,
    cellCode,
    resetFormForNew,
  ]);

  // --- useEffect pour la gestion de la Cabine ---
  useEffect(() => {
    if (!isOpen) return;

    if (requestCabin) {
      if (
        formData.startDate &&
        formData.endDate &&
        formData.startDate <= formData.endDate
      ) {
        const nextCabin = findNextAvailableCabin(
          formData.startDate,
          formData.endDate
        );
        if (nextCabin) {
          setAssignedCabin(nextCabin);
          setCabinError("");
        } else {
          setAssignedCabin("");
          setCabinError("Nessuna cabina disponibile.");
        }
      } else {
        setAssignedCabin("");
        if (
          formData.startDate &&
          formData.endDate &&
          formData.startDate > formData.endDate
        ) {
          setCabinError("Fine prima di inizio.");
        } else {
          setCabinError("");
        }
      }
    } else {
      setAssignedCabin("");
      setCabinError("");
    }
  }, [
    isOpen,
    requestCabin,
    formData.startDate,
    formData.endDate,
    findNextAvailableCabin,
  ]);

  // --- useEffect pour la vérification de conflit d'Ombrellone ---
  useEffect(() => {
    // Ne pas vérifier si modal fermé, en chargement, ou en mode vue simple
    if (!isOpen || mode === "loading" || mode === "view") {
      // 'mode' est lu ici
      setUmbrellaConflictError("");
      return;
    }
    setUmbrellaConflictError(""); // Reset au début

    if (
      !cellCode ||
      !formData.startDate ||
      !formData.endDate ||
      !formData.condition ||
      !Array.isArray(allReservations) ||
      formData.startDate > formData.endDate
    ) {
      return; // Pas assez d'infos ou dates invalides
    }

    const currentId = formData.id;
    const currentStart = formData.startDate;
    const currentEnd = formData.endDate;
    const currentCondition = formData.condition;

    // Trouver la première réservation conflictuelle
    const conflictingRes = allReservations.find((existingRes) => {
      if (currentId && existingRes.id === currentId) return false; // Ignorer soi-même

      if (
        existingRes.cellCode === cellCode &&
        datesOverlap(
          currentStart,
          currentEnd,
          existingRes.startDate,
          existingRes.endDate
        )
      ) {
        const existingCondition = existingRes.condition;
        if (
          currentCondition === "jour entier" ||
          existingCondition === "jour entier" ||
          currentCondition === existingCondition
        ) {
          return true; // Conflit trouvé
        }
      }
      return false;
    });

    // Si un conflit a été trouvé, construire le message d'erreur
    if (conflictingRes) {
      let existingCondText = conflictingRes.condition
        .replace("apres-midi", "pomeriggio")
        .replace("jour entier", "giorno intero");
      const conflictStart = formatDateForDisplay(conflictingRes.startDate);
      const conflictEnd = formatDateForDisplay(conflictingRes.endDate);
      const conflictPeriod =
        conflictStart === conflictEnd
          ? `il ${conflictStart}`
          : `dal ${conflictStart} al ${conflictEnd}`;
      setUmbrellaConflictError(
        `Conflitto: Ombrellone ${cellCode} già prenotato (${existingCondText}) ${conflictPeriod} (Cliente: ${
          conflictingRes.nom
        } ${conflictingRes.prenom}, N° ${
          conflictingRes.serialNumber || "N/A"
        }). Modificare date o condizione.`
      );
    } else {
      setUmbrellaConflictError(""); // Pas de conflit trouvé
    }
  }, [
    // <-- Tableau de dépendances du 2nd useEffect (AVEC 'mode')
    isOpen,
    mode, // <--- 'mode' est bien inclus ici
    cellCode,
    formData.startDate,
    formData.endDate,
    formData.condition,
    formData.id,
    allReservations,
  ]);

  // --- Gestionnaires d'Événements du Formulaire ---

  const handleAddHalfDayClick = () => {
    resetFormForNew(freeHalfDay, true);
    setMode("addHalfDay");
  };

  const handleEditExistingClick = () => {
    setMode("editExisting");
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "requestCabin") {
      setRequestCabin(checked);
      return;
    }

    if (name === "singleDayCondition") {
      setSingleDayCondition(value);
      return;
    }

    let processedValue = value;
    if (name === "registiPoltrona") {
      const upperValue = value.toUpperCase();
      processedValue = ["R", "P", ""].includes(upperValue)
        ? upperValue
        : formData.registiPoltrona;
    } else if (name === "nom" || name === "prenom") {
      processedValue = capitalizeFirstLetter(value);
    } else if (type === "number") {
      const numValue = e.target.valueAsNumber;
      processedValue = isNaN(numValue) ? "" : numValue;
      if (name === "numBeds" && typeof processedValue === "number") {
        processedValue = Math.min(Math.max(processedValue, 0), 3);
      }
    }

    setFormData((prev) => {
      const newState = { ...prev, [name]: processedValue };

      if (
        name === "startDate" &&
        newState.endDate &&
        newState.endDate < processedValue
      ) {
        newState.endDate = processedValue;
      }
      if (
        name === "endDate" &&
        newState.startDate &&
        processedValue < newState.startDate
      ) {
        newState.startDate = processedValue;
      }

      if (mode === "editExisting") {
        const isMultiDay =
          newState.startDate &&
          newState.endDate &&
          newState.startDate !== newState.endDate;
        const isSelectedDateWithinRange =
          selectedDate &&
          newState.startDate &&
          newState.endDate &&
          selectedDate >= newState.startDate &&
          selectedDate <= newState.endDate;
        setShowSingleDayOptions(
          !isNew && isMultiDay && isSelectedDateWithinRange
        );
      } else {
        setShowSingleDayOptions(false);
      }
      return newState;
    });
  };

  const handleSave = (e) => {
    e.preventDefault();

    // Validations
    if (!formData.nom || !formData.prenom) {
      alert("Cognome e Nome sono obbligatori.");
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      alert("Le date di inizio e fine sono obbligatorie.");
      return;
    }
    if (formData.endDate < formData.startDate) {
      alert("La data di fine non può essere precedente alla data di inizio.");
      return;
    }
    if (
      formData.numBeds === "" ||
      isNaN(formData.numBeds) ||
      formData.numBeds < 0 ||
      formData.numBeds > 3
    ) {
      alert("Il numero di lettini deve essere compreso tra 0 e 3.");
      return;
    }
    if (requestCabin && !assignedCabin && cabinError) {
      alert(`Impossibile salvare: ${cabinError}`);
      return;
    }
    if (requestCabin && !assignedCabin && !cabinError) {
      alert(
        "Attendere l'assegnazione della cabina o deselezionare la richiesta."
      );
      return;
    }
    if (umbrellaConflictError) {
      alert(
        "Impossibile salvare a causa di un conflitto con un'altra prenotazione.\n" +
          umbrellaConflictError
      );
      return;
    }

    // Préparation données
    let dataToSend = {
      ...formData,
      cellCode,
      cabina: requestCabin && assignedCabin ? assignedCabin : null,
    };

    // Forcer création si nécessaire
    if (mode === "addHalfDay") {
      console.log("Salvataggio 'addHalfDay', forzando creazione.");
      delete dataToSend.id;
      delete dataToSend.serialNumber;
    } else if (mode === "editExisting") {
      if (
        reservationData &&
        reservationData.id &&
        (formData.nom !== capitalizeFirstLetter(reservationData.nom || "") ||
          formData.prenom !==
            capitalizeFirstLetter(reservationData.prenom || ""))
      ) {
        console.log(
          "Salvataggio 'editExisting' con cambio nome/cognome, forzando creazione."
        );
        delete dataToSend.id;
        delete dataToSend.serialNumber;
      }
    }

    // Gestion Split
    if (
      mode === "editExisting" &&
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
      dataToSend.modifySingleDay = false;
    }

    onSave(dataToSend);
  };

  const handleDeleteClick = () => {
    if (formData.id) {
      onDelete(formData.id);
    } else {
      alert("Eliminazione non applicabile per una nuova prenotazione.");
    }
  };

  // --- Rendu JSX ---
  if (!isOpen) return null;

  const isSaveDisabled =
    isSaving ||
    (requestCabin && !assignedCabin && !!cabinError) ||
    !!umbrellaConflictError;

  const isImplicitlyNew =
    mode === "addHalfDay" ||
    (mode === "editExisting" &&
      reservationData &&
      reservationData.id &&
      (formData.nom !== capitalizeFirstLetter(reservationData.nom || "") ||
        formData.prenom !==
          capitalizeFirstLetter(reservationData.prenom || "")));

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Titre */}
        <h2>
          {mode === "addHalfDay"
            ? "Nuova Prenotazione"
            : isNew && mode !== "view"
            ? "Nuova Prenotazione"
            : "Modifica Prenotazione"}
          {" per "}
          <strong>{cellCode}</strong>
        </h2>

        {/* Section Choix (mode='view') */}
        {mode === "view" && freeHalfDay && (
          <div className={styles.actionChoiceSection}>
            <p>
              Prenotazione esistente per{" "}
              <strong>
                {existingHalfDayCondition === "matin"
                  ? "la Mattina"
                  : "il Pomeriggio"}
              </strong>
              .
            </p>
            <p>
              L'altra metà giornata (
              <strong>
                {freeHalfDay === "matin" ? "Mattina" : "Pomeriggio"}
              </strong>
              ) è libera il {formatDateForDisplay(selectedDate)}.
            </p>
            <p>Cosa vuoi fare?</p>
            <div className={styles.buttonGroupChoice}>
              <button
                onClick={handleAddHalfDayClick}
                className={styles.choiceButton}
              >
                Aggiungi Nuova (
                {freeHalfDay === "matin" ? "Mattina" : "Pomeriggio"})
              </button>
              <button
                onClick={handleEditExistingClick}
                className={styles.choiceButton}
              >
                Modifica Esistente (
                {existingHalfDayCondition === "matin"
                  ? "Mattina"
                  : "Pomeriggio"}
                )
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ marginTop: "15px" }}
            >
              Annulla / Esci
            </button>
          </div>
        )}

        {/* Formulaire (mode='editExisting' ou 'addHalfDay') */}
        {(mode === "editExisting" || mode === "addHalfDay") && (
          <form onSubmit={handleSave}>
            {/* Numéro de série */}
            {formData.serialNumber &&
              mode === "editExisting" &&
              !isImplicitlyNew && (
                <p className={styles.serialNumber}>
                  N° Prenotazione: <strong>{formData.serialNumber}</strong>
                </p>
              )}

            {/* Condition */}
            <div className={styles.formGroup}>
              <label htmlFor="condition">Condizione:</label>
              <select
                id="condition"
                name="condition"
                value={formData.condition || "jour entier"}
                onChange={handleChange}
                required
                disabled={mode === "addHalfDay"}
              >
                <option value="jour entier">Giorno Intero</option>
                <option value="matin">Mattina</option>
                <option value="apres-midi">Pomeriggio</option>
              </select>
              {mode === "addHalfDay" && (
                <small style={{ marginLeft: "10px" }}>
                  (Per la mezza giornata libera)
                </small>
              )}
            </div>

            {/* Erreur Conflit Ombrellone */}
            {umbrellaConflictError && (
              <p
                className={styles.errorText}
                style={{
                  color: "red",
                  fontWeight: "bold",
                  marginTop: "-5px",
                  marginBottom: "10px",
                }}
              >
                {umbrellaConflictError}
              </p>
            )}

            {/* Nom, Prénom */}
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
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
              <div className={styles.formGroup} style={{ flex: 1 }}>
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
            </div>

            {/* Lits, Extra */}
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="numBeds">N° lettini (0-3):</label>
                <input
                  id="numBeds"
                  name="numBeds"
                  value={formData.numBeds ?? ""}
                  onChange={handleChange}
                  required
                  min="0"
                  max="3"
                  type="number"
                  step="1"
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="registiPoltrona">
                  + Regista (R) / Poltrona (P):
                </label>
                <input
                  id="registiPoltrona"
                  name="registiPoltrona"
                  value={formData.registiPoltrona || ""}
                  onChange={handleChange}
                  maxLength="1"
                  placeholder="R / P"
                  style={{ textTransform: "uppercase" }}
                  type="text"
                />
              </div>
            </div>

            {/* Dates */}
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="startDate">Primo Giorno:</label>
                <input
                  id="startDate"
                  name="startDate"
                  value={formData.startDate || ""}
                  onChange={handleChange}
                  required
                  type="date"
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="endDate">Ultimo Giorno:</label>
                <input
                  id="endDate"
                  name="endDate"
                  value={formData.endDate || ""}
                  onChange={handleChange}
                  required
                  min={formData.startDate || ""}
                  type="date"
                />
              </div>
            </div>

            {/* Cabina */}
            <div
              className={styles.formGroup}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "10px",
              }}
            >
              <label
                htmlFor="requestCabin"
                style={{ marginBottom: 0, marginRight: "5px" }}
              >
                Richiedi Cabina:
              </label>
              <input
                type="checkbox"
                id="requestCabin"
                name="requestCabin"
                checked={requestCabin}
                onChange={handleChange}
                style={{
                  width: "auto",
                  cursor: "pointer",
                  transform: "scale(1.2)",
                }}
              />
              {requestCabin && (
                <span
                  className={`${styles.assignedCabinInfo} ${
                    cabinError ? styles.errorText : ""
                  }`}
                  style={{ marginLeft: "10px", fontWeight: "bold" }}
                >
                  {assignedCabin
                    ? `Assegnata: ${assignedCabin}`
                    : cabinError || "Ricerca..."}
                </span>
              )}
            </div>

            {/* Section Split */}
            {mode === "editExisting" && showSingleDayOptions && (
              <div className={styles.singleDaySection}>
                <p>
                  Modifica solo per il giorno{" "}
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
                    <option value={formData.condition || "jour entier"}>
                      -- Mantieni (
                      {formData.condition
                        .replace("jour entier", "Giorno Intero")
                        .replace("matin", "Mattina")
                        .replace("apres-midi", "Pomeriggio")}
                      ) --
                    </option>
                    {formData.condition !== "jour entier" && (
                      <option value="jour entier">Giorno Intero</option>
                    )}
                    {formData.condition !== "matin" && (
                      <option value="matin">Mattina</option>
                    )}
                    {formData.condition !== "apres-midi" && (
                      <option value="apres-midi">Pomeriggio</option>
                    )}
                  </select>
                </div>
                <small>
                  Selezionando una condizione diversa qui, la prenotazione verrà
                  divisa.
                </small>
              </div>
            )}

            {/* Boutons */}
            <div className={styles.buttonGroup}>
              <button type="button" onClick={onClose} disabled={isSaving}>
                Esci
              </button>
              {mode === "editExisting" && !isNew && !isImplicitlyNew && (
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
        )}

        {/* Chargement */}
        {mode === "loading" && <p>Caricamento...</p>}
      </div>
    </div>
  );
};

export default ReservationModal;
