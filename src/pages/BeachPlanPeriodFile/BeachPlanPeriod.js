// src/pages/BeachPlanPeriodFile/BeachPlanPeriod.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import itLocale from "@fullcalendar/core/locales/it";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  MenuItem,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
// Import du composant pour les boutons de navigation personnalisés
import ScrollButtons from "../../components/ScrollButtons"; // Assurez-vous que le chemin est correct

// --- Fonctions Utilitaires ---
const capitalizeFirstLetter = (string) => {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};
const generateResources = () => {
  const letters = ["A", "B", "C", "D"];
  const resources = [];
  letters.forEach((letter) => {
    for (let i = 1; i <= 36; i++) {
      const num = i.toString().padStart(2, "0");
      const cellCode = letter + num;
      resources.push({ id: cellCode, title: cellCode });
      resources.push({
        id: `${cellCode}_M`,
        parentId: cellCode,
        title: "Mattina",
      });
      resources.push({
        id: `${cellCode}_P`,
        parentId: cellCode,
        title: "Pomer.",
      });
    }
  });
  return resources;
};
const getColorForCondition = (condition) => {
  switch (condition) {
    case "jour entier":
      return "red";
    case "matin":
      return "blue";
    case "apres-midi":
      return "orange";
    default:
      return "grey";
  }
};
const datesOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;
  try {
    const s1 = new Date(
      Date.UTC(
        parseInt(start1.substring(0, 4)),
        parseInt(start1.substring(5, 7)) - 1,
        parseInt(start1.substring(8, 10))
      )
    );
    const e1 = new Date(
      Date.UTC(
        parseInt(end1.substring(0, 4)),
        parseInt(end1.substring(5, 7)) - 1,
        parseInt(end1.substring(8, 10))
      )
    );
    const s2 = new Date(
      Date.UTC(
        parseInt(start2.substring(0, 4)),
        parseInt(start2.substring(5, 7)) - 1,
        parseInt(start2.substring(8, 10))
      )
    );
    const e2 = new Date(
      Date.UTC(
        parseInt(end2.substring(0, 4)),
        parseInt(end2.substring(5, 7)) - 1,
        parseInt(end2.substring(8, 10))
      )
    );
    return s1 <= e2 && e1 >= s2;
  } catch (e) {
    console.error("Erreur dans datesOverlap:", e, {
      start1,
      end1,
      start2,
      end2,
    });
    return false;
  }
};
const addDays = (dateStr, days) => {
  if (!dateStr) return null;
  try {
    const date = new Date(
      Date.UTC(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(5, 7)) - 1,
        parseInt(dateStr.substring(8, 10))
      )
    );
    date.setUTCDate(date.getUTCDate() + days);
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error(
      "Errore in addDays:",
      e,
      "Input:",
      dateStr,
      "Number of days:",
      days
    );
    return null;
  }
};
// --- Fin Fonctions Utilitaires ---

// --- Constantes ---
const INITIAL_CALENDAR_DATE = "2025-04-01";

