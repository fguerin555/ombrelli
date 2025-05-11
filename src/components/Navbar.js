import React from "react";
import { Link } from "react-router-dom";
import "../Global.css";
import styles from "./Navbar.module.css"; // Décommentez cette ligne

const Navbar = () => {
  return (
    <nav className={styles.navbar}>
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
          <Link to="/testqueryname">
            Ricerca per Cognome/Nome/N°prenotazione
          </Link>
        </li>

        {/* <li>
          <Link to="/qrcodereader">QR CODE Reader</Link>
        </li> */}
        <li>
          <Link to="/scan-interne">Lettore QRCode</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
