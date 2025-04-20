import React, { useState, useEffect, useCallback } from "react";
import styles from "./BeachPlan.module.css"; // Assurez-vous que ce fichier contient les classes .cell, .bookedFullDay, .bookedAfternoon, .bookedMorning
import ReservationModal from "./ReservationModal"; // Importer le modal
import { db } from ".//../../firebase"; // Utilisation du chemin qui fonctionne pour vous
import {
  collection,
  doc,
  setDoc, // Pour mettre à jour (avec merge)
  getDocs, // Pour charger toutes les réservations
  deleteDoc, // Pour supprimer
  query, // Pour construire la requête de chargement
  addDoc, // Pour créer une nouvelle réservation
  runTransaction, // Pour le compteur atomique
} from "firebase/firestore";

// Définition des lignes et colonnes de la grille
const rows = ["A", "B", "C", "D"];
const columns = Array.from({ length: 36 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);

// Référence à la collection Firestore pour les réservations
const reservationsCollectionRef = collection(db, "reservations");
// Référence au document compteur pour les numéros de série
const counterDocRef = doc(db, "counters", "reservationCounter");

export default function BeachPlan() {
  // --- États du composant ---
  const [reservations, setReservations] = useState({}); // Stocke les réservations chargées { cellCode: reservationData }
  const [isLoading, setIsLoading] = useState(true); // Indicateur de chargement initial
  const [isModalOpen, setIsModalOpen] = useState(false); // Contrôle l'ouverture du modal
  const [selectedCellCode, setSelectedCellCode] = useState(null); // Code de la cellule sélectionnée (ex: "A01")
  const [currentReservationData, setCurrentReservationData] = useState(null); // Données de la réservation pour le modal (ou null si nouvelle)
  const [isSaving, setIsSaving] = useState(false); // Indicateur d'opération de sauvegarde/suppression en cours

  // --- Fonction pour générer le prochain numéro de série (atomique) ---
  const getNextSerialNumber = useCallback(async () => {
    const yearPrefix = "25"; // Préfixe pour l'année 2025
    try {
      let nextNumber = 1;
      // Transaction Firestore pour garantir l'atomicité (lecture + écriture)
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          // Si le compteur n'existe pas, l'initialiser
          console.log("Compteur non trouvé, initialisation à 1.");
          nextNumber = 1;
          // Crée le document compteur avec la première valeur utilisée
          transaction.set(counterDocRef, { lastNumber: 1 });
        } else {
          // Si le compteur existe, lire la dernière valeur et l'incrémenter
          const lastNumber = counterDoc.data().lastNumber || 0;
          nextNumber = lastNumber + 1;
          // Met à jour le compteur avec la nouvelle dernière valeur
          transaction.update(counterDocRef, { lastNumber: nextNumber });
        }
      });
      // Retourne le numéro de série formaté (ex: "2500001")
      return `${yearPrefix}${nextNumber.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Erreur lors de la génération du numéro de série:", error);
      // Propager l'erreur pour la gérer dans handleSaveReservation
      throw new Error("Impossible de générer le numéro de série.");
    }
  }, []); // useCallback sans dépendances car les refs sont stables

  // --- Fonction pour charger toutes les réservations depuis Firestore ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(reservationsCollectionRef); // Requête simple pour tout récupérer
      const querySnapshot = await getDocs(q);
      const fetchedReservations = {};
      // Transforme les documents Firestore en un objet clé/valeur { cellCode: data }
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.cellCode) {
          // S'assurer que le cellCode existe
          fetchedReservations[data.cellCode] = { id: doc.id, ...data };
        } else {
          console.warn("Réservation sans cellCode trouvée, ID:", doc.id);
        }
      });
      setReservations(fetchedReservations); // Met à jour l'état React
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      alert("Erreur lors du chargement des réservations."); // Informer l'utilisateur
    } finally {
      setIsLoading(false); // Termine l'état de chargement
    }
  }, []); // useCallback sans dépendances car la ref est stable

  // --- Charger les réservations au premier montage du composant ---
  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]); // Dépendance à fetchReservations

  // --- Gérer le double-clic sur une cellule pour ouvrir le modal ---
  const handleDoubleClick = (cellCode) => {
    setSelectedCellCode(cellCode);
    // Récupère les données de réservation existantes depuis l'état local
    const existingReservation = reservations[cellCode];
    // Passe les données existantes ou null (pour une nouvelle résa) au modal
    setCurrentReservationData(existingReservation || null);
    setIsModalOpen(true); // Ouvre le modal
  };

  // --- Fermer le modal et réinitialiser les états associés ---
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellCode(null);
    setCurrentReservationData(null);
    // Ne pas réinitialiser isSaving ici, car il est géré dans les fonctions save/delete
  };

  // --- Sauvegarder une réservation (Création ou Mise à jour) ---
  const handleSaveReservation = async (formData) => {
    setIsSaving(true); // Démarre l'indicateur de sauvegarde
    // Extrait cellCode et garde le reste des données
    const { cellCode, ...dataToSave } = formData;

    if (!cellCode) {
      console.error("Tentative de sauvegarde sans cellCode:", formData);
      alert("Erreur: Le code de la cellule est manquant.");
      setIsSaving(false);
      return;
    }

    try {
      // Assure que cellCode est inclus dans les données finales
      let finalData = { ...dataToSave, cellCode };

      if (!finalData.id) {
        // --- CAS : NOUVELLE réservation ---
        let serialNumber;
        try {
          // Générer le numéro de série uniquement pour les nouvelles
          serialNumber = await getNextSerialNumber();
        } catch (serialError) {
          // Si la génération échoue, arrêter la sauvegarde
          alert(`Erreur critique: ${serialError.message}`);
          setIsSaving(false);
          return;
        }
        // Ajoute le numéro de série généré aux données
        finalData = { ...finalData, serialNumber };

        // Utilise addDoc pour créer un nouveau document avec un ID unique généré par Firestore
        const docRef = await addDoc(reservationsCollectionRef, finalData);
        console.log("Nouvelle réservation créée avec ID: ", docRef.id);

        // Met à jour l'état local immédiatement avec la nouvelle réservation et son ID
        setReservations((prev) => ({
          ...prev,
          [cellCode]: { id: docRef.id, ...finalData },
        }));
      } else {
        // --- CAS : MISE À JOUR d'une réservation existante ---
        const reservationId = finalData.id;
        // Référence au document existant via son ID
        const docRef = doc(db, "reservations", reservationId);
        // Exclut l'ID des données à mettre à jour (il est dans la référence docRef)
        const { id, ...updateData } = finalData;

        // Utilise setDoc avec merge:true pour mettre à jour uniquement les champs modifiés
        // (ou écraser les champs existants avec les nouvelles valeurs)
        await setDoc(docRef, updateData, { merge: true });
        console.log("Réservation mise à jour ID: ", reservationId);

        // Met à jour l'état local avec les données modifiées
        setReservations((prev) => ({
          ...prev,
          // Assure de garder l'ID existant avec les données mises à jour
          [cellCode]: { id: reservationId, ...updateData },
        }));
      }

      handleCloseModal(); // Ferme le modal après succès
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`); // Informer l'utilisateur
    } finally {
      setIsSaving(false); // Termine l'indicateur de sauvegarde
    }
  };

  // --- Supprimer une réservation ---
  const handleDeleteReservation = async (reservationId) => {
    // Trouve le cellCode associé à l'ID pour mettre à jour l'état local
    const cellCodeToDelete = Object.keys(reservations).find(
      (key) => reservations[key]?.id === reservationId // Ajout de ?. pour sécurité
    );

    // Vérification si l'ID ou le cellCode sont valides
    if (!reservationId || !cellCodeToDelete) {
      console.error(
        "ID de réservation ou cellCode manquant pour la suppression.",
        { reservationId, cellCodeToDelete }
      );
      alert("Erreur : Impossible de trouver la réservation à supprimer.");
      return;
    }

    setIsSaving(true); // Active l'indicateur (partagé avec sauvegarde)
    try {
      // Référence au document à supprimer
      const docRef = doc(db, "reservations", reservationId);
      // Supprime le document dans Firestore
      await deleteDoc(docRef);
      console.log("Réservation supprimée ID: ", reservationId);

      // Met à jour l'état local en supprimant l'entrée correspondante
      setReservations((prev) => {
        const newState = { ...prev };
        delete newState[cellCodeToDelete]; // Supprime la clé basée sur cellCode
        return newState;
      });

      handleCloseModal(); // Ferme le modal après succès
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert(`Erreur lors de la suppression: ${error.message}`);
    } finally {
      setIsSaving(false); // Désactive l'indicateur
    }
  };

  // --- Rendu du composant ---

  // Affiche un message pendant le chargement initial
  if (isLoading) {
    return <div>Chargement du plan de plage...</div>;
  }

  // Rendu principal de la grille et du modal
  return (
    <>
      {/* Conteneur principal de la grille */}
      <div className={styles["beach-plan"]}>
        {/* Itération sur les lignes */}
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            {/* Itération sur les colonnes */}
            {columns.map((col) => {
              const code = `${row}${col}`; // Code unique de la cellule (ex: "A01")
              // Récupère la réservation associée à cette cellule depuis l'état
              const reservation = reservations[code];

              // --- Détermination des classes CSS pour la cellule ---
              let cellClasses = [styles.cell]; // Commence toujours par la classe de base

              if (reservation) {
                // Si une réservation existe, ajoute la classe basée sur la condition
                switch (reservation.condition) {
                  case "jour entier":
                    cellClasses.push(styles.bookedFullDay); // Classe pour fond rouge
                    break;
                  case "apres-midi":
                    cellClasses.push(styles.bookedAfternoon); // Classe pour fond orange
                    break;
                  case "matin":
                    cellClasses.push(styles.bookedMorning); // Classe pour fond jaune
                    break;
                  default:
                    // Optionnel: Gérer une condition inconnue ou manquante
                    // Par exemple, appliquer une couleur par défaut pour "réservé"
                    // cellClasses.push(styles.bookedGeneric);
                    break;
                }
              }
              // --- Fin de la détermination des classes ---

              // Rendu de la cellule individuelle
              return (
                <div
                  key={code}
                  // Applique les classes CSS déterminées (ex: "cell bookedFullDay")
                  className={cellClasses.join(" ")}
                  // Attache le gestionnaire pour ouvrir le modal au double-clic
                  onDoubleClick={() => handleDoubleClick(code)}
                >
                  {code} {/* Affiche le code de la cellule */}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Intégration et rendu conditionnel du Modal */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cellCode={selectedCellCode}
        reservationData={currentReservationData} // Passe les données (ou null)
        onSave={handleSaveReservation} // Passe la fonction de sauvegarde
        onDelete={handleDeleteReservation} // Passe la fonction de suppression
        isSaving={isSaving} // Passe l'état de sauvegarde pour désactiver les boutons
      />
    </>
  );
}
