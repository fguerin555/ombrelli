// /Users/fredericguerin/Desktop/ombrelli/src/pages/BeachPlanPeriodFile/BeachPlanPeriod.js
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  const calendarRef = useRef(null); // Référence pour FullCalendar

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
  const [umbrellaConflictError, setUmbrellaConflictError] = useState("");
  const { currentUser } = useAuth();
  const isCurrentUserAdmin =
    currentUser && ADMIN_UIDS.includes(currentUser.uid);

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
      const cabinText = cabina ? `Cab: ${cabina}` : "";
      const title =
        `${nom || ""} ${prenom || ""} ${bedsText}${extraText}${
          bedsText ? ")" : ""
        }${cabinText}`.trim() || "N/A";
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
  }, [counterDocRef]);

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
  }, [processReservationsToEvents]);

  // --- useEffect pour charger la dernière date vue depuis localStorage ---
  useEffect(() => {
    const lastViewedDate = localStorage.getItem("beachPlanLastViewedDate");
    if (lastViewedDate && calendarRef.current) {
      // Utiliser un setTimeout pour s'assurer que FullCalendar est pleinement initialisé
      setTimeout(() => {
        try {
          const calendarApi = calendarRef.current.getApi();
          if (calendarApi && typeof calendarApi.gotoDate === "function") {
            calendarApi.gotoDate(lastViewedDate);
            console.log(
              "Initial load - Navigated to last viewed date:",
              lastViewedDate
            );
          } else {
            console.warn(
              "gotoDate not available on calendarApi during initial load"
            );
          }
        } catch (e) {
          console.error("Erreur gotoDate au chargement initial:", e);
        }
      }, 100); // Un délai un peu plus long pour l'initialisation
    }
  }, []); // Tableau de dépendances vide pour ne s'exécuter qu'au montage

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
    localStorage.setItem("beachPlanLastViewedDate", clickedDateStr);

    setSelectedResBase(info.resource.id.split("_")[0]);
    setSelectedDate(clickedDateStr);
    setFormData({
      nom: "",
      prenom: "",
      startDate: clickedDateStr,
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

    if (calendarRef.current) {
      try {
        const calendarApi = calendarRef.current.getApi();
        if (calendarApi && typeof calendarApi.gotoDate === "function") {
          calendarApi.gotoDate(clickedDateStr);
          // console.log("handleDateSelect - Navigated to:", clickedDateStr);
        } else {
          console.warn(
            "gotoDate not available on calendarApi in handleDateSelect"
          );
        }
      } catch (e) {
        console.error("Erreur gotoDate dans handleDateSelect:", e);
      }
    }
    setOpen(true);
  };

  const handleEventClick = (info) => {
    const orig = allReservations.find(
      (r) => r.id === info.event.extendedProps.originalId
    );
    if (orig) {
      const clickedDateStr = info.event.startStr;
      localStorage.setItem("beachPlanLastViewedDate", clickedDateStr);

      setSelectedOriginal(orig);
      setSelectedResBase(orig.cellCode);
      setSelectedDate(clickedDateStr);
      setFormData({
        nom: orig.nom || "",
        prenom: orig.prenom || "",
        startDate: orig.startDate,
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

      if (calendarRef.current) {
        try {
          const calendarApi = calendarRef.current.getApi();
          if (calendarApi && typeof calendarApi.gotoDate === "function") {
            calendarApi.gotoDate(clickedDateStr);
            // console.log("handleEventClick - Navigated to:", clickedDateStr);
          } else {
            console.warn(
              "gotoDate not available on calendarApi in handleEventClick"
            );
          }
        } catch (e) {
          console.error("Erreur gotoDate dans handleEventClick:", e);
        }
      }
      setOpen(true);
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
    setUmbrellaConflictError("");

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
          return true;
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
    formData.condition,
    singleDayCondition,
    showSingleDayOptions,
    formData.id,
    allReservations,
  ]);

  // --- Sauvegarde ---
  const handleSave = async () => {
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
    const dateToNavigateAfterSave = formData.startDate; // Capturer avant resetForm

    try {
      if (isSplitting && currentResId) {
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

          const targetDayData = {
            ...originalData,
            nom: formData.nom,
            prenom: formData.prenom || "",
            numBeds: formData.numBeds,
            registiPoltrona: formData.registiPoltrona || "",
            cabina: requestCabin ? assignedCabin : null,
            startDate: selectedDate,
            endDate: selectedDate,
            condition: singleDayCondition,
            serialNumber: targetDaySerialNumber,
            cellCode: selectedResBase,
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

          if (originalData.startDate < selectedDate) {
            const newEndDate = addDays(selectedDate, -1);
            if (!newEndDate)
              throw new Error("Errore calcolo data fine 'avant'.");
            transaction.update(originalDocRef, {
              endDate: newEndDate,
              modifiedAt: serverTimestamp(),
            });
            updatesToOriginalForState.endDate = newEndDate;
          } else {
            updatesToOriginalForState.endDate = null;
          }

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
              status: "active",
              modifiedAt: serverTimestamp(),
            };
            delete afterData.id;
            const afterDocRef = doc(collection(db, "reservations"));
            transaction.set(afterDocRef, afterData);
            newReservationsForState.push({ id: afterDocRef.id, ...afterData });
          }

          if (!updatesToOriginalForState.endDate) {
            transaction.delete(originalDocRef);
            updatesToOriginalForState.deleted = true;
          }
        });

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
          const finalEvents = processReservationsToEvents(newState);
          setProcessedEvents(finalEvents);
          return newState;
        });
      } else {
        const payload = {
          nom: formData.nom,
          prenom: formData.prenom || "",
          startDate: formData.startDate,
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
          payload.serialNumber = formData.serialNumber;
          await updateDoc(doc(db, "reservations", currentResId), payload);
          updatedReservations = allReservations.map((res) =>
            res.id === currentResId
              ? { ...res, ...payload, modifiedAt: new Date() }
              : res
          );
        } else {
          payload.serialNumber = await getNextSerialNumber();
          payload.createdAt = serverTimestamp();
          payload.status = "active";
          const docRef = await addDoc(collection(db, "reservations"), payload);
          payload.id = docRef.id;
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
        const finalEvents = processReservationsToEvents(updatedReservations);
        setProcessedEvents(finalEvents);
      }

      resetForm();

      // Naviguer après la sauvegarde et la réinitialisation du formulaire
      if (calendarRef.current && dateToNavigateAfterSave) {
        // Utiliser un setTimeout pour s'assurer que la modale est fermée et que le calendrier est prêt
        localStorage.setItem(
          "beachPlanLastViewedDate",
          dateToNavigateAfterSave
        );
        setTimeout(() => {
          try {
            const calendarApi = calendarRef.current.getApi();
            if (calendarApi && typeof calendarApi.gotoDate === "function") {
              calendarApi.gotoDate(dateToNavigateAfterSave);
              console.log(
                "handleSave - Navigated to:",
                dateToNavigateAfterSave
              );
            } else {
              console.warn(
                "gotoDate not available on calendarApi in handleSave"
              );
            }
          } catch (e) {
            console.error("Erreur gotoDate dans handleSave:", e);
          }
        }, 50); // Un délai pour s'assurer que la modale est bien fermée
      }
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
        const updatedReservations = allReservations.filter(
          (res) => res.id !== selectedOriginal.id
        );
        setAllReservations(updatedReservations);
        const finalEvents = processReservationsToEvents(updatedReservations);
        setProcessedEvents(finalEvents);
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
  return (
    <Box sx={{ height: "90vh", overflow: "auto", border: "1px solid #ccc" }}>
      <Box
        sx={{
          "& .fc-scrollgrid-section-sticky": {
            position: "sticky",
            top: 0,
            zIndex: 1090,
            backgroundColor: theme.palette.background.paper,
          },
          "& .fc-scrollgrid-section-sticky > th": {
            backgroundColor: theme.palette.background.paper,
            overflow: "visible !important",
          },
          "& .fc-scrollgrid-section-body .fc-scroller, & .fc-scrollgrid-section-body .fc-scroller-harness":
            {
              overflow: "auto hidden !important",
            },
          "& .fc-col-header-cell.fc-resource": {
            position: "sticky",
            left: 0,
            zIndex: 1091,
            backgroundColor: theme.palette.background.paper,
          },
          "& .fc-datagrid-cell.fc-resource": {
            position: "sticky",
            left: 0,
            zIndex: 1089,
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
          },
          "& .fc-event": {
            cursor: "pointer",
            position: "relative",
          },
          "& .fc-event::after": {
            content: '"Clicka"',
            position: "absolute",
            bottom: "105%",
            left: "5%",
            transform: "translateX(-50%)",
            backgroundColor: "darkviolet",
            color: "white",
            padding: "3px 6px",
            borderRadius: "3px",
            fontSize: "0.7em",
            whiteSpace: "nowrap",
            zIndex: 2000,
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
            transition: "opacity 0.2s ease, visibility 0.2s ease",
          },
          "& .fc-event:hover::after": {
            opacity: 1,
            visibility: "visible",
          },
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, resourceTimelinePlugin, interactionPlugin]}
          headerToolbar={false}
          initialView="resourceTimeline"
          initialDate="2025-04-01" // Date de démarrage fixe
          visibleRange={{ start: "2025-04-01", end: "2025-12-02" }}
          resources={resources}
          events={processedEvents}
          selectable={true}
          select={handleDateSelect}
          selectLongPressDelay={200}
          eventClick={handleEventClick}
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
          resourceAreaWidth="100px"
        />
      </Box>

      <Dialog open={open} onClose={resetForm} fullWidth maxWidth="xs">
        <DialogTitle>
          {selectedOriginal
            ? `Modifica Prenotazione (${selectedResBase})`
            : `Nuova Prenotazione (${selectedResBase} - ${formatDateForDisplay(
                formData.startDate
              )})`}
        </DialogTitle>
        <DialogContent>
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
          <TextField
            margin="dense"
            label="Data Inizio"
            type="date"
            value={formData.startDate}
            onChange={(e) => {
              const newStartDate = e.target.value;
              setFormData((prev) => ({
                ...prev,
                startDate: newStartDate,
                endDate:
                  prev.endDate < newStartDate ? newStartDate : prev.endDate,
              }));
            }}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
          <TextField
            margin="dense"
            label="Data Fine"
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: formData.startDate }}
            required
            fullWidth
            disabled={!isCurrentUserAdmin}
          />
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
            disabled={isSaving || !isCurrentUserAdmin}
          >
            <MenuItem value="jour entier">Giorno Intero</MenuItem>
            <MenuItem value="matin">Mattina</MenuItem>
            <MenuItem value="apres-midi">Pomeriggio</MenuItem>
          </TextField>

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
          {selectedOriginal && isCurrentUserAdmin && (
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
              !isCurrentUserAdmin
            }
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
