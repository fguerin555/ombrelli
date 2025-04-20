// src/pages/BeachPlanFile/ReservationModal.js

import React, { useState, useEffect } from "react";
import styles from "./ReservationModal.module.css";

// --- Fonction utilitaire pour obtenir la date du jour au format YYYY-MM-DD ---
const getTodayString = () => {
  // ... (code inchangé)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// --- NOUVELLE Fonction utilitaire pour capitaliser la première lettre ---
const capitalizeFirstLetter = (string) => {
  if (!string) return string; // Retourne la chaîne telle quelle si vide ou null
  return string.charAt(0).toUpperCase() + string.slice(1);
};
// --- Fin nouvelle fonction utilitaire ---

const ReservationModal = ({
  isOpen,
  onClose,
  cellCode,
  reservationData,
  onSave,
  onDelete,
  isSaving,
}) => {
  const [formData, setFormData] = useState({});
  const [isNew, setIsNew] = useState(true);
  const todayString = getTodayString();

  useEffect(() => {
    // ... (code inchangé pour l'initialisation)
    if (reservationData) {
      setFormData({
        id: reservationData.id || null,
        // Applique la capitalisation aussi lors du chargement initial des données existantes
        nom: capitalizeFirstLetter(reservationData.nom || ""),
        prenom: capitalizeFirstLetter(reservationData.prenom || ""),
        numBeds: reservationData.numBeds || 2,
        startDate: reservationData.startDate || "",
        endDate: reservationData.endDate || "",
        condition: reservationData.condition || "jour entier",
        serialNumber: reservationData.serialNumber || null,
      });
      setIsNew(!reservationData.id);
    } else {
      setFormData({
        nom: "",
        prenom: "",
        numBeds: 2,
        startDate: todayString,
        endDate: todayString,
        condition: "jour entier",
        serialNumber: null,
      });
      setIsNew(true);
    }
  }, [reservationData, isOpen, todayString]); // Ajout de todayString aux dépendances (même si stable)

  // --- Modification de handleChange ---
  const handleChange = (e) => {
    const { name, value, type, valueAsNumber } = e.target;

    // Détermine la valeur à enregistrer (potentiellement transformée)
    let processedValue = type === "number" ? valueAsNumber : value;

    // Applique la capitalisation spécifiquement pour 'nom' et 'prenom'
    if (name === "nom" || name === "prenom") {
      processedValue = capitalizeFirstLetter(value);
    }

    // Met à jour l'état avec la valeur traitée
    setFormData((prev) => ({
      ...prev,
      [name]: processedValue, // Utilise la valeur traitée
    }));
  };
  // --- Fin modification de handleChange ---

  const handleSave = (e) => {
    // ... (code inchangé)
    e.preventDefault();
    onSave({ ...formData, cellCode });
  };

  const handleDeleteClick = () => {
    // ... (code inchangé)
    if (
      window.confirm(
        `Voulez-vous vraiment supprimer la réservation pour ${cellCode} ?`
      )
    ) {
      onDelete(reservationData.id);
    }
  };

  if (!isOpen) return null;

  // --- Rendu du formulaire (inchangé) ---
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Réservation pour {cellCode}</h2>
        {formData.serialNumber && (
          <p>Numéro de réservation : {formData.serialNumber}</p>
        )}
        <form onSubmit={handleSave}>
          {/* --- Champ Nom --- */}
          <div className={styles.formGroup}>
            <label htmlFor="nom">Nom:</label>
            <input
              type="text"
              id="nom"
              name="nom"
              value={formData.nom} // La valeur affichée vient de l'état (déjà capitalisée)
              onChange={handleChange}
              required
            />
          </div>
          {/* --- Champ Prénom --- */}
          <div className={styles.formGroup}>
            <label htmlFor="prenom">Prénom:</label>
            <input
              type="text"
              id="prenom"
              name="prenom"
              value={formData.prenom} // La valeur affichée vient de l'état (déjà capitalisée)
              onChange={handleChange}
              required
            />
          </div>
          {/* ... Autres champs (numBeds, startDate, endDate, condition) ... */}
          <div className={styles.formGroup}>
            <label htmlFor="numBeds">Nombre de lits:</label>
            <input
              type="number"
              id="numBeds"
              name="numBeds"
              min="0"
              value={formData.numBeds}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="startDate">Date début:</label>
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
          <div className={styles.formGroup}>
            <label htmlFor="endDate">Date fin:</label>
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
          <div className={styles.formGroup}>
            <label htmlFor="condition">Condition:</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
            >
              <option value="jour entier">Jour entier</option>
              <option value="matin">Matin</option>
              <option value="apres-midi">Après-midi</option>
            </select>
          </div>
          {/* --- Boutons (inchangés) --- */}
          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} disabled={isSaving}>
              Annuler
            </button>
            {!isNew && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={handleDeleteClick}
                disabled={isSaving}
              >
                Supprimer
              </button>
            )}
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