function BeachPlanPeriod() {
  // --- États ---
  const [allReservations, setAllReservations] = useState([]);
  const [processedEvents, setProcessedEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedResourceBase, setSelectedResourceBase] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    endDate: "",
    condition: "jour entier",
  });
  const [open, setOpen] = useState(false);
  const [selectedOriginalReservation, setSelectedOriginalReservation] =
    useState(null);
  const [queryStartDate, setQueryStartDate] = useState("");
  const [queryEndDate, setQueryEndDate] = useState("");

  const theme = useTheme();
  const isMobileOrTablet = useMediaQuery(theme.breakpoints.down("md"));

  const searchBarRef = useRef(null);
  const [searchBarHeight, setSearchBarHeight] = useState(0);
  const calendarRef = useRef(null); // Ref pour l'API FullCalendar

  // États pour désactiver les boutons de navigation personnalisés
  const [isCustomPrevDisabled, setIsCustomPrevDisabled] = useState(true);
  const [isCustomNextDisabled, setIsCustomNextDisabled] = useState(false);

  // --- Fonctions ---
  const resetFormAndState = () => {
    setOpen(false);
    setSelectedOriginalReservation(null);
    setFormData({ nom: "", prenom: "", endDate: "", condition: "jour entier" });
    setSelectedDate("");
    setSelectedResourceBase("");
  };

  const processReservationsToEvents = useCallback((reservations) => {
    const events = [];
    reservations.forEach((item) => {
      if (!item.startDate || !item.cellCode) {
        console.warn(
          "Réservation ignorée (manque startDate ou cellCode):",
          item
        );
        return;
      }
      let endDateValid = item.endDate;
      if (!endDateValid || new Date(endDateValid) < new Date(item.startDate)) {
        endDateValid = item.startDate; // Fallback si endDate invalide
      }
      const endForCalendar = addDays(endDateValid, 1);
      if (!endForCalendar) {
        console.warn(
          "Impossible de calculer la date de fin pour l'événement:",
          item
        );
        return;
      }

      const commonProps = {
        extendedProps: { originalId: item.id, originalData: item },
        start: item.startDate,
        end: endForCalendar,
        title: item.prenom
          ? `${item.nom} ${item.prenom}`
          : item.nom || "Sans nom",
        color: getColorForCondition(item.condition),
      };

      if (new Date(commonProps.end) <= new Date(commonProps.start)) {
        console.warn(
          "Date de fin invalide même après ajout du jour, événement ignoré:",
          commonProps
        );
        return;
      }

      if (item.condition === "jour entier") {
        events.push({
          ...commonProps,
          id: `${item.id}_M`,
          resourceId: `${item.cellCode}_M`,
        });
        events.push({
          ...commonProps,
          id: `${item.id}_P`,
          resourceId: `${item.cellCode}_P`,
        });
      } else if (item.condition === "matin") {
        events.push({
          ...commonProps,
          id: `${item.id}_M`,
          resourceId: `${item.cellCode}_M`,
        });
      } else if (item.condition === "apres-midi") {
        events.push({
          ...commonProps,
          id: `${item.id}_P`,
          resourceId: `${item.cellCode}_P`,
        });
      }
    });
    return events;
  }, []);

  const handleDateSelect = (info) => {
    if (
      !info.resource ||
      (!info.resource.id.endsWith("_M") && !info.resource.id.endsWith("_P"))
    ) {
      console.log(
        "Sélection ignorée (pas sur une ligne M ou P):",
        info.resource?.id
      );
      return;
    }
    const resourceId = info.resource.id;
    const baseCode = resourceId.split("_")[0];
    const conditionValue = resourceId.endsWith("_M") ? "matin" : "apres-midi";
    setSelectedResourceBase(baseCode);
    setSelectedDate(info.startStr);
    setOpen(true);
    setFormData({
      nom: "",
      prenom: "",
      endDate: info.startStr,
      condition: conditionValue,
    });
    setSelectedOriginalReservation(null);
  };

  const handleEventClick = (info) => {
    const originalId = info.event.extendedProps?.originalId;
    if (!originalId) {
      console.warn("Clic sur un événement sans originalId:", info.event);
      alert(
        "Impossible de trouver les détails originaux de cette réservation."
      );
      return;
    }
    const originalRes = allReservations.find((r) => r.id === originalId);
    if (originalRes) {
      setSelectedOriginalReservation(originalRes);
      setFormData({
        nom: originalRes.nom || "",
        prenom: originalRes.prenom || "",
        endDate: originalRes.endDate || "",
        condition: originalRes.condition || "jour entier",
      });
      setSelectedResourceBase(originalRes.cellCode);
      setSelectedDate(originalRes.startDate || "");
      setOpen(true);
    } else {
      console.error(
        "Données de réservation originales non trouvées pour ID:",
        originalId
      );
      alert("Dettagli della prenotazione non trovati.");
    }
  };

  const handleSaveReservation = async () => {
    if (
      !formData.nom ||
      !selectedDate ||
      !formData.endDate ||
      !formData.condition ||
      !selectedResourceBase
    ) {
      alert(
        "Cognome, Data Inizio, Data Fine, Condizione e Ombrellone sono obbligatori."
      );
      return;
    }
    if (new Date(formData.endDate) < new Date(selectedDate)) {
      alert("Data Fine non può precedere Data Inizio.");
      return;
    }
    const cellCodeToSave = selectedResourceBase;
    const reservationDetails = {
      nom: formData.nom.trim(),
      prenom: formData.prenom.trim(),
      startDate: selectedDate,
      endDate: formData.endDate,
      condition: formData.condition,
      cellCode: cellCodeToSave,
    };

    const hasConflict = allReservations.some((existingRes) => {
      if (
        selectedOriginalReservation &&
        existingRes.id === selectedOriginalReservation.id
      )
        return false;
      if (existingRes.cellCode !== reservationDetails.cellCode) return false;
      if (
        !datesOverlap(
          reservationDetails.startDate,
          reservationDetails.endDate,
          existingRes.startDate,
          existingRes.endDate
        )
      )
        return false;
      const newIsFull = reservationDetails.condition === "jour entier";
      const newIsMorning = reservationDetails.condition === "matin";
      const newIsAfternoon = reservationDetails.condition === "apres-midi";
      const existingIsFull = existingRes.condition === "jour entier";
      const existingIsMorning = existingRes.condition === "matin";
      const existingIsAfternoon = existingRes.condition === "apres-midi";
      if (newIsFull || existingIsFull) return true;
      if (newIsMorning && existingIsMorning) return true;
      if (newIsAfternoon && existingIsAfternoon) return true;
      return false;
    });

    if (hasConflict) {
      alert(
        `Conflitto: L'ombrellone ${cellCodeToSave} è già prenotato (totalmente o parzialmente) per il periodo ${selectedDate} - ${formData.endDate} con una condizione incompatibile.`
      );
      return;
    }

    try {
      let updatedOriginalReservations;
      let reservationToUpdateOrAdd = {
        ...reservationDetails,
        modifiedAt: new Date(),
      };
      if (selectedOriginalReservation) {
        const docRef = doc(db, "reservations", selectedOriginalReservation.id);
        if (selectedOriginalReservation.serialNumber)
          reservationToUpdateOrAdd.serialNumber =
            selectedOriginalReservation.serialNumber;
        reservationToUpdateOrAdd.createdAt =
          selectedOriginalReservation.createdAt || new Date();
        await updateDoc(docRef, reservationToUpdateOrAdd);
        reservationToUpdateOrAdd.id = selectedOriginalReservation.id;
        updatedOriginalReservations = allReservations.map((res) =>
          res.id === selectedOriginalReservation.id
            ? { ...res, ...reservationToUpdateOrAdd }
            : res
        );
        console.log("Prenotazione modificata:", reservationToUpdateOrAdd.id);
      } else {
        reservationToUpdateOrAdd.createdAt = new Date();
        const docRef = await addDoc(
          collection(db, "reservations"),
          reservationToUpdateOrAdd
        );
        reservationToUpdateOrAdd.id = docRef.id;
        updatedOriginalReservations = [
          ...allReservations,
          reservationToUpdateOrAdd,
        ];
        console.log("Prenotazione aggiunta:", reservationToUpdateOrAdd.id);
      }
      setAllReservations(updatedOriginalReservations);
      const newProcessedEvents = processReservationsToEvents(
        updatedOriginalReservations
      );
      setProcessedEvents(newProcessedEvents);
      handleSearch(newProcessedEvents);
      resetFormAndState();
    } catch (error) {
      console.error("Errore durante il salvataggio della prenotazione:", error);
      alert(`Errore salvataggio: ${error.message}`);
    }
  };

  const deleteReservation = async (idToDelete) => {
    if (!idToDelete) return;
    if (window.confirm("Sei sicuro di voler cancellare questa prenotazione?")) {
      try {
        await deleteDoc(doc(db, "reservations", idToDelete));
        const updatedOriginals = allReservations.filter(
          (e) => e.id !== idToDelete
        );
        setAllReservations(updatedOriginals);
        const newEvents = processReservationsToEvents(updatedOriginals);
        setProcessedEvents(newEvents);
        handleSearch(newEvents);
        if (
          selectedOriginalReservation &&
          selectedOriginalReservation.id === idToDelete
        ) {
          resetFormAndState();
        }
        console.log("Prenotazione cancellata:", idToDelete);
      } catch (error) {
        console.error("Errore durante la cancellazione:", error);
        alert(`Errore cancellazione: ${error.message}`);
      }
    }
  };

  const handleSearch = useCallback(
    (eventsToFilter = processedEvents) => {
      const start = queryStartDate.trim();
      const end = queryEndDate.trim();
      if (!start || !end) {
        setFilteredEvents(eventsToFilter);
        return;
      }
      if (new Date(end) < new Date(start)) {
        alert("Data fine ricerca non può precedere data inizio.");
        setFilteredEvents(eventsToFilter);
        return;
      }
      const relevantIds = new Set(
        allReservations
          .filter(
            (res) =>
              res.startDate &&
              res.endDate &&
              datesOverlap(res.startDate, res.endDate, start, end)
          )
          .map((res) => res.id)
      );
      const filtered = eventsToFilter.filter((event) =>
        relevantIds.has(event.extendedProps?.originalId)
      );
      setFilteredEvents(filtered);
      if (calendarRef.current) {
        try {
          calendarRef.current.getApi().gotoDate(start);
        } catch (error) {
          console.error(
            "Erreur lors de la navigation du calendrier (gotoDate):",
            error
          );
        }
      }
    },
    [processedEvents, queryStartDate, queryEndDate, allReservations]
  );

  // Fonction appelée par FullCalendar quand la date/vue change
  const handleDatesSet = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const view = calendarApi.view;
      const validRange = calendarApi.getOption("validRange");

      if (validRange && validRange.start && validRange.end) {
        try {
          const rangeStart = new Date(validRange.start);
          const rangeEnd = new Date(validRange.end);
          rangeStart.setUTCHours(0, 0, 0, 0);
          rangeEnd.setUTCHours(0, 0, 0, 0);

          const viewStart = new Date(view.activeStart);
          viewStart.setUTCHours(0, 0, 0, 0);

          setIsCustomPrevDisabled(viewStart.getTime() <= rangeStart.getTime());

          const dayBeforeViewEnd = new Date(view.activeEnd);
          dayBeforeViewEnd.setUTCDate(dayBeforeViewEnd.getUTCDate() - 1);
          dayBeforeViewEnd.setUTCHours(0, 0, 0, 0);

          setIsCustomNextDisabled(
            dayBeforeViewEnd.getTime() >= rangeEnd.getTime()
          );
        } catch (e) {
          console.error(
            "Erreur lors de la conversion des dates de validRange:",
            e,
            validRange
          );
          setIsCustomPrevDisabled(false);
          setIsCustomNextDisabled(false);
        }
      } else {
        setIsCustomPrevDisabled(false);
        setIsCustomNextDisabled(false);
      }
    }
  }, []);

  // --- useEffect hooks ---
  // Chargement initial des réservations
  useEffect(() => {
    const loadReservations = async () => {
      try {
        const snapshot = await getDocs(collection(db, "reservations"));
        const loadedOriginals = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate || "",
          endDate: doc.data().endDate || "",
          prenom: doc.data().prenom || "",
          nom: doc.data().nom || "",
          condition: doc.data().condition || "jour entier",
          cellCode: doc.data().cellCode || "",
        }));
        setAllReservations(loadedOriginals);
        const initialEvents = processReservationsToEvents(loadedOriginals);
        setProcessedEvents(initialEvents);
        setFilteredEvents(initialEvents);
        // Appeler handleDatesSet une fois après le chargement initial pour définir l'état initial des boutons
        handleDatesSet();
      } catch (error) {
        console.error("Errore caricamento prenotazioni:", error);
        alert("Errore caricamento prenotazioni.");
      }
    };
    loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processReservationsToEvents]); // handleDatesSet n'est pas nécessaire ici car stable

  // Calcul hauteur barre de recherche
  useEffect(() => {
    if (searchBarRef.current && !isMobileOrTablet) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setSearchBarHeight(entry.target.offsetHeight);
        }
      });
      resizeObserver.observe(searchBarRef.current);
      return () => resizeObserver.disconnect();
    } else {
      setSearchBarHeight(0);
    }
  }, [isMobileOrTablet]);

  // --- Render ---
  return (
    <div style={{ padding: "20px" }}>
      {/* Barre de recherche (Desktop) */}
      {!isMobileOrTablet && (
        <Box
          ref={searchBarRef}
          display="flex"
          alignItems="center"
          gap={2}
          flexWrap="wrap"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1100,
            backgroundColor: theme.palette.background.paper,
            paddingY: 1.5,
            paddingX: 2,
            boxShadow: theme.shadows[3],
            marginLeft: "-20px",
            marginRight: "-20px",
            gap: { xs: 1, sm: 2 },
          }}
        >
          <Typography
            variant="h6"
            sx={{
              whiteSpace: "nowrap",
              mr: { xs: 0, sm: 1 },
              fontSize: { xs: "0.9rem", sm: "1.25rem" },
            }}
          >
            Ricerca periodo:
          </Typography>
          <TextField
            label="Data inizio"
            type="date"
            value={queryStartDate}
            onChange={(e) => setQueryStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{
              "& .MuiInputLabel-root": {
                fontSize: { xs: "0.8rem", sm: "inherit" },
              },
              "& .MuiInputBase-input": {
                fontSize: { xs: "0.85rem", sm: "inherit" },
                padding: { xs: "8px 10px", sm: "8.5px 14px" },
              },
              flexGrow: { xs: 1, sm: 0 },
              minWidth: { xs: "130px", sm: "auto" },
            }}
          />
          <TextField
            label="Data fine"
            type="date"
            value={queryEndDate}
            onChange={(e) => setQueryEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            inputProps={{ min: queryStartDate }}
            sx={{
              "& .MuiInputLabel-root": {
                fontSize: { xs: "0.8rem", sm: "inherit" },
              },
              "& .MuiInputBase-input": {
                fontSize: { xs: "0.85rem", sm: "inherit" },
                padding: { xs: "8px 10px", sm: "8.5px 14px" },
              },
              flexGrow: { xs: 1, sm: 0 },
              minWidth: { xs: "130px", sm: "auto" },
            }}
          />
          <Button
            variant="contained"
            onClick={() => handleSearch()}
            size="small"
            sx={{
              fontSize: { xs: "0.75rem", sm: "0.8125rem" },
              padding: { xs: "4px 8px", sm: "4px 10px" },
              flexGrow: { xs: 1, sm: 0 },
              color: "blue",
              backgroundColor: "#eab8f0a8",
              "&:hover": { backgroundColor: "#3518c4a3", color: "white" },
            }}
          >
            Cerca
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setQueryStartDate("");
              setQueryEndDate("");
              setFilteredEvents(processedEvents);
              if (calendarRef.current) {
                try {
                  calendarRef.current.getApi().gotoDate(INITIAL_CALENDAR_DATE);
                } catch (error) {
                  console.error("Errore reset data:", error);
                }
              }
            }}
            size="small"
            sx={{
              fontSize: { xs: "0.75rem", sm: "0.8125rem" },
              padding: { xs: "4px 8px", sm: "4px 10px" },
              flexGrow: { xs: 1, sm: 0 },
              color: "blue",
              backgroundColor: "#eab8f0a8",
              "&:hover": { backgroundColor: "#3518c4a3", color: "white" },
            }}
          >
            Cancella filtro
          </Button>
        </Box>
      )}

      {/* Boutons de navigation personnalisés (Mobile) */}
      {isMobileOrTablet && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "20px",
            marginBottom: "10px",
            width: "100%",
          }}
        >
          <ScrollButtons
            onPrevClick={() => calendarRef.current?.getApi().prev()}
            onNextClick={() => calendarRef.current?.getApi().next()}
            isPrevDisabled={isCustomPrevDisabled}
            isNextDisabled={isCustomNextDisabled}
          />
        </Box>
      )}

      {/* Calendar Wrapper */}
      <Box
        sx={{
          overflowX: "auto", // Garder pour le scroll manuel du contenu
          overflowY: "hidden",
          // Styles Toolbar
          "& .fc-header-toolbar": {
            position: "sticky",
            top: searchBarHeight > 0 ? `${searchBarHeight}px` : "0px",
            zIndex: 1090,
            backgroundColor: theme.palette.background.paper,
            boxShadow: theme.shadows[1],
            paddingY: theme.spacing(1),
            marginLeft: "-20px",
            marginRight: "-20px",
            paddingLeft: "20px",
            paddingRight: "20px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: theme.spacing(1),
          },
          "& .fc-toolbar-chunk": {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing(0.5),
            [theme.breakpoints.down("sm")]: {
              flexBasis: "calc(50% - 4px)",
              justifyContent: "center",
              "&:nth-of-type(2)": {
                flexBasis: "100%",
                order: -1,
                marginTop: theme.spacing(0.5),
                marginBottom: theme.spacing(0.5),
              },
            },
            "&:nth-of-type(2)": { flexGrow: 1, justifyContent: "center" },
          },
          "& .fc .fc-button": {
            backgroundColor: "#eab8f0a8",
            border: "none",
            borderRadius: "7px",
            boxShadow: "3px 3px 10px rgba(0, 0, 0, 0.3)",
            textShadow: "2px 2px 4px #15459e",
            padding: { xs: "3px 5px", sm: "10px 20px" },
            fontSize: { xs: "14px", sm: "18px" },
            textTransform: "none",
            margin: "0 2px",
            cursor: "pointer",
            transition: "background-color 0.2s ease, opacity 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.85,
          },
          "& .fc .fc-button:not(.fc-button-primary):hover": {
            backgroundColor: "#3518c4a3",
            opacity: 1,
          },
          "& .fc .fc-button-primary": {
            backgroundColor: "#eab8f0a8 !important",
            opacity: "1 !important",
            color: "blue !important",
          },
          "& .fc .fc-button-primary:hover": {
            backgroundColor: "#3518c4a3 !important",
            color: "white !important",
          },
          "& .fc .fc-toolbar-title": {
            fontSize: "1.4em",
            fontWeight: "bold",
            textAlign: "center",
            margin: 0,
            [theme.breakpoints.down("sm")]: { fontSize: "1.0em" },
          },
          "& .fc-view-harness .fc-timeline": { minWidth: "800px" }, // Force largeur min sur mobile
        }}
      >
        {/* Composant FullCalendar */}
        <FullCalendar
          ref={calendarRef} // Ref pour l'API
          plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
          initialView="resourceTimelineWeek"
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
          locale={itLocale}
          // Configuration de la barre d'outils standard
          headerToolbar={
            isMobileOrTablet
              ? false // Masque complètement sur mobile/tablette
              : {
                  // Configuration pour Desktop
                  left: "prev,next today",
                  center: "title",
                  right: "resourceTimelineWeek,resourceTimelineMonth",
                }
          }
          // Callback appelé après chaque changement de date/vue
          datesSet={handleDatesSet}
          buttonText={{
            today: "Oggi",
            month: "Mese",
            week: "Settimana",
            resourceTimelineWeek: "Settimana",
            resourceTimelineMonth: "Mese",
          }}
          resources={generateResources()}
          events={filteredEvents}
          selectable={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          slotDuration={{ days: 1 }}
          slotLabelFormat={{
            weekday: "short",
            day: "numeric",
            month: "numeric",
            omitCommas: true,
          }}
          resourceAreaHeaderContent="Ombrelli"
          resourceAreaWidth="60px"
          // Fonction pour afficher le label de ressource
          resourceLabelContent={(arg) => (
            <Typography sx={{ fontSize: "0.7rem", textAlign: "center" }}>
              {arg.resource.title}
            </Typography>
          )}
          height="auto"
          // Fonction pour ajouter des classes CSS aux lignes
          resourceLaneClassNames={(arg) => {
            if (arg.resource.id.endsWith("_M")) return "fc-lane-morning";
            if (arg.resource.id.endsWith("_P")) return "fc-lane-afternoon";
            return null;
          }}
          // Fonction pour autoriser la sélection
          selectAllow={(selectInfo) =>
            selectInfo.resource &&
            (selectInfo.resource.id.includes("_M") ||
              selectInfo.resource.id.includes("_P"))
          }
          // Plage de dates valide pour la navigation
          validRange={{ start: "2025-04-01", end: "2025-12-02" }}
          initialDate={INITIAL_CALENDAR_DATE}
          eventMinWidth={30}
        />
      </Box>

      {/* Modal de réservation/modification */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {selectedOriginalReservation
            ? `Modifica prenotazione (${selectedResourceBase})`
            : `Nuova Prenotazione (${selectedResourceBase} - ${selectedDate})`}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Cognome"
            fullWidth
            value={formData.nom}
            onChange={(e) =>
              setFormData({
                ...formData,
                nom: capitalizeFirstLetter(e.target.value),
              })
            }
            required
          />
          <TextField
            margin="dense"
            label="Nome"
            fullWidth
            value={formData.prenom}
            onChange={(e) =>
              setFormData({
                ...formData,
                prenom: capitalizeFirstLetter(e.target.value),
              })
            }
          />
          <TextField
            margin="dense"
            label="Data Inizio"
            type="date"
            fullWidth
            value={selectedDate}
            InputLabelProps={{ shrink: true }}
            disabled
          />
          <TextField
            margin="dense"
            label="Data Fine"
            type="date"
            fullWidth
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: selectedDate }}
            required
          />
          <TextField
            select
            margin="dense"
            label="Condizione"
            fullWidth
            value={formData.condition}
            onChange={(e) =>
              setFormData({ ...formData, condition: e.target.value })
            }
            required
          >
            <MenuItem value="jour entier">Giorno Intero</MenuItem>
            <MenuItem value="matin">Mattina</MenuItem>
            <MenuItem value="apres-midi">Pomeriggio</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          {selectedOriginalReservation && (
            <Button
              onClick={() => deleteReservation(selectedOriginalReservation.id)}
              color="error"
            >
              Cancella
            </Button>
          )}
          <Button
            onClick={() => {
              resetFormAndState();
            }}
          >
            Annulla
          </Button>
          <Button onClick={handleSaveReservation} variant="contained">
            {selectedOriginalReservation ? "Modifica" : "Aggiungi"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default BeachPlanPeriod;
