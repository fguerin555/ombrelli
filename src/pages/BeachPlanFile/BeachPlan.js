// /Users/fredericguerin/Desktop/ombrelli/src/pages/BeachPlanFile/BeachPlan.js
import React, { useState, useEffect, useCallback } from "react";
import styles from "./BeachPlan.module.css"; // Assurez-vous que le chemin est correct
import ReservationModal from "./ReservationModal";
import ReservationList from "../ReservationListFile/ReservationList";
import { db } from "../../firebase"; // Assurez-vous que ce chemin est correct
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  addDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import Query from "../QueryFile/Query";
import TestQueryPlan from "../TestQueryPlanFile/TestQueryPlan";
import { useAuth } from "../../contexts/AuthContext";

// --- Fonctions Utilitaires ---
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (dateStr, days) => {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("-");
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1, // Mois est 0-indexé
      parseInt(parts[2], 10)
    );
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Erreur dans addDays avec dateStr:", dateStr, e);
    return null;
  }
};

// --- Constantes du Plan ---
const rows = ["A", "B", "C", "D"];
const columns = Array.from({ length: 36 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);

// --- Références Firestore ---
const reservationsCollectionRef = collection(db, "reservations");

const counterDocRef = doc(db, "counters", "reservationCounter");
// !!! IMPORTANT : Remplace ces placeholders par les VRAIS UID que tu as mis dans tes règles Firestore !!!
const ADMIN_UIDS = [
  "TTbEHi8QRCTyMADYPt2N8yKB8Yg2",
  "BmT4kbaXHjguZecqMnQGEJGnqwL2",
];

// --- Composant Principal ---
export default function BeachPlan() {
  // --- États ---
  const { currentUser } = useAuth();
  const [allReservations, setAllReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCellCode, setSelectedCellCode] = useState(null);
  const [currentReservationData, setCurrentReservationData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showReservationList, setShowReservationList] = useState(false);
  const isCurrentUserAdmin =
    currentUser && ADMIN_UIDS.includes(currentUser.uid);
  // --- Fonction pour obtenir le prochain numéro de série (REINTEGREE + ROBUSTE) ---
  const getNextSerialNumber = useCallback(async () => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2); // Ex: "25"
    try {
      let nextNumber = 1; // Le numéro séquentiel (1, 2, 3...)
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          nextNumber = 1;
          transaction.set(counterDocRef, { lastNumber: 1 });
        } else {
          const data = counterDoc.data(); // Bonne vérification ici
          if (
            !data ||
            typeof data.lastNumber !== "number" ||
            isNaN(data.lastNumber)
          ) {
            // Plus robuste
            console.warn(
              `Valeur 'lastNumber' invalide ou document vide (${
                data ? data.lastNumber : "data undefined"
              }) dans ${counterDocRef.path}. Réinitialisation à 1.`
            );
            nextNumber = 1;
            transaction.set(counterDocRef, { lastNumber: 1 });
          } else {
            nextNumber = data.lastNumber + 1;
            transaction.update(counterDocRef, { lastNumber: nextNumber });
          }
        }
      });
      return `${yearPrefix}${nextNumber.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Erreur lors de la génération du numéro de série:", error);
      throw new Error("Impossible de générer le numéro de série.");
    }
  }, []);

  // --- Fonction pour charger les réservations ---
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(reservationsCollectionRef);
      const querySnapshot = await getDocs(q);
      const fetchedReservations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const sanitizedReservations = fetchedReservations.map((res) => ({
        ...res,
        startDate: res.startDate || "",
        endDate: res.endDate || "",
        cabina: res.cabina !== undefined ? res.cabina : null,
        serialNumber: res.serialNumber || null,
        condition: res.condition || "",
      }));
      setAllReservations(sanitizedReservations);
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      alert("Erreur lors du chargement des réservations.");
      setAllReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- Gestionnaires d'Événements UI ---
  const handleDoubleClick = (cellCode, clickedHalf) => {
    setSelectedCellCode(cellCode);
    if (!Array.isArray(allReservations)) {
      console.error(
        "ERREUR: allReservations n'est pas un tableau!",
        allReservations
      );
      return;
    }
    const reservationsForCellOnDate = allReservations.filter(
      (res) =>
        res.cellCode === cellCode &&
        res.startDate &&
        res.endDate &&
        selectedDate >= res.startDate &&
        selectedDate <= res.endDate
    );

    const fullDayRes = reservationsForCellOnDate.find(
      (res) => res.condition === "jour entier"
    );
    const morningResOnly = reservationsForCellOnDate.find(
      (res) => res.condition === "matin"
    );
    const afternoonResOnly = reservationsForCellOnDate.find(
      (res) => res.condition === "apres-midi"
    );

    let dataForModal = null;

    if (fullDayRes) {
      // Si une réservation "jour entier" existe, elle prime.
      dataForModal = { ...fullDayRes }; // Copie pour éviter mutations directes
    } else if (morningResOnly && afternoonResOnly) {
      // Si matin ET après-midi sont réservés séparément
      dataForModal = {
        morning: { ...morningResOnly }, // Copie
        afternoon: { ...afternoonResOnly }, // Copie
        type: "dual", // Indique au modal qu'il y a deux réservations distinctes
      };
    } else if (morningResOnly) {
      // Si seulement le matin est réservé
      dataForModal = { ...morningResOnly }; // Copie
    } else if (afternoonResOnly) {
      // Si seulement l'après-midi est réservé
      dataForModal = { ...afternoonResOnly }; // Copie
    } else {
      // Aucune réservation existante pour cette cellule à cette date, préparer une nouvelle
      dataForModal = {
        nom: "",
        prenom: "",
        numBeds: 2,
        registiPoltrona: "",
        startDate: selectedDate,
        endDate: selectedDate,
        condition:
          clickedHalf === "matin"
            ? "matin"
            : clickedHalf === "apres-midi"
            ? "apres-midi"
            : "jour entier", // Pré-remplir la condition en fonction de la moitié cliquée
        serialNumber: null,
        id: null,
        cabina: null, // Assurer que cabina est null pour une nouvelle résa
      };
    }

    // Assurer que cabina est null et non undefined pour les réservations existantes (non-dual) si elle manque.
    // Pour le mode dual, le modal gère la cabina pour chaque demi-journée.
    // Pour une nouvelle réservation, cabina est déjà initialisée à null.
    if (
      dataForModal &&
      !dataForModal.type &&
      dataForModal.cabina === undefined
    ) {
      dataForModal.cabina = null;
    }

    setCurrentReservationData(dataForModal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCellCode(null);
    setCurrentReservationData(null);
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  const handleOpenList = () => {
    setShowReservationList(true);
  };

  const handleCloseList = () => {
    setShowReservationList(false);
  };

  // --- LOGIQUE DE SAUVEGARDE (handleSaveReservation) ---
  const handleSaveReservation = async (formDataFromModal) => {
    setIsSaving(true);
    try {
      const {
        cellCode,
        modifySingleDay,
        targetDate,
        targetDateCondition,
        id: reservationId,
        serialNumber: existingSerialNumber,
        ...dataToSave
      } = formDataFromModal;

      if (!cellCode) {
        alert("Errore interno: Codice ombrellone mancante.");
        throw new Error("Errore interno: Codice ombrellone mancante.");
      }

      // --- CAS 1: Modification d'un seul jour (SPLIT) ---
      if (
        modifySingleDay &&
        targetDate &&
        targetDateCondition &&
        reservationId
      ) {
        console.log(`Tentativo di split per ${cellCode} il ${targetDate}`);
        let targetDaySerialNumber = null;
        let afterSerialNumber = null;
        // Le try/catch interne pour la transaction gère ses propres erreurs et les throw
        // Si une erreur est levée ici, elle sera attrapée par le catch externe de handleSaveReservation
        targetDaySerialNumber = await getNextSerialNumber();
        const originalResCheck = allReservations.find(
          (res) => res.id === reservationId
        );
        if (originalResCheck && originalResCheck.endDate > targetDate) {
          afterSerialNumber = await getNextSerialNumber();
        }
        const newReservationsForState = [];
        const updatesToOriginalForState = { deleted: false, endDate: null };

        await runTransaction(db, async (transaction) => {
          const originalDocRef = doc(db, "reservations", reservationId);
          const originalDoc = await transaction.get(originalDocRef);
          if (!originalDoc.exists())
            throw new Error("Prenotazione originale non trovata per lo split.");
          const originalData = originalDoc.data();

          // 1. Créer résa jour cible
          const targetDayData = {
            ...originalData,
            ...dataToSave,
            startDate: targetDate,
            endDate: targetDate,
            condition: targetDateCondition,
            serialNumber: targetDaySerialNumber,
            cellCode: cellCode,
            createdAt: originalData.createdAt || serverTimestamp(),
            status: "active",
            modifiedAt: serverTimestamp(),
          };
          delete targetDayData.id;
          const targetDayDocRef = doc(collection(db, "reservations"));
          transaction.set(targetDayDocRef, targetDayData);
          newReservationsForState.push({
            id: targetDayDocRef.id,
            ...targetDayData,
          });

          // 2. Gérer période AVANT
          if (originalData.startDate < targetDate) {
            const newEndDate = addDays(targetDate, -1);
            if (!newEndDate)
              throw new Error("Errore calcolo data fine periodo 'avant'.");
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginalForState.endDate = newEndDate;
          }

          // 3. Gérer période APRÈS
          if (originalData.endDate > targetDate) {
            if (!afterSerialNumber)
              throw new Error(
                "Numero di serie mancante per il periodo 'dopo'."
              );
            const newStartDate = addDays(targetDate, 1);
            if (!newStartDate)
              throw new Error("Errore calcolo data inizio periodo 'après'.");
            const afterData = {
              ...originalData,
              startDate: newStartDate,
              endDate: originalData.endDate,
              serialNumber: afterSerialNumber,
              cellCode: cellCode,
              createdAt: originalData.createdAt || serverTimestamp(),
              status: "active",
              modifiedAt: serverTimestamp(),
            };
            delete afterData.id;
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservationsForState.push({ id: afterDocRef.id, ...afterData });
          }

          // 4. Supprimer l'originale si couverte
          if (!updatesToOriginalForState.endDate) {
            // Si la période AVANT n'a pas été mise à jour (donc le jour cible EST le début)
            if (originalData.endDate === targetDate) {
              // Et que le jour cible EST aussi la fin
              transaction.delete(originalDocRef); // Alors l'original est complètement remplacé
              updatesToOriginalForState.deleted = true;
            }
            // Si la période AVANT n'a pas été mise à jour, mais qu'il y a une période APRES,
            // l'original est implicitement supprimé car couvert par AVANT (vide) + CIBLE + APRES.
            // Cependant, la logique actuelle ne supprime que si !updatesToOriginalForState.endDate
            // et originalData.endDate > targetDate (pour créer la période après).
            // Il faut être prudent ici. Si originalData.startDate === targetDate et originalData.endDate > targetDate,
            // alors l'original est remplacé par CIBLE + APRES.
            else if (
              originalData.startDate === targetDate &&
              originalData.endDate > targetDate
            ) {
              transaction.delete(originalDocRef);
              updatesToOriginalForState.deleted = true;
            }
          }
        }); // --- Fin Transaction ---

        setAllReservations((prev) => {
          let newState = [...prev];
          if (updatesToOriginalForState.deleted) {
            newState = newState.filter((res) => res.id !== reservationId);
          } else if (updatesToOriginalForState.endDate) {
            newState = newState.map((res) =>
              res.id === reservationId
                ? {
                    ...res,
                    endDate: updatesToOriginalForState.endDate,
                    modifiedAt: new Date(),
                  }
                : res
            );
          }
          newState = [
            ...newState,
            ...newReservationsForState.map((nr) => ({
              ...nr,
              createdAt: nr.createdAt?.toDate
                ? nr.createdAt.toDate()
                : new Date(),
              modifiedAt: new Date(),
            })),
          ];
          return newState;
        });
        console.log("Split completato con successo.");
        handleCloseModal(); // Ferme le modal de BeachPlan
      } else {
        // --- CAS 2: Sauvegarde Normale (Nouvelle ou Mise à jour globale) ---
        console.log(`Tentativo di salvataggio normale per ${cellCode}`);
        let conflictFound = false;
        let conflictMessage = "";

        if (
          dataToSave.startDate &&
          dataToSave.endDate &&
          dataToSave.startDate <= dataToSave.endDate
        ) {
          const potentialConflicts = allReservations.filter(
            (res) =>
              res.id !== reservationId &&
              res.startDate &&
              res.endDate &&
              dataToSave.startDate <= res.endDate &&
              dataToSave.endDate >= res.startDate &&
              (res.cellCode === cellCode ||
                (dataToSave.cabina &&
                  res.cabina &&
                  dataToSave.cabina === res.cabina))
          );

          for (const existingRes of potentialConflicts) {
            if (existingRes.cellCode === cellCode) {
              if (
                dataToSave.condition === "jour entier" ||
                existingRes.condition === "jour entier" ||
                (dataToSave.condition === "matin" &&
                  existingRes.condition === "matin") ||
                (dataToSave.condition === "apres-midi" &&
                  existingRes.condition === "apres-midi")
              ) {
                conflictFound = true;
                conflictMessage = `Conflitto Ombrellone ${cellCode} rilevato (${
                  existingRes.condition
                }) con N° ${existingRes.serialNumber || existingRes.id} (${
                  existingRes.startDate
                } - ${existingRes.endDate}).`;
                break;
              }
            }
            if (
              dataToSave.cabina &&
              existingRes.cabina &&
              dataToSave.cabina === existingRes.cabina
            ) {
              conflictFound = true;
              conflictMessage = `Conflitto Cabina ${
                dataToSave.cabina
              } rilevato con N° ${
                existingRes.serialNumber || existingRes.id
              } (${existingRes.startDate} - ${existingRes.endDate}).`;
              break;
            }
          }
        } else if (dataToSave.startDate > dataToSave.endDate) {
          conflictFound = true;
          conflictMessage =
            "La data di fine non può essere anteriore alla data di inizio.";
        }

        if (conflictFound) {
          alert(conflictMessage);
          throw new Error(conflictMessage); // Propager l'erreur
        }

        let finalData = {
          ...dataToSave,
          cellCode,
          modifiedAt: serverTimestamp(),
        };

        if (!reservationId) {
          const newSerialNumber = await getNextSerialNumber();
          finalData = {
            ...finalData,
            serialNumber: newSerialNumber,
            createdAt: serverTimestamp(),
            status: "active",
          };
          const docRef = await addDoc(reservationsCollectionRef, finalData);
          setAllReservations((prev) => [
            ...prev,
            {
              id: docRef.id,
              ...finalData,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ]);
        } else {
          const docRef = doc(db, "reservations", reservationId);
          finalData.serialNumber = existingSerialNumber;
          await setDoc(docRef, finalData, { merge: true });
          setAllReservations((prev) =>
            prev.map((res) =>
              res.id === reservationId
                ? { ...res, ...finalData, modifiedAt: new Date() }
                : res
            )
          );
        }
        handleCloseModal(); // Ferme le modal de BeachPlan
      }
    } catch (error) {
      console.error("Errore durante il salvataggio (BeachPlan):", error);
      // L'alerte a peut-être déjà été affichée (ex: conflit, erreur de split)
      // Si ce n'est pas une erreur déjà gérée par une alerte, on peut en afficher une générique
      if (
        !error.message.startsWith("Conflitto") &&
        !error.message.includes("split")
      ) {
        alert(`Errore durante il salvataggio: ${error.message}`);
      }
      throw error; // TRÈS IMPORTANT: Renvoyer l'erreur pour que TestQueryPlan la reçoive
    } finally {
      setIsSaving(false);
    }
  }; // --- Fin handleSaveReservation ---

  // --- Fonction de suppression ---
  const handleDeleteReservation = async (reservationIdToDelete) => {
    if (!reservationIdToDelete) {
      alert("Impossibile eliminare: ID prenotazione mancante.");
      // On ne throw pas ici car c'est une validation interne, pas une erreur d'opération
      return;
    }
    const reservationToDelete = allReservations.find(
      (res) => res.id === reservationIdToDelete
    );
    const confirmMessage = reservationToDelete
      ? `Vuoi davvero cancellare la prenotazione per ${
          reservationToDelete.cellCode
        } (N° ${reservationToDelete.serialNumber || "N/A"}) ?`
      : `Vuoi davvero cancellare questa prenotazione (ID: ${reservationIdToDelete}) ?`;

    if (!window.confirm(confirmMessage)) {
      // L'utilisateur a annulé, on ne fait rien et on ne throw pas d'erreur.
      // La promesse sera résolue sans valeur, TestQueryPlan ne fermera pas son modal.
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "reservations", reservationIdToDelete);
      await deleteDoc(docRef);
      console.log("Prenotazione eliminata:", reservationIdToDelete);
      setAllReservations((prev) =>
        prev.filter((res) => res.id !== reservationIdToDelete)
      );
      handleCloseModal(); // Ferme le modal de BeachPlan
    } catch (error) {
      console.error("Errore durante l'eliminazione (BeachPlan):", error);
      alert(`Errore durante l'eliminazione: ${error.message}`);
      throw error; // TRÈS IMPORTANT: Renvoyer l'erreur
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rendu du Plan ---
  const renderBeachPlan = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingIndicator}>Caricamento Beach Plan...</div>
      );
    }
    if (!Array.isArray(allReservations)) {
      return (
        <div className={styles.errorLoading}>
          Errore: Dati prenotazioni non validi.
        </div>
      );
    }

    return (
      <div className={styles.beach_plan}>
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            {columns.map((col) => {
              const code = `${row}${col}`;
              const reservationsForCellOnDate = allReservations.filter(
                (res) =>
                  res.cellCode === code &&
                  res.startDate &&
                  res.endDate &&
                  selectedDate >= res.startDate &&
                  selectedDate <= res.endDate
              );

              // Trouver les réservations spécifiques pour ce jour/cellule
              const fullDayRes = reservationsForCellOnDate.find(
                (res) => res.condition === "jour entier"
              );
              const morningRes = reservationsForCellOnDate.find(
                (res) => res.condition === "matin"
              );
              const afternoonRes = reservationsForCellOnDate.find(
                (res) => res.condition === "apres-midi"
              );

              // Déterminer les classes CSS pour chaque moitié
              let morningClass = styles.colorEmpty;
              let afternoonClass = styles.colorEmpty;

              if (fullDayRes) {
                // Si jour entier, les deux moitiés sont rouges
                morningClass = styles.colorJourEntier;
                afternoonClass = styles.colorJourEntier;
              } else {
                // Sinon, vérifier chaque moitié indépendamment
                if (morningRes) {
                  morningClass = styles.colorMatin; // Bleu
                }
                if (afternoonRes) {
                  afternoonClass = styles.colorApresMidi; // Orange
                }
              }

              return (
                <div
                  key={code}
                  className={styles.cell}
                  title={`Ombrellone ${code}`}
                >
                  {/* Moitié Matin (supérieure) */}
                  <div
                    className={`${styles.cellHalf} ${morningClass}`}
                    onDoubleClick={() => handleDoubleClick(code, "matin")}
                  >
                    {code}{" "}
                    {/* Afficher le code seulement dans la partie supérieure */}
                  </div>
                  {/* Moitié Après-midi (inférieure) */}
                  <div
                    className={`${styles.cellHalf} ${afternoonClass}`}
                    onDoubleClick={() => handleDoubleClick(code, "apres-midi")}
                  ></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // --- Rendu JSX Principal ---
  return (
    // FIX 2: Ajout du Fragment React comme élément racine
    <>
      <div className={styles.controlsHeader}>
        <div className={styles.dateSelector}>
          <label htmlFor="planDate">
            Mappa spiaggia per il giorno :&nbsp;{" "}
          </label>
          <input
            type="date"
            id="planDate"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>{" "}
        {/* Note: Espace avant > est inhabituel mais valide */}
        {/* FIX 3: Correction de l'accès à la classe CSS avec tiret */}
        <button
          onClick={handleOpenList}
          className={`${styles["my-button"]} ${styles.viewListButton}`}
        >
          Visualizza/Stampa Lista
        </button>
      </div>

      {renderBeachPlan()}

      <ReservationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cellCode={selectedCellCode}
        reservationData={currentReservationData}
        onSave={handleSaveReservation}
        onDelete={handleDeleteReservation}
        isSaving={isSaving}
        selectedDate={selectedDate}
        allReservations={allReservations}
        isCurrentUserAdmin={isCurrentUserAdmin} // <--- Passage de la prop ici !
      />

      {showReservationList && (
        <ReservationList
          reservations={allReservations}
          selectedDate={selectedDate}
          onClose={handleCloseList}
          rows={rows}
          columns={columns}
        />
      )}
      {/* === DÉBUT DE L'INTÉGRATION DE QUERY === */}
      <section className={styles.queryIntegrationSection}>
        {" "}
        {/* Optionnel: un conteneur pour styler cette section */}
        {/* Vous pouvez ajouter un titre ici si vous le souhaitez, par exemple : */}
        {/* <h2>Recherche de disponibilité par période</h2> */}
        <Query allReservations={allReservations} />{" "}
        {/* Affichage du composant Query avec la prop */}
      </section>
      {/* === FIN DE L'INTÉGRATION DE QUERY === */}

      {/* === DÉBUT DE L'INTÉGRATION DE TESTQUERYPLAN === */}
      <section className={styles.testQueryPlanIntegrationSection}>
        {" "}
        {/* Optionnel: un conteneur pour styler cette section */}
        {/* Vous pouvez ajouter un titre ici si vous le souhaitez, par exemple : */}
        {/* <h2>Visualisation des disponibilités par période</h2> */}
        <TestQueryPlan
          allReservations={allReservations}
          onSaveReservation={handleSaveReservation} // AJOUT: Passer la fonction de sauvegarde
          onDeleteReservation={handleDeleteReservation} // AJOUT: Passer la fonction de suppression
        />{" "}
      </section>

      {/* === FIN DE L'INTÉGRATION DE TESTQUERYPLAN === */}
    </> // FIX 2: Fermeture du Fragment React
  ); // Fermeture de la parenthèse du return
}
