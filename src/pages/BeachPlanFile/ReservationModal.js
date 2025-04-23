// src/pages/BeachPlanFile/ReservationModal.js
import React, { useState, useEffect } from "react";
import styles from "./ReservationModal.module.css";

// ... (fonctions utilitaires inchangées) ...
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const capitalizeFirstLetter = (string) => {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const ReservationModal = ({
  isOpen,
  onClose,
  cellCode,
  reservationData, // Peut être null ou un objet partiel { startDate, endDate }
  onSave,
  onDelete,
  isSaving,
  // selectedDateForNew // On peut l'utiliser si besoin, mais géré dans BeachPlan pour l'instant
}) => {
  const [formData, setFormData] = useState({});
  const [isNew, setIsNew] = useState(true);
  const todayString = getTodayString();

  useEffect(() => {
    if (isOpen) {
      const initialData = reservationData || {}; // Utiliser {} si null
      const isActuallyNew = !initialData.id;
      setIsNew(isActuallyNew);

      setFormData({
        id: initialData.id || null,
        nom: capitalizeFirstLetter(initialData.nom || ""),
        prenom: capitalizeFirstLetter(initialData.prenom || ""),
        numBeds: Math.min(initialData.numBeds || 2, 3),
        registiPoltrona: initialData.registiPoltrona || "",
        // Utiliser les dates pré-remplies si elles existent (pour nouvelle ou existante)
        startDate: initialData.startDate || todayString,
        endDate: initialData.endDate || todayString,
        // Forcer 'jour entier' si les dates sont différentes ou si c'est une résa existante multi-jours
        condition:
          initialData.startDate &&
          initialData.endDate &&
          initialData.startDate !== initialData.endDate
            ? "jour entier"
            : initialData.condition || "jour entier",
        serialNumber: initialData.serialNumber || null,
      });
    }
  }, [reservationData, isOpen, todayString]);

  const handleChange = (e) => {
    const { name, value, type, valueAsNumber } = e.target;
    let processedValue = value; // Valeur par défaut

    // --- Logique spécifique pour les champs ---
    if (name === "registiPoltrona") {
      const upperValue = value.toUpperCase();
      processedValue = ["R", "P", ""].includes(upperValue)
        ? upperValue
        : formData.registiPoltrona; // Garde l'ancienne si invalide
    } else if (name === "nom" || name === "prenom") {
      processedValue = capitalizeFirstLetter(value);
    } else if (type === "number") {
      processedValue = isNaN(valueAsNumber) ? formData[name] : valueAsNumber; // Garde l'ancienne si NaN
      if (name === "numBeds") {
        if (processedValue < 0) processedValue = 0;
        if (processedValue > 3) processedValue = 3;
      }
    }
    // Pour les dates ou select, la valeur directe est ok

    // --- Mise à jour de l'état ---
    setFormData((prev) => {
      const newState = { ...prev, [name]: processedValue };

      // --- NOUVELLE LOGIQUE: Gérer la condition basée sur les dates ---
      if (name === "startDate" || name === "endDate") {
        const newStartDate =
          name === "startDate" ? processedValue : newState.startDate;
        const newEndDate =
          name === "endDate" ? processedValue : newState.endDate;

        // Ajuster endDate si startDate la dépasse
        if (name === "startDate" && newEndDate < newStartDate) {
          newState.endDate = newStartDate;
        }
        // Ajuster startDate si endDate est avant elle (ne devrait pas arriver avec min)
        if (name === "endDate" && newStartDate > newEndDate) {
          newState.startDate = newEndDate; // Moins probable
        }

        // Si les dates (ajustées) sont différentes, forcer 'jour entier'
        if (newState.startDate !== newState.endDate) {
          newState.condition = "jour entier";
        }
        // Si les dates deviennent identiques, NE PAS changer la condition automatiquement ici
        // L'utilisateur peut choisir matin/aprem s'il le souhaite
      }

      // Si la condition est changée en matin/aprem, s'assurer que les dates sont identiques
      if (
        name === "condition" &&
        (processedValue === "matin" || processedValue === "apres-midi")
      ) {
        if (newState.startDate !== newState.endDate) {
          // Si on sélectionne matin/aprem mais que les dates sont différentes,
          // forcer la date de fin à être égale à la date de début.
          newState.endDate = newState.startDate;
        }
      }
      // --- FIN NOUVELLE LOGIQUE ---

      return newState;
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    // --- Validation finale ---
    if (
      formData.numBeds > 3 ||
      formData.numBeds < 0 ||
      isNaN(formData.numBeds)
    ) {
      alert("Le nombre de lits doit être compris entre 0 et 3.");
      return;
    }
    if (formData.endDate < formData.startDate) {
      alert("La date de fin ne peut pas être antérieure à la date de début.");
      return;
    }
    // Assurer que matin/aprem n'est que pour un seul jour
    if (
      (formData.condition === "matin" || formData.condition === "apres-midi") &&
      formData.startDate !== formData.endDate
    ) {
      alert(
        "La condition 'Matin' ou 'Après-midi' ne peut être sélectionnée que si la date de début et de fin sont identiques."
      );
      // Optionnel: forcer la condition ou bloquer
      // setFormData(prev => ({...prev, condition: 'jour entier'})); // Forcer
      return; // Bloquer
    }

    onSave({ ...formData, cellCode });
  };

  const handleDeleteClick = () => {
    if (
      window.confirm(
        `Voulez-vous vraiment supprimer la réservation pour ${cellCode} ?`
      )
    ) {
      onDelete(formData.id); // Utiliser l'ID du formData
    }
  };

  if (!isOpen) return null;

  // --- Désactiver condition si dates différentes ---
  const disableConditionChoice = formData.startDate !== formData.endDate;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Réservation pour {cellCode}</h2>
        {/* ... (serialNumber, nom, prenom, numBeds, registiPoltrona inchangés) ... */}
        {formData.serialNumber && (
          <p>Numéro de réservation : {formData.serialNumber}</p>
        )}
        <form onSubmit={handleSave}>
          {/* Champ Nom */}
          <div className={styles.formGroup}>
            <label htmlFor="nom">Cognome:</label>
            <input
              type="text"
              id="nom"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              required
            />
          </div>
          {/* Champ Prénom */}
          <div className={styles.formGroup}>
            <label htmlFor="prenom">Nome:</label>
            <input
              type="text"
              id="prenom"
              name="prenom"
              value={formData.prenom}
              onChange={handleChange}
              required
            />
          </div>
          {/* Champ Nombre de lits */}
          <div className={styles.formGroup}>
            <label htmlFor="numBeds">Numero lettini:</label>
            <input
              type="number"
              id="numBeds"
              name="numBeds"
              min="0"
              max="3"
              value={formData.numBeds}
              onChange={handleChange}
              required
            />
          </div>
          {/* Champ Registi/Poltrona */}
          <div className={styles.formGroup}>
            <label htmlFor="registiPoltrona">
              + Registi (R) / Poltrona (P):
            </label>
            <input
              type="text"
              id="registiPoltrona"
              name="registiPoltrona"
              value={formData.registiPoltrona}
              onChange={handleChange}
              maxLength="1"
              placeholder="R ou P (optionnel)"
              style={{ textTransform: "uppercase" }}
            />
          </div>
          {/* Champ Date début */}
          <div className={styles.formGroup}>
            <label htmlFor="startDate">Primo Giorno:</label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
              min={todayString}
            />
          </div>
          {/* Champ Date fin */}
          <div className={styles.formGroup}>
            <label htmlFor="endDate">Ultimo Giorno:</label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
              min={formData.startDate || todayString}
            />
          </div>
          {/* Champ Condition */}
          <div className={styles.formGroup}>
            <label htmlFor="condition">Condizione:</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
              // --- MODIFICATION: Désactiver si dates différentes ---
              disabled={disableConditionChoice}
              title={
                disableConditionChoice
                  ? "Matin/Après-midi disponible uniquement si les dates sont identiques"
                  : ""
              }
            >
              <option value="jour entier">Whole Day</option>
              {/* Afficher matin/aprem seulement si les dates sont identiques ou si la condition actuelle est déjà matin/aprem */}
              {(!disableConditionChoice || formData.condition === "matin") && (
                <option value="matin">Morning</option>
              )}
              {(!disableConditionChoice ||
                formData.condition === "apres-midi") && (
                <option value="apres-midi">Afternoon</option>
              )}
            </select>
            {/* Message si désactivé */}
            {disableConditionChoice && formData.condition !== "jour entier" && (
              <small
                style={{ color: "orange", display: "block", marginTop: "5px" }}
              >
                Condizione forzata a 'Whole Day' perché le date sono diverse.
              </small>
            )}
          </div>
          {/* Boutons */}
          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} disabled={isSaving}>
              Exit
            </button>
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
