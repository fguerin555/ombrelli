import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Navbar.module.css";
import "../Global.css";

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login"); // Redirige vers la page de connexion après déconnexion
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error);
      // Vous pouvez afficher un message d'erreur à l'utilisateur ici si vous le souhaitez
    }
  };
  console.log("Navbar - currentUser au chargement initial:", currentUser);
  return (
    <nav className={styles.navbar}>
      {/* La liste de navigation ne s'affiche que si un utilisateur est connecté */}
      {currentUser && (
        <ul className={styles.navbarLinks}>
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
          {/* Section utilisateur et déconnexion */}
          <li className={styles.userSection}>
            <span className={styles.userEmail}>{currentUser.email}</span>

            {currentUser.email /* Affiche l'email s'il est disponible */ && (
              <button onClick={handleLogout} className={styles.logoutButton}>
                <span> Déconnexion </span>
              </button>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
};

export default Navbar;
