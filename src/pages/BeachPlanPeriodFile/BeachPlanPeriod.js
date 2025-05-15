// /Users/fredericguerin/Desktop/ombrelli/src/pages/BeachPlanPeriodFile/BeachPlanPeriod.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import itLocale from "@fullcalendar/core/locales/it";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Checkbox, // Ajout pour la cabine
  FormControlLabel, // Ajout pour la cabine
  Typography, // Ajout pour le split
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  runTransaction, // Ajout pour le numéro de série et le split
  serverTimestamp, // Ajout pour les dates de création/modif
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext"; // Importer useAuth

// --- Constantes copiées ---
const VALID_CABINS = "ABCDEFGHIJKLMNOPQRSTUWXYZ".split("");

// !!! IMPORTANT : Remplacez ces placeholders par les VRAIS UID que vous avez mis dans vos règles Firestore !!!
const ADMIN_UIDS = [
  "TTbEHi8QRCTyMADYPt2N8yKB8Yg2",
  "BmT4kbaXHjguZecqMnQGEJGnqwL2",
]; // Exemple, à remplacer

export default function BeachPlanPeriod() {
  // Utilisation de useMemo pour mémoriser 'resources'
  const resources = useMemo(() => {
    const resourcesArray = [];
    const letters = ["A", "B", "C", "D"];
    letters.forEach((letter) => {
      for (let i = 1; i <= 36; i++) {
        const num = i.toString().padStart(2, "0");
        const id = `${letter}${num}`;
        resourcesArray.push({ id, title: id });
        resourcesArray.push({ id: `${id}_M`, parentId: id, title: "Mattina" });
        resourcesArray.push({
          id: `${id}_P`,
          parentId: id,
          title: "Pomeriggio",
        });
      }
    });
    return resourcesArray;
  }, []);

  // --- Utilitaires ---
  const capitalizeFirstLetter = (s) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
  const getColorForCondition = (cond) =>
    ({
      "jour entier": "#e57373", // Rouge
      matin: "#64b5f6", // Bleu
      "apres-midi": "#ffb74d", // Orange
    }[cond] || "#9e9e9e");
  const addDays = (dateStr, days) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return null;
    }
  };
  const datesOverlap = (s1, e1, s2, e2) => {
    if (!s1 || !e1 || !s2 || !e2) return false;
    return s1 <= e2 && e1 >= s2; // Comparaison directe des chaînes YYYY-MM-DD
  };
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  // --- États ---
  const [allReservations, setAllReservations] = useState([]);
  const [processedEvents, setProcessedEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    endDate: "",
    condition: "jour entier",
    numBeds: 2,
    registiPoltrona: "",
    serialNumber: null,
    id: null,
    startDate: "", // Ajouté pour la logique de cabine
  });
  const [selectedResBase, setSelectedResBase] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); // Date cliquée/sélectionnée
  const [selectedOriginal, setSelectedOriginal] = useState(null);
  const [requestCabin, setRequestCabin] = useState(false);
  const [assignedCabin, setAssignedCabin] = useState("");
  const [cabinError, setCabinError] = useState("");
  const [showSingleDayOptions, setShowSingleDayOptions] = useState(false);
  const [singleDayCondition, setSingleDayCondition] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [umbrellaConflictError, setUmbrellaConflictError] = useState(""); // Ajout état conflit ombrellone
  const { currentUser } = useAuth(); // Récupérer l'utilisateur actuel
  const isCurrentUserAdmin =
    currentUser && ADMIN_UIDS.includes(currentUser.uid); // Déterminer si admin

  // --- Traitement des réservations pour FullCalendar ---
  const processReservationsToEvents = useCallback((reservations) => {
    const evts = [];
    reservations.forEach((item) => {
      const {
        id,
        startDate,
        endDate,
        nom,
        prenom,
        condition,
        cellCode,
        cabina,
      } = item;
      if (!startDate || !cellCode) return;
      const endValid = endDate && endDate >= startDate ? endDate : startDate;
      const endCal = addDays(endValid, 1);
      const bedsText = item.numBeds !== undefined ? `(${item.numBeds}L` : "";
      const extraText = item.registiPoltrona ? `+${item.registiPoltrona}` : "";
      const cabinText = cabina ? `Cab: ${cabina}` : ""; // ajout du texte pour la cabine
      const title =
        `${nom || ""} ${prenom || ""} ${bedsText}${extraText}${
          bedsText ? ")" : ""
        }${cabinText}`.trim() || "N/A"; // Ajout de cabinText au titre
      const common = {
        extendedProps: { originalId: id },
        start: startDate,
        end: endCal,
        title,
        color: getColorForCondition(condition),
      };
      if (condition === "jour entier") {
        evts.push({ ...common, id: `${id}_M`, resourceId: `${cellCode}_M` });
        evts.push({ ...common, id: `${id}_P`, resourceId: `${cellCode}_P` });
      } else if (condition === "matin") {
        evts.push({ ...common, id: `${id}_M`, resourceId: `${cellCode}_M` });
      } else if (condition === "apres-midi") {
        evts.push({ ...common, id: `${id}_P`, resourceId: `${cellCode}_P` });
      }
    });
    return evts;
  }, []);

  // --- Génération Numéro de Série ---
  const counterDocRef = doc(db, "counters", "reservationCounter");
  const getNextSerialNumber = useCallback(async () => {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    try {
      let nextNumber = 1;
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          nextNumber = 1;
          transaction.set(counterDocRef, { lastNumber: 1 });
        } else {
          const lastNumber = counterDoc.data().lastNumber;
          if (typeof lastNumber !== "number" || isNaN(lastNumber)) {
            nextNumber = 1;
            transaction.set(counterDocRef, { lastNumber: 1 });
          } else {
            nextNumber = lastNumber + 1;
            transaction.update(counterDocRef, { lastNumber: nextNumber });
          }
        }
      });
      return `${yearPrefix}${nextNumber.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Erreur génération SN:", error);
      throw new Error("Impossible de générer le numéro de série.");
    }
  }, [counterDocRef]); // Ajout de counterDocRef aux dependances

  // --- Chargement Initial ---
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "reservations"));
        const alls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllReservations(alls);
        const evts = processReservationsToEvents(alls);
        setProcessedEvents(evts);
      } catch (error) {
        console.error("Erreur de chargement des réservations:", error);
      }
    })();
  }, [processReservationsToEvents]); // Re-run si processReservationsToEvents change (ne devrait pas)

  // --- Logique Cabine ---
  const findNextAvailableCabin = useCallback(
    (startDate, endDate, currentResId) => {
      if (!startDate || !endDate || !Array.isArray(allReservations))
        return null;
      const conflictingCabins = allReservations
        .filter(
          (res) =>
            res.cabina &&
            res.id !== currentResId &&
            datesOverlap(startDate, endDate, res.startDate, res.endDate)
        )
        .map((res) => res.cabina);
      const uniqueConflictingCabins = [...new Set(conflictingCabins)];
      for (const cabin of VALID_CABINS) {
        if (!uniqueConflictingCabins.includes(cabin)) return cabin;
      }
      return null;
    },
    [allReservations]
  );

  // --- Gestionnaires d'Événements FullCalendar ---
  const handleDateSelect = (info) => {
    if (!info.resource?.id.match(/_(M|P)$/)) return;
    const clickedDateStr = info.startStr;
    setSelectedResBase(info.resource.id.split("_")[0]);
    setSelectedDate(clickedDateStr); // Date cliquée
    setFormData({
      nom: "",
      prenom: "",
      startDate: clickedDateStr, // Date de début = date cliquée
      endDate: clickedDateStr,
      condition: info.resource.id.endsWith("_M") ? "matin" : "apres-midi",
      numBeds: 2,
      registiPoltrona: "",
      serialNumber: null,
      id: null,
    });
    setSelectedOriginal(null);
    setIsNew(true);
    setRequestCabin(false);
    setAssignedCabin("");
    setCabinError("");
    setUmbrellaConflictError("");
    setShowSingleDayOptions(false);
    setSingleDayCondition("");
    console.log("handleDateSelect called");
    setOpen(true);
  };

  const handleEventClick = (info) => {
    const orig = allReservations.find(
      (r) => r.id === info.event.extendedProps.originalId
    );
    if (orig) {
      const clickedDateStr = info.event.startStr; // Date de début de l'événement FC cliqué
      setSelectedOriginal(orig);
      setSelectedResBase(orig.cellCode);
      setSelectedDate(clickedDateStr); // Date cliquée (pour la logique split)
      setFormData({
        nom: orig.nom || "",
        prenom: orig.prenom || "",
        startDate: orig.startDate, // Dates originales de la réservation
        endDate: orig.endDate || orig.startDate,
        condition: orig.condition || "jour entier",
        numBeds: orig.numBeds === undefined ? 2 : orig.numBeds,
        registiPoltrona: orig.registiPoltrona || "",
        serialNumber: orig.serialNumber || null,
        id: orig.id,
      });
      setIsNew(false);
      setRequestCabin(!!orig.cabina);
      setAssignedCabin(orig.cabina || "");
      setCabinError("");
      setUmbrellaConflictError("");

      const isMultiDay = orig.startDate !== (orig.endDate || orig.startDate);
      const isClickedDateWithinRange =
        clickedDateStr >= orig.startDate &&
        clickedDateStr <= (orig.endDate || orig.startDate);
      const shouldShowSplit = !isNew && isMultiDay && isClickedDateWithinRange;

      setShowSingleDayOptions(shouldShowSplit);
      setSingleDayCondition(
        shouldShowSplit ? orig.condition || "jour entier" : ""
      );

      setOpen(true);
      console.log("handleEventClick called");
    } else {
      console.warn("Original reservation not found for event:", info.event);
    }
  };

  // --- Gestion Formulaire Dialogue ---
  const resetForm = () => {
    setOpen(false);
    setSelectedOriginal(null);
    setFormData({
      nom: "",
      prenom: "",
      startDate: "",
      endDate: "",
      condition: "jour entier",
      numBeds: 2,
      registiPoltrona: "",
      serialNumber: null,
      id: null,
    });
    setRequestCabin(false);
    setAssignedCabin("");
    setCabinError("");
    setUmbrellaConflictError("");
    setShowSingleDayOptions(false);
    setSingleDayCondition("");
    setIsNew(true);
  };

  // --- useEffect pour la gestion de la Cabine ---
  useEffect(() => {
    if (!open) return;

    if (requestCabin) {
      // Utiliser formData.startDate et formData.endDate qui sont mis à jour par l'utilisateur
      if (
        formData.startDate &&
        formData.endDate &&
        formData.startDate <= formData.endDate
      ) {
        const nextCabin = findNextAvailableCabin(
          formData.startDate,
          formData.endDate,
          formData.id
        );
        if (nextCabin) {
          setAssignedCabin(nextCabin);
          setCabinError("");
        } else {
          setAssignedCabin("");
          setCabinError("Nessuna cabina disponibile.");
        }
      } else {
        setAssignedCabin("");
        if (
          formData.startDate &&
          formData.endDate &&
          formData.startDate > formData.endDate
        ) {
          setCabinError("Fine prima di inizio.");
        } else {
          setCabinError("");
        }
      }
    } else {
      setAssignedCabin("");
      setCabinError("");
    }
  }, [
    open,
    requestCabin,
    formData.startDate,
    formData.endDate,
    formData.id,
    findNextAvailableCabin,
  ]);

  // --- useEffect pour la vérification de conflit d'Ombrellone ---
  useEffect(() => {
    if (!open) {
      setUmbrellaConflictError("");
      return;
    }
    setUmbrellaConflictError(""); // Reset

    if (
      !selectedResBase ||
      !formData.startDate ||
      !formData.endDate ||
      !formData.condition ||
      !Array.isArray(allReservations) ||
      formData.startDate > formData.endDate
    ) {
      return;
    }

    const currentId = formData.id;
    const currentStart = formData.startDate;
    const currentEnd = formData.endDate;
    // Utiliser la condition spécifique du jour si on est en train de splitter
    const currentCondition =
      showSingleDayOptions &&
      singleDayCondition &&
      singleDayCondition !== formData.condition
        ? singleDayCondition
        : formData.condition;

    const conflictingRes = allReservations.find((existingRes) => {
      if (currentId && existingRes.id === currentId) return false;

      if (
        existingRes.cellCode === selectedResBase &&
        datesOverlap(
          currentStart,
          currentEnd,
          existingRes.startDate,
          existingRes.endDate
        )
      ) {
        const existingCondition = existingRes.condition;
        if (
          currentCondition === "jour entier" ||
          existingCondition === "jour entier" ||
          currentCondition === existingCondition
        ) {
          return true; // Conflit trouvé
        }
      }
      return false;
    });

    if (conflictingRes) {
      let existingCondText = conflictingRes.condition
        .replace("apres-midi", "pomeriggio")
        .replace("jour entier", "giorno intero");
      const conflictStart = formatDateForDisplay(conflictingRes.startDate);
      const conflictEnd = formatDateForDisplay(conflictingRes.endDate);
      const conflictPeriod =
        conflictStart === conflictEnd
          ? `il ${conflictStart}`
          : `dal ${conflictStart} al ${conflictEnd}`;
      setUmbrellaConflictError(
        `Conflitto: Ombrellone ${selectedResBase} già prenotato (${existingCondText}) ${conflictPeriod} (Cliente: ${
          conflictingRes.nom
        } ${conflictingRes.prenom}, N° ${
          conflictingRes.serialNumber || "N/A"
        }).`
      );
    } else {
      setUmbrellaConflictError("");
    }
  }, [
    open,
    selectedResBase,
    formData.startDate,
    formData.endDate,
    formData.condition, // Condition globale
    singleDayCondition, // Condition spécifique du jour (pour split)
    showSingleDayOptions, // Pour savoir si on doit considérer singleDayCondition
    formData.id,
    allReservations,
  ]);

  // --- Sauvegarde ---
  const handleSave = async () => {
    // Validations
    if (!formData.nom) {
      alert("Cognome obbligatorio.");
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      alert("Date obbligatorie.");
      return;
    }
    if (formData.endDate < formData.startDate) {
      alert("Data fine non valida.");
      return;
    }
    if (
      formData.numBeds === "" ||
      isNaN(formData.numBeds) ||
      formData.numBeds < 0 ||
      formData.numBeds > 3
    ) {
      alert("N° lettini non valido (0-3).");
      return;
    }
    if (requestCabin && !assignedCabin && cabinError) {
      alert(`Impossibile salvare: ${cabinError}`);
      return;
    }
    if (requestCabin && !assignedCabin && !cabinError) {
      alert("Attendere assegnazione cabina o deselezionare.");
      return;
    }
    if (umbrellaConflictError) {
      alert("Impossibile salvare: " + umbrellaConflictError);
      return;
    }

    setIsSaving(true);

    const isSplitting =
      showSingleDayOptions &&
      singleDayCondition &&
      singleDayCondition !== formData.condition;
    const currentResId = selectedOriginal?.id;

    try {
      // --- CAS 1: SPLIT ---
      if (isSplitting && currentResId) {
        console.log(
          `Tentativo di split per ${selectedResBase} il ${selectedDate}`
        );
        let targetDaySerialNumber = null;
        let afterSerialNumber = null;

        targetDaySerialNumber = await getNextSerialNumber();
        if (selectedOriginal.endDate > selectedDate) {
          afterSerialNumber = await getNextSerialNumber();
        }

        const newReservationsForState = [];
        const updatesToOriginalForState = { deleted: false, endDate: null };

        await runTransaction(db, async (transaction) => {
          const originalDocRef = doc(db, "reservations", currentResId);
          const originalDoc = await transaction.get(originalDocRef);
          if (!originalDoc.exists())
            throw new Error("Prenotazione originale non trovata.");
          const originalData = originalDoc.data();

          // 1. Créer résa jour cible
          const targetDayData = {
            ...originalData,
            nom: formData.nom,
            prenom: formData.prenom || "",
            numBeds: formData.numBeds,
            registiPoltrona: formData.registiPoltrona || "",
            cabina: requestCabin ? assignedCabin : null,
            startDate: selectedDate, // Date cliquée
            endDate: selectedDate, // Date cliquée
            condition: singleDayCondition, // Nouvelle condition
            serialNumber: targetDaySerialNumber,
            cellCode: selectedResBase,
            createdAt: originalData.createdAt || serverTimestamp(),
            status: "active", // Ajout du statut pour le jour cible du split
            modifiedAt: serverTimestamp(),
          };
          delete targetDayData.id;
          const targetDayDocRef = doc(collection(db, "reservations"));
          transaction.set(targetDayDocRef, targetDayData);
          newReservationsForState.push({
            id: targetDayDocRef.id,
            ...targetDayData,
          });
          console.log(
            "Split: Creata prenotazione giorno target",
            targetDaySerialNumber
          );

          // 2. Gérer période AVANT
          if (originalData.startDate < selectedDate) {
            const newEndDate = addDays(selectedDate, -1);
            if (!newEndDate)
              throw new Error("Errore calcolo data fine 'avant'.");
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginalForState.endDate = newEndDate;
            console.log(
              "Split: Aggiornata originale (prima)",
              originalData.serialNumber,
              "nuova fine:",
              newEndDate
            );
          } else {
            updatesToOriginalForState.endDate = null; // Pas de période avant à garder
            console.log("Split: Giorno target è startDate originale.");
          }

          // 3. Gérer période APRÈS
          if (originalData.endDate > selectedDate) {
            if (!afterSerialNumber)
              throw new Error("SN mancante per periodo 'dopo'.");
            const newStartDate = addDays(selectedDate, 1);
            if (!newStartDate)
              throw new Error("Errore calcolo data inizio 'après'.");
            const afterData = {
              ...originalData,
              startDate: newStartDate,
              endDate: originalData.endDate,
              serialNumber: afterSerialNumber,
              cellCode: selectedResBase,
              createdAt: originalData.createdAt || serverTimestamp(),
              status: "active", // Ajout du statut pour la période "après" le split
              modifiedAt: serverTimestamp(),
            };
            delete afterData.id;
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservationsForState.push({ id: afterDocRef.id, ...afterData });
            console.log(
              "Split: Creata prenotazione periodo dopo",
              afterData.serialNumber,
              "inizio:",
              newStartDate
            );
          } else {
            console.log("Split: Giorno target è endDate originale.");
          }

          // 4. Supprimer l'originale si elle n'a plus de période avant valide
          if (!updatesToOriginalForState.endDate) {
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true;
            console.log(
              "Split: Prenotazione originale eliminata.",
              originalData.serialNumber
            );
          }
        }); // --- Fin Transaction ---

        // --- MàJ État Local ---
        setAllReservations((prev) => {
          let newState = [...prev];
          if (updatesToOriginalForState.deleted) {
            newState = newState.filter((res) => res.id !== currentResId);
          } else if (updatesToOriginalForState.endDate) {
            newState = newState.map((res) =>
              res.id === currentResId
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
          const finalEvents = processReservationsToEvents(newState); // Recalculer les événements
          setProcessedEvents(finalEvents); // Mettre à jour les événements affichés
          return newState; // Retourner le nouvel état des réservations brutes
        });
        console.log("Split completato.");

        // --- CAS 2: SAUVEGARDE NORMALE (Add / Update global) ---
      } else {
        const payload = {
          nom: formData.nom,
          prenom: formData.prenom || "",
          startDate: formData.startDate, // Utiliser les dates du formulaire
          endDate: formData.endDate,
          condition: formData.condition,
          cellCode: selectedResBase,
          numBeds: formData.numBeds,
          registiPoltrona: formData.registiPoltrona || "",
          cabina: requestCabin ? assignedCabin : null,
          modifiedAt: serverTimestamp(),
        };

        let updatedReservations;
        if (currentResId) {
          // Mise à jour globale
          payload.serialNumber = formData.serialNumber; // Conserver SN
          await updateDoc(doc(db, "reservations", currentResId), payload);
          console.log("Prenotazione aggiornata:", currentResId);
          // Mettre à jour l'état local
          updatedReservations = allReservations.map((res) =>
            res.id === currentResId
              ? { ...res, ...payload, modifiedAt: new Date() }
              : res
          );
        } else {
          // Nouvelle réservation
          payload.serialNumber = await getNextSerialNumber();
          payload.createdAt = serverTimestamp();
          payload.status = "active"; // Ajout du statut pour les nouvelles réservations
          const docRef = await addDoc(collection(db, "reservations"), payload);
          payload.id = docRef.id; // Ajouter l'ID pour la mise à jour de l'état local
          console.log(
            "Nuova prenotazione creata:",
            payload.id,
            "SN:",
            payload.serialNumber
          );
          // Mettre à jour l'état local
          updatedReservations = [
            ...allReservations,
            {
              ...payload,
              id: docRef.id,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ];
        }
        setAllReservations(updatedReservations);
        const finalEvents = processReservationsToEvents(updatedReservations); // Recalculer les événements
        setProcessedEvents(finalEvents); // Mettre à jour les événements affichés
      }

      resetForm();
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        if (
          calendarApi &&
          typeof calendarApi.scrollToDate === "function" &&
          formData.startDate
        ) {
          setTimeout(() => {
            console.log("Scrolling to:", formData.startDate);
            calendarApi.scrollToDate(formData.startDate);
          }, 2);
        }
      } // Fermer et réinitialiser le dialogue
    } catch (error) {
      console.error("Errore durante la sauvegarde:", error);
      alert(`Errore durante la sauvegarde: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Suppression ---
  const handleDelete = async () => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir supprimer cette réservation ?"
      ) &&
      selectedOriginal
    ) {
      setIsSaving(true);
      try {
        await deleteDoc(doc(db, "reservations", selectedOriginal.id));
        console.log("Prenotazione eliminata:", selectedOriginal.id);
        // Mettre à jour l'état local
        const updatedReservations = allReservations.filter(
          (res) => res.id !== selectedOriginal.id
        );
        setAllReservations(updatedReservations);
        const finalEvents = processReservationsToEvents(updatedReservations); // Recalculer les événements
        setProcessedEvents(finalEvents); // Mettre à jour les événements affichés
        resetForm();
      } catch (error) {
        console.error("Errore durante la suppression:", error);
        alert(`Errore durante la suppression: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // --- Thème et Rendu ---
  const theme = useTheme();
  const calendarRef = React.useRef(null);
  return (
    <Box sx={{ height: "90vh", overflow: "auto", border: "1px solid #ccc" }}>
      <Box
        sx={{
          "& .fc-scrollgrid-section-sticky": {
            position: "sticky",
            top: 0,
            zIndex: 1090,
            backgroundColor: theme.palette.background.paper, // Fond pour sticky header
          },
          "& .fc-scrollgrid-section-sticky > th": {
            // Cibler les TH directement
            backgroundColor: theme.palette.background.paper, // Assurer le fond
            overflow: "visible !important",
          },
          "& .fc-scrollgrid-section-body .fc-scroller, & .fc-scrollgrid-section-body .fc-scroller-harness":
            {
              overflow: "auto hidden !important",
            },
          // Style pour le titre de la ressource (Ombrelli)
          "& .fc-col-header-cell.fc-resource": {
            position: "sticky",
            left: 0,
            zIndex: 1091, // Au dessus des headers de date
            backgroundColor: theme.palette.background.paper,
          },
          // Style pour les cellules de ressources dans le corps
          "& .fc-datagrid-cell.fc-resource": {
            position: "sticky",
            left: 0,
            zIndex: 1089, // En dessous des headers
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`, // Ligne de séparation
          },
          // Styles pour le curseur et la bulle sur les événements
          "& .fc-event": {
            cursor: "pointer",
            position: "relative", // Pour positionner la bulle
          },
          "& .fc-event::after": {
            content: '"Clicka"',
            position: "absolute",
            bottom: "105%", // Au-dessus de l'événement
            left: "5%",
            // transform: "none",
            transform: "translateX(-50%)",
            backgroundColor: "darkviolet",
            color: "white",
            padding: "3px 6px",
            borderRadius: "3px",
            fontSize: "0.7em",
            whiteSpace: "nowrap",
            zIndex: 2000, // S'assurer qu'elle est au-dessus
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none", // Pour ne pas interférer avec le clic sur l'événement
            transition: "opacity 0.2s ease, visibility 0.2s ease",
          },
          "& .fc-event:hover::after": {
            opacity: 1,
            visibility: "visible",
          },
        }}
      >
        <FullCalendar
          plugins={[dayGridPlugin, resourceTimelinePlugin, interactionPlugin]}
          headerToolbar={false}
          initialView="resourceTimeline"
          visibleRange={{ start: "2025-04-01", end: "2025-12-02" }}
          resources={resources}
          events={processedEvents}
          selectable={true}
          select={handleDateSelect}
          selectLongPressDelay={200}
          eventClick={handleEventClick}
          ref={calendarRef}
          initialDate="2025-04-01"
          locale={itLocale}
          resourceAreaHeaderContent="Ombrelli"
          slotDuration={{ days: 1 }}
          slotLabelFormat={{
            weekday: "short",
            day: "numeric",
            month: "numeric",
            omitCommas: true,
          }}
          displayEventTime={false}
          height="auto"
          resourceAreaWidth="100px" // Ajuster si nécessaire
        />
      </Box>

      {/* --- Dialogue --- */}
      <Dialog open={open} onClose={resetForm} fullWidth maxWidth="xs">
        <DialogTitle>
          {selectedOriginal
            ? `Modifica Prenotazione (${selectedResBase})`
            : `Nuova Prenotazione (${selectedResBase} - ${formatDateForDisplay(
                formData.startDate
              )})`}
        </DialogTitle>
        <DialogContent>
          {/* Numéro de série */}
          <TextField
            margin="dense"
            label="N° Prenotazione"
            value={formData.serialNumber || (isNew ? "(Nuova)" : "N/A")}
            InputProps={{ readOnly: true }}
            variant="filled"
            size="small"
            fullWidth
          />
          {!isCurrentUserAdmin && selectedOriginal && (
            <Typography
              color="error"
              variant="body2"
              sx={{ mt: 1, mb: 1, color: "orange", fontWeight: "bold" }}
            >
              Modalità sola lettura. Contattare l'amministratore per modifiche.
            </Typography>
          )}
          {/* Cognome */}
          <TextField
            margin="dense"
            label="Cognome"
            value={formData.nom}
            onChange={(e) =>
              setFormData({
                ...formData,
                nom: capitalizeFirstLetter(e.target.value),
              })
            }
            required
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          {/* Nome */}
          <TextField
            margin="dense"
            label="Nome"
            value={formData.prenom}
            onChange={(e) =>
              setFormData({
                ...formData,
                prenom: capitalizeFirstLetter(e.target.value),
              })
            }
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          {/* Data Inizio */}
          <TextField
            margin="dense"
            label="Data Inizio"
            type="date"
            value={formData.startDate} // Utiliser formData.startDate
            onChange={(e) => {
              const newStartDate = e.target.value;
              setFormData((prev) => ({
                ...prev,
                startDate: newStartDate,
                // Ajuster endDate si elle devient antérieure à startDate
                endDate:
                  prev.endDate < newStartDate ? newStartDate : prev.endDate,
              }));
            }}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          {/* Data Fine */}
          <TextField
            margin="dense"
            label="Data Fine"
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: formData.startDate }} // Min basé sur formData.startDate
            required
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          {/* Lits */}
          <TextField
            margin="dense"
            label="N° lettini (0-3)"
            type="number"
            value={formData.numBeds ?? ""}
            onChange={(e) => {
              const val =
                e.target.value === "" ? "" : parseInt(e.target.value, 10);
              setFormData({
                ...formData,
                numBeds: isNaN(val) ? "" : Math.min(Math.max(val, 0), 3),
              });
            }}
            inputProps={{ min: 0, max: 3, step: 1 }}
            required
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          {/* Extra */}
          <TextField
            margin="dense"
            label="+ Regista (R) / Transat (T)"
            value={formData.registiPoltrona || ""}
            onChange={(e) => {
              const upperValue = e.target.value.toUpperCase();
              setFormData({
                ...formData,
                registiPoltrona: ["R", "T", ""].includes(upperValue)
                  ? upperValue
                  : formData.registiPoltrona,
              });
            }}
            inputProps={{ maxLength: 1 }}
            placeholder="R / T"
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          {/* Cabine */}
          <FormControlLabel
            control={
              <Checkbox
                checked={requestCabin}
                onChange={(e) => setRequestCabin(e.target.checked)}
                disabled={isSaving || !isCurrentUserAdmin}
              />
            }
            label={`Richiedi Cabina ${
              assignedCabin
                ? `(${assignedCabin})`
                : cabinError
                ? `(${cabinError})`
                : ""
            }`}
          />
          {/* Condition */}
          <TextField
            select
            fullWidth
            margin="dense"
            label="Condizione"
            value={formData.condition}
            onChange={(e) =>
              setFormData({ ...formData, condition: e.target.value })
            }
            required
            disabled={isSaving || !isCurrentUserAdmin} // Désactiver si sauvegarde en cours ou pas admin
          >
            <MenuItem value="jour entier">Giorno Intero</MenuItem>
            <MenuItem value="matin">Mattina</MenuItem>
            <MenuItem value="apres-midi">Pomeriggio</MenuItem>
          </TextField>

          {/* Erreur Conflit Ombrellone */}
          {umbrellaConflictError && (
            <Typography
              color="error"
              variant="caption"
              display="block"
              sx={{ mt: 1 }}
            >
              {umbrellaConflictError}
            </Typography>
          )}

          {/* Section Split */}
          {showSingleDayOptions && (
            <Box
              sx={{ border: "1px dashed grey", p: 1.5, mt: 2, borderRadius: 1 }}
            >
              <Typography variant="body2" gutterBottom>
                Modifica solo per il giorno{" "}
                <strong>{formatDateForDisplay(selectedDate)}</strong>:
              </Typography>
              <TextField
                select
                fullWidth
                margin="dense"
                label="Condizione per questo giorno"
                value={singleDayCondition}
                onChange={(e) => setSingleDayCondition(e.target.value)}
                size="small"
                disabled={isSaving || !isCurrentUserAdmin}
              >
                <MenuItem value={formData.condition || "jour entier"}>
                  -- Mantieni (
                  {(formData.condition || "jour entier")
                    .replace("jour entier", "Giorno Intero")
                    .replace("matin", "Mattina")
                    .replace("apres-midi", "Pomeriggio")}
                  ) --
                </MenuItem>
                {formData.condition !== "jour entier" && (
                  <MenuItem value="jour entier">Giorno Intero</MenuItem>
                )}
                {formData.condition !== "matin" && (
                  <MenuItem value="matin">Mattina</MenuItem>
                )}
                {formData.condition !== "apres-midi" && (
                  <MenuItem value="apres-midi">Pomeriggio</MenuItem>
                )}
              </TextField>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Selezionando una condizione diversa qui, la prenotazione verrà
                divisa.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedOriginal &&
            isCurrentUserAdmin && ( // Afficher "Cancella" seulement si admin
              <Button
                color="error"
                onClick={handleDelete}
                disabled={isSaving || !isCurrentUserAdmin}
              >
                Cancella
              </Button>
            )}
          <Button onClick={resetForm} disabled={isSaving}>
            Annulla
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              isSaving ||
              !!umbrellaConflictError ||
              (requestCabin && !assignedCabin && !!cabinError) ||
              !isCurrentUserAdmin // Désactiver si pas admin
            }
            // Cacher le bouton si pas admin ET on modifie une résa existante
            style={{
              display:
                !isCurrentUserAdmin && selectedOriginal
                  ? "none"
                  : "inline-flex",
            }}
          >
            {isSaving
              ? "Salvataggio..."
              : selectedOriginal
              ? "Modifica"
              : "Aggiungi"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
