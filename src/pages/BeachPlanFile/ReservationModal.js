// src/pages/BeachPlanFile/ReservationModal.js
import React, { useState, useEffect } from "react";
import styles from "./ReservationModal.module.css";

// Fonctions utilitaires
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// <<--- Utilisé dans useEffect et handleChange
const capitalizeFirstLetter = (string) => {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Helper pour formater la date pour l'affichage (ex: DD/MM/YYYY)
const formatDateForDisplay = (dateString) => {
  if (!dateString) return "";
  try {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

const ReservationModal = ({
  isOpen,
  onClose,
  cellCode,
  reservationData,
  onSave,
  onDelete,
  isSaving,
  selectedDate, // La date sélectionnée sur le plan
}) => {
  const [formData, setFormData] = useState({}); // <<--- setFormData est utilisé dans useEffect/handleChange
  const [isNew, setIsNew] = useState(true); // <<--- setIsNew est utilisé dans useEffect
  const todayString = getTodayString();

  // State pour la condition du jour spécifique
  const [singleDayCondition, setSingleDayCondition] = useState(""); // <<--- setSingleDayCondition est utilisé dans useEffect/handleChange
  const [showSingleDayOptions, setShowSingleDayOptions] = useState(false); // <<--- setShowSingleDayOptions est utilisé dans useEffect/handleChange

  // --- useEffect DÉCOMMENTÉ ---
  useEffect(() => {
    if (isOpen) {
      const initialData = reservationData || {};
      const isActuallyNew = !initialData.id;
      setIsNew(isActuallyNew); // <<--- Utilisation de setIsNew
      const initialCondition = initialData.condition || "jour entier";

      setFormData({
        // <<--- Utilisation de setFormData
        id: initialData.id || null,
        nom: capitalizeFirstLetter(initialData.nom || ""), // <<--- Utilisation de capitalizeFirstLetter
        prenom: capitalizeFirstLetter(initialData.prenom || ""), // <<--- Utilisation de capitalizeFirstLetter
        numBeds: Math.min(
          initialData.numBeds === undefined ? 2 : initialData.numBeds,
          3
        ), // Défaut à 2 lits si undefined
        registiPoltrona: initialData.registiPoltrona || "",
        startDate: initialData.startDate || selectedDate || todayString,
        endDate: initialData.endDate || selectedDate || todayString,
        condition: initialCondition,
        serialNumber: initialData.serialNumber || null,
      });

      // Logique pour afficher la section "For this day"
      const isEditingExisting = !isActuallyNew;
      const isMultiDay =
        initialData.startDate &&
        initialData.endDate &&
        initialData.startDate !== initialData.endDate;
      const isSelectedDateWithinRange =
        selectedDate &&
        initialData.startDate &&
        initialData.endDate &&
        selectedDate >= initialData.startDate &&
        selectedDate <= initialData.endDate;

      console.log("--- DEBUG MODAL ---");
      console.log("Reservation Data (initialData):", initialData);
      console.log("Selected Date from BeachPlan (selectedDate):", selectedDate);
      console.log(
        "Condition 1: isEditingExisting?",
        isEditingExisting,
        `(ID: ${initialData?.id})`
      );
      console.log(
        "Condition 2: isMultiDay?",
        isMultiDay,
        `(${initialData?.startDate} !== ${initialData?.endDate})`
      );
      console.log(
        "Condition 3: isSelectedDateWithinRange?",
        isSelectedDateWithinRange,
        `(${selectedDate} >= ${initialData?.startDate} && ${selectedDate} <= ${initialData?.endDate})`
      );
      console.log("--- FIN DEBUG ---");

      if (isEditingExisting && isMultiDay && isSelectedDateWithinRange) {
        setShowSingleDayOptions(true); // <<--- Utilisation de setShowSingleDayOptions
        setSingleDayCondition(initialCondition); // <<--- Utilisation de setSingleDayCondition
      } else {
        setShowSingleDayOptions(false); // <<--- Utilisation de setShowSingleDayOptions
        setSingleDayCondition(""); // <<--- Utilisation de setSingleDayCondition
      }
    } else {
      // Reset quand le modal se ferme
      setShowSingleDayOptions(false); // <<--- Utilisation de setShowSingleDayOptions
      setSingleDayCondition(""); // <<--- Utilisation de setSingleDayCondition
    }
  }, [reservationData, isOpen, todayString, selectedDate]); // Dépendances

  // --- handleChange DÉCOMMENTÉ ---
  const handleChange = (e) => {
    const { name, value, type, valueAsNumber } = e.target;

    // Gérer le changement de la condition spécifique au jour
    if (name === "singleDayCondition") {
      setSingleDayCondition(value); // <<--- Utilisation de setSingleDayCondition
      return;
    }

    let processedValue = value;
    // Logique spécifique pour les champs
    if (name === "registiPoltrona") {
      const upperValue = value.toUpperCase();
      processedValue = ["R", "P", ""].includes(upperValue)
        ? upperValue
        : formData.registiPoltrona; // Utilise formData ici
    } else if (name === "nom" || name === "prenom") {
      processedValue = capitalizeFirstLetter(value); // <<--- Utilisation de capitalizeFirstLetter
    } else if (type === "number") {
      processedValue = isNaN(valueAsNumber) ? formData[name] : valueAsNumber; // Utilise formData ici
      if (name === "numBeds") {
        if (processedValue < 0) processedValue = 0;
        if (processedValue > 3) processedValue = 3;
      }
    }

    setFormData((prev) => {
      // <<--- Utilisation de setFormData
      const newState = { ...prev, [name]: processedValue };

      // Gérer l'ajustement des dates
      if (name === "startDate" || name === "endDate") {
        const newStartDate =
          name === "startDate" ? processedValue : newState.startDate;
        const newEndDate =
          name === "endDate" ? processedValue : newState.endDate;

        if (name === "startDate" && newEndDate < newStartDate) {
          newState.endDate = newStartDate;
        }
        if (name === "endDate" && newStartDate > newEndDate) {
          newState.startDate = newEndDate;
        }

        // Si les dates globales changent, on cache potentiellement la section jour unique
        const isMultiDay = newState.startDate !== newState.endDate;
        const isSelectedDateWithinRange =
          selectedDate &&
          selectedDate >= newState.startDate &&
          selectedDate <= newState.endDate;
        // isNew est accessible depuis le scope du composant
        setShowSingleDayOptions(
          !isNew && isMultiDay && isSelectedDateWithinRange
        ); // <<--- Utilisation de setShowSingleDayOptions
      }

      return newState;
    });
  };

  // --- handleSave DÉCOMMENTÉ ---
  const handleSave = (e) => {
    e.preventDefault();
    // Validations
    if (formData.endDate < formData.startDate) {
      alert("La data di fine non può essere anteriore alla data di inizio.");
      return;
    }
    if (
      formData.numBeds > 3 ||
      formData.numBeds < 0 ||
      isNaN(formData.numBeds)
    ) {
      alert("Il numero di lettini deve essere compreso tra 0 e 3.");
      return;
    }

    // Préparer les données pour onSave
    let dataToSend = { ...formData, cellCode };

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
      dataToSend.modifySingleDay = false;
    }

    onSave(dataToSend); // Appel de la prop onSave
  };

  // --- handleDeleteClick DÉCOMMENTÉ ---
  const handleDeleteClick = () => {
    if (
      window.confirm(
        `Vuoi davvero cancellare la prenotazione per ${cellCode} (N° ${formData.serialNumber}) ?`
      )
    ) {
      onDelete(formData.id); // Appel de la prop onDelete
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Prenotazione per {cellCode}</h2>

        {formData.serialNumber && (
          <p className={styles.serialNumber}>
            Numero di prenotazione : <strong>{formData.serialNumber}</strong>
          </p>
        )}

        <form onSubmit={handleSave}>
          {/* Champs Nom, Prénom, Lits, Registi/Poltrona, Dates */}
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
          <div className={styles.formGroup}>
            <label htmlFor="numBeds">Numero lettini (max 3):</label>
            <input
              id="numBeds"
              name="numBeds"
              // Utiliser 2 comme défaut si formData.numBeds est undefined au montage initial
              value={formData.numBeds === undefined ? 2 : formData.numBeds}
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
              placeholder="R o P (opzionale)"
              style={{ textTransform: "uppercase" }}
              type="text"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="startDate">Primo Giorno:</label>
            <input
              id="startDate"
              name="startDate"
              // Assurer une valeur contrôlée même si formData.startDate est initialement undefined
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
              // Assurer une valeur contrôlée
              value={formData.endDate || ""}
              onChange={handleChange}
              required
              min={formData.startDate || todayString}
              type="date"
            />
          </div>

          {/* Champ Condition (Globale) */}
          <div className={styles.formGroup}>
            <label htmlFor="condition">Condizione (Periodo Intero):</label>
            <select
              id="condition"
              name="condition"
              // Assurer une valeur contrôlée
              value={formData.condition || "jour entier"}
              onChange={handleChange}
              required
            >
              <option value="jour entier">Whole Day</option>
              <option value="matin">Morning</option>
              <option value="apres-midi">Afternoon</option>
            </select>
          </div>

          {/* Section conditionnelle pour jour unique */}
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
                  value={singleDayCondition} // Ce state est géré séparément
                  onChange={handleChange}
                >
                  <option value="jour entier">Whole Day</option>
                  <option value="matin">Morning</option>
                  <option value="apres-midi">Afternoon</option>
                </select>
              </div>
              <small>
                Selezionando una condizione diversa qui, la prenotazione
                originale verrà modificata solo per questa data.
              </small>
              <hr />
            </div>
          )}

          {/* Boutons */}
          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} disabled={isSaving}>
              Exit
            </button>
            {/* isNew est accessible depuis le scope du composant */}
            {!isNew && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={handleDeleteClick}
                disabled={isSaving || !formData.id}
              >
                Delete
              </button>
            )}
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
