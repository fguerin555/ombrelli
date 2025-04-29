// src/components/ScrollButtons.js
import React from "react"; // Plus besoin de useState, useEffect, useCallback ici
import PropTypes from "prop-types";
import styles from "./ScrollButtons.module.css"; // Fichier CSS Module

/**
 * Affiche des boutons pour déclencher la navigation précédente/suivante
 * d'une instance FullCalendar (ou autre). Reçoit l'état désactivé depuis le parent.
 * @param {object} props - Les propriétés du composant.
 * @param {function} props.onPrevClick - Fonction à appeler pour aller à la période/page précédente.
 * @param {function} props.onNextClick - Fonction à appeler pour aller à la période/page suivante.
 * @param {boolean} props.isPrevDisabled - Indique si le bouton Précédent doit être désactivé.
 * @param {boolean} props.isNextDisabled - Indique si le bouton Suivant doit être désactivé.
 */
const ScrollButtons = ({
  onPrevClick,
  onNextClick,
  isPrevDisabled,
  isNextDisabled,
}) => {
  // Pas besoin d'état interne ou d'effets ici.
  // La logique de navigation et de désactivation est gérée par le composant parent.

  return (
    // Utilise un React.Fragment (<>) pour ne pas ajouter de div inutile dans le DOM
    <>
      <button
        className={`${styles.scrollButton} ${styles.left}`} // Applique les styles CSS
        onClick={onPrevClick} // Appelle la fonction passée en prop
        aria-label="Période précédente" // Pour l'accessibilité
        disabled={isPrevDisabled} // Utilise l'état désactivé passé en prop
      >
        &lt; {/* Symbole chevron gauche */}
      </button>
      <button
        className={`${styles.scrollButton} ${styles.right}`} // Applique les styles CSS
        onClick={onNextClick} // Appelle la fonction passée en prop
        aria-label="Période suivante" // Pour l'accessibilité
        disabled={isNextDisabled} // Utilise l'état désactivé passé en prop
      >
        &gt; {/* Symbole chevron droit */}
      </button>
    </>
  );
};

// Définition des types de props (bonne pratique)
ScrollButtons.propTypes = {
  onPrevClick: PropTypes.func.isRequired, // Fonction requise pour le clic précédent
  onNextClick: PropTypes.func.isRequired, // Fonction requise pour le clic suivant
  isPrevDisabled: PropTypes.bool.isRequired, // État désactivé requis pour le bouton précédent
  isNextDisabled: PropTypes.bool.isRequired, // État désactivé requis pour le bouton suivant
};

export default ScrollButtons;
