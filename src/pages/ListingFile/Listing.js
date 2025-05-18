import React, { useState, useEffect, useCallback } from "react";
import styles from "./Listing.module.css";
import { db } from "../../firebase"; // Assurez-vous que ce chemin est correct
import {
  collection,
  getDocs,
  query,
  orderBy as firebaseOrderBy, // Renommé pour éviter confusion potentielle
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // Importation explicite

// Fonction utilitaire pour formater les dates (similaire à celle dans ReservationModal)
const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    // Gère les objets Timestamp de Firestore et les chaînes de date
    const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Retourne la chaîne originale si invalide

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    console.warn("Formatage date échoué pour:", dateStr, e);
    return dateStr; // Retourne la chaîne originale en cas d'erreur
  }
};

const Listing = () => {
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("serialNumber"); // Champ de tri par défaut
  const [sortOrder, setSortOrder] = useState("asc"); // Ordre de tri par défaut

  const fetchReservations = useCallback(
    async (currentSortBy, currentSortOrder) => {
      setIsLoading(true);
      setError(null);
      try {
        const reservationsRef = collection(db, "reservations");
        // Firestore nécessite des index pour les requêtes orderBy complexes.
        // Si un index manque, Firestore affichera une erreur dans la console avec un lien pour le créer.
        const q = query(
          reservationsRef,
          firebaseOrderBy(currentSortBy, currentSortOrder)
        );

        const querySnapshot = await getDocs(q);
        const fetchedReservations = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReservations(fetchedReservations);
      } catch (err) {
        console.error("Erreur de récupération des réservations:", err);
        setError(
          "Impossible de charger les réservations. Vérifiez la console pour plus de détails et assurez-vous que les index Firestore sont configurés si nécessaire. Message: " +
            err.message
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchReservations(sortBy, sortOrder);
  }, [fetchReservations, sortBy, sortOrder]);

  const handleSortFieldChange = (event) => {
    setSortBy(event.target.value);
    // Optionnel: réinitialiser à 'asc' quand le champ change, ou garder l'ordre actuel
    // setSortOrder("asc");
  };

  const toggleSortOrder = () => {
    setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"));
  };

  const getSortIndicator = (field) => {
    if (sortBy === field) {
      return sortOrder === "asc" ? " ▲" : " ▼";
    }
    return "";
  };

  const handleHeaderClick = (field) => {
    if (sortBy === field) {
      toggleSortOrder();
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Listing des Réservations", 14, 16);
    doc.setFontSize(10);
    doc.text(`Total des réservations: ${reservations.length}`, 14, 22);

    const tableColumn = [
      "N° Résa",
      "Nom",
      "Prénom",
      "Début",
      "Fin",
      "Ombrellone",
      "Condition",
      "Nb. Lits",
      "Cabine",
    ];
    const tableRows = [];

    reservations.forEach((res) => {
      const reservationData = [
        res.serialNumber || "N/A",
        res.nom,
        res.prenom,
        formatDateForDisplay(res.startDate),
        formatDateForDisplay(res.endDate),
        res.cellCode,
        res.condition,
        res.numBeds,
        res.cabina || "-",
      ];
      tableRows.push(reservationData);
    });

    autoTable(doc, {
      // Utiliser autoTable comme une fonction
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 160, 133] }, // Couleur d'en-tête
    });
    doc.save(
      `listing_reservations_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  const handleCopyToClipboard = () => {
    const textData = reservations
      .map(
        (res) =>
          `N°: ${res.serialNumber || "N/A"}, Nom: ${res.nom || ""}, Prénom: ${
            res.prenom || ""
          }, Début: ${formatDateForDisplay(
            res.startDate
          )}, Fin: ${formatDateForDisplay(res.endDate)}, Ombrellone: ${
            res.cellCode
          }, Lits: ${res.numBeds}, Cabine: ${res.cabina || "-"}`
      )
      .join("\n");
    navigator.clipboard
      .writeText(
        `Total des réservations: ${reservations.length}\n\n${textData}`
      )
      .then(() => alert("Données copiées dans le presse-papiers !"))
      .catch((err) => console.error("Erreur de copie : ", err));
  };

  if (isLoading) {
    return <div className={styles.loading}>Chargement des réservations...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.listingContainer}>
      <div className={styles.listingHeader}>
        <div>
          <h2>Listing des Réservations (Dev)</h2>
          <p className={styles.totalCount}>
            Total des réservations: {reservations.length}
          </p>
        </div>
        <div className={styles.sortControls}>
          <label htmlFor="sortField">Trier par :</label>
          <select
            id="sortField"
            value={sortBy}
            onChange={handleSortFieldChange}
          >
            <option value="serialNumber">N° Réservation</option>
            <option value="nom">Nom</option>
            <option value="startDate">Date de début</option>
            {/* Ajoutez d'autres champs si nécessaire, ex: cellCode, endDate */}
          </select>
          <button onClick={toggleSortOrder}>
            Ordre: {sortOrder === "asc" ? "Croissant" : "Décroissant"}
          </button>
        </div>
      </div>
      <div className={styles.actionButtons}>
        <button onClick={handlePrint} className={styles.printButton}>
          Imprimer
        </button>
        <button onClick={handleExportPDF} className={styles.pdfButton}>
          Exporter en PDF
        </button>
        <button onClick={handleCopyToClipboard} className={styles.copyButton}>
          Copier pour Email
        </button>
      </div>

      {reservations.length === 0 ? (
        <p>Aucune réservation trouvée.</p>
      ) : (
        <table className={styles.reservationsTable}>
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick("serialNumber")}>
                N° Résa{getSortIndicator("serialNumber")}
              </th>
              <th onClick={() => handleHeaderClick("nom")}>
                Nom{getSortIndicator("nom")}
              </th>
              <th>Prénom</th>
              <th onClick={() => handleHeaderClick("startDate")}>
                Début{getSortIndicator("startDate")}
              </th>
              <th>Fin</th>
              <th>Ombrellone</th>
              <th>Condition</th>
              <th>Nb. Lits</th>
              <th>Cabine</th>
              {/* Ajoutez d'autres colonnes si besoin */}
            </tr>
          </thead>
          <tbody>
            {reservations.map((res) => (
              <tr key={res.id}>
                <td>{res.serialNumber || "N/A"}</td>
                <td>{res.nom}</td>
                <td>{res.prenom}</td>
                <td>{formatDateForDisplay(res.startDate)}</td>
                <td>{formatDateForDisplay(res.endDate)}</td>
                <td>{res.cellCode}</td>
                <td>{res.condition}</td>
                <td>{res.numBeds}</td>
                <td>{res.cabina || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Listing;
