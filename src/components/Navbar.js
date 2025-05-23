import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Navbar.module.css";
import "../Global.css";

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Pour fermer le menu lors d'un changement de route
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false); // Fermer le menu après déconnexion
      navigate("/login"); // Redirige vers la page de connexion après déconnexion
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Fermer le menu quand la route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  // Ce console.log peut être utile pour le développement,
  // mais vous pourriez envisager de le supprimer pour la production.
  console.log("Navbar - currentUser au chargement initial:", currentUser);

  const DEV_EMAIL = "satorapenter@gmail.com";

  return (
    <nav className={styles.navbar}>
      {currentUser && (
        <>
          <button
            className={styles.hamburger}
            onClick={toggleMenu}
            aria-label="Menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? "✕" : "☰"} {/* Icônes pour ouvrir/fermer */}
          </button>
          <ul
            className={`${styles.navbarLinks} ${isMenuOpen ? styles.open : ""}`}
          >
            <li>
              <Link to="/Beachplan">Mappa spiaggia</Link>
            </li>
            <li>
              <Link to="/beachplanperiod">Mappa planning</Link>
            </li>
            <li>
              <Link to="/changeexchange">Cambio / Scambio</Link>
            </li>
            <li>
              <Link to="/testqueryname">Ricerca/Cognome/Nome/Prenot.</Link>
            </li>
            <li>
              <Link to="/scan-interne">Lettore QRCode</Link>
            </li>
            <li>
              <Link to="/feedbackpage">Commenti</Link>
            </li>
            {currentUser && currentUser.email === DEV_EMAIL && (
              <li>
                <Link to="/listing">Listing (Dev)</Link>
              </li>
            )}
            {/* Section utilisateur et déconnexion */}
            <li className={styles.userSection}>
              <span className={styles.userEmail}>{currentUser.email}</span>
              {/* Vérification redondante de currentUser.email ici, 
                  car toute cette section est déjà conditionnée par currentUser.
                  Cependant, cela ne cause pas de problème. */}
              {currentUser.email && (
                <button onClick={handleLogout} className={styles.logoutButton}>
                  <span> Déconnexion </span>
                </button>
              )}
            </li>
          </ul>
        </>
      )}
    </nav>
  );
};

export default Navbar;
