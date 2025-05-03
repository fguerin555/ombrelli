import {
  doc,
  runTransaction,
  collection,
  // getDoc, // getDoc n'est pas nécessaire ici car runTransaction le fait
} from "firebase/firestore";
import { db } from "../../firebase"; // Ajuste le chemin vers ton fichier firebase.js si nécessaire

/**
 * Génère le prochain numéro de série unique pour une réservation en utilisant
 * un compteur atomique dans Firestore.
 * @returns {Promise<string>} Le prochain numéro de série au format YYNNNNN (ex: "2500001").
 * @throws {Error} Si la génération du numéro échoue.
 */
export const getNextSerialNumber = async () => {
  // Référence au document compteur dans la collection 'counters'
  const counterRef = doc(collection(db, "counters"), "reservationCounter");

  try {
    // Utilise une transaction Firestore pour garantir l'atomicité (éviter les doublons)
    const newSerialNumberSuffix = await runTransaction(
      db,
      async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let newNumber;
        if (!counterDoc.exists()) {
          // Si le compteur n'existe pas, on l'initialise à 1
          newNumber = 1;
          transaction.set(counterRef, { lastNumber: newNumber });
        } else {
          // Si le compteur existe, on incrémente la dernière valeur
          const lastNumber = counterDoc.data().lastNumber || 0; // Sécurité si lastNumber est manquant
          newNumber = lastNumber + 1;
          transaction.update(counterRef, { lastNumber: newNumber });
        }
        return newNumber; // La transaction retourne le nouveau numéro (suffixe)
      }
    );

    // Préfixe avec les deux derniers chiffres de l'année actuelle
    const yearPrefix = new Date().getFullYear().toString().slice(-2); // "25" pour 2025

    // Formate le numéro complet (préfixe + suffixe paddé)
    return `${yearPrefix}${String(newSerialNumberSuffix).padStart(5, "0")}`; // Format YYNNNNN
  } catch (error) {
    console.error(
      "Erreur lors de la génération du numéro de série via transaction:",
      error
    );
    // Propager l'erreur pour que l'appelant puisse la gérer (ex: afficher un message à l'utilisateur)
    throw new Error(
      "Impossible de générer le numéro de série pour la réservation."
    );
  }
};

// Tu pourrais ajouter d'autres fonctions utilitaires liées aux réservations ici si besoin.
