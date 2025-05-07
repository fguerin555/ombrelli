import React from "react";
import { Link } from "react-router-dom";
import "../Global.css";
import styles from "./Navbar.module.css"; // Décommentez cette ligne

const Navbar = () => {
  return (
    <nav className={styles.navbar}>
      <ul className={styles.navbarLinks}>
        <li>
          <Link to="/Beachplan">Beach Plan Day</Link>
        </li>
        <li>
          <Link to="/query">Query</Link>
        </li>
        <li>
          <Link to="/beachplanperiod">Beach Plan Period</Link>
        </li>
        <li>
          <Link to="/changeexchange">Change / Exchange</Link>
        </li>
        <li>
          <Link to="/testqueryname">TestQuery Name</Link>
        </li>
        <li>
          <Link to="/testqueryplan">TestQuery Plan</Link>
        </li>
        <li>
          <Link to="/qrcodereader">QR CODE Reader</Link>
        </li>
        <li>
          <Link to="/scan-interne">Scanner Interne</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
