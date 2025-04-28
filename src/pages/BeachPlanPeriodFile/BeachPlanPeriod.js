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
} from "@mui/material";
// import "../../Global.css"; // Global.css n'affecte pas directement .fc-button
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

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
  const s1 = new Date(start1 + "T00:00:00Z");
  const e1 = new Date(end1 + "T00:00:00Z");
  const s2 = new Date(start2 + "T00:00:00Z");
  const e2 = new Date(end2 + "T00:00:00Z");
  return s1 <= e2 && e1 >= s2;
};

const addDays = (dateStr, days) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split("T")[0];
  } catch (e) {
    console.error("Errore in addDays:", e);
    return null;
  }
};
// --- Fin Fonctions Utilitaires ---

// --- Constantes ---
const INITIAL_CALENDAR_DATE = "2025-04-01";

function BeachPlanPeriod() {
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
  const searchBarRef = useRef(null);
  const [searchBarHeight, setSearchBarHeight] = useState(0);
  const [calendarHeaderHeight, setCalendarHeaderHeight] = useState(60);
  const calendarRef = useRef(null);

  const processReservationsToEvents = useCallback((reservations) => {
    const events = [];
    reservations.forEach((item) => {
      if (!item.startDate || !item.cellCode) return;
      const commonProps = {
        extendedProps: { originalId: item.id, originalData: item },
        start: item.startDate,
        end: item.endDate
          ? addDays(item.endDate, 1)
          : addDays(item.startDate, 1),
        title: item.prenom
          ? `${item.nom} ${item.prenom}`
          : item.nom || "Sans nom",
        color: getColorForCondition(item.condition),
      };
      if (
        !commonProps.end ||
        new Date(commonProps.end) <= new Date(commonProps.start)
      ) {
        commonProps.end = addDays(commonProps.start, 1);
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

  // --- useEffect hooks ---
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
      } catch (error) {
        console.error("Errore caricamento prenotazioni:", error);
        alert("Errore caricamento prenotazioni.");
      }
    };
    loadReservations();
  }, [processReservationsToEvents]);

  useEffect(() => {
    if (searchBarRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setSearchBarHeight(entry.target.offsetHeight);
        }
      });
      resizeObserver.observe(searchBarRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (calendarRef.current) {
        const headerElement =
          calendarRef.current.elRef.current.querySelector(".fc-header-toolbar");
        if (headerElement) {
          const measureHeader = () => {
            const height = headerElement.offsetHeight;
            if (height > 0 && height !== calendarHeaderHeight) {
              setCalendarHeaderHeight(height);
            }
          };
          measureHeader();
          const resizeObserver = new ResizeObserver(measureHeader);
          resizeObserver.observe(headerElement);
          return () => resizeObserver.disconnect();
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [calendarHeaderHeight]);

  // --- Event Handlers ---
  const handleDateSelect = (info) => {
    if (
      !info.resource ||
      (!info.resource.id.endsWith("_M") && !info.resource.id.endsWith("_P"))
    )
      return;
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
    if (!originalId) return;
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
      console.error("Original reservation data not found for ID:", originalId);
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
    if (formData.endDate < selectedDate) {
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
      modifiedAt: new Date(),
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
      if (
        reservationDetails.condition === "jour entier" ||
        existingRes.condition === "jour entier"
      )
        return true;
      if (
        reservationDetails.condition === "matin" &&
        existingRes.condition === "matin"
      )
        return true;
      if (
        reservationDetails.condition === "apres-midi" &&
        existingRes.condition === "apres-midi"
      )
        return true;
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
      let reservationToUpdateOrAdd = { ...reservationDetails };
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
      }
      setAllReservations(updatedOriginalReservations);
      const newProcessedEvents = processReservationsToEvents(
        updatedOriginalReservations
      );
      setProcessedEvents(newProcessedEvents);
      handleSearch(newProcessedEvents);
      setOpen(false);
      setSelectedOriginalReservation(null);
      setFormData({
        nom: "",
        prenom: "",
        endDate: "",
        condition: "jour entier",
      });
      setSelectedDate("");
      setSelectedResourceBase("");
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
        setOpen(false);
        setSelectedOriginalReservation(null);
        setFormData({
          nom: "",
          prenom: "",
          endDate: "",
          condition: "jour entier",
        });
        setSelectedDate("");
        setSelectedResourceBase("");
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
      } else if (end < start) {
        alert("Data fine ricerca non può precedere data inizio.");
        setFilteredEvents(eventsToFilter);
      } else {
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
            console.error("Erreur lors de la navigation du calendrier:", error);
          }
        }
      }
    },
    [processedEvents, queryStartDate, queryEndDate, allReservations]
  );

  // --- Render ---
  return (
    <div style={{ padding: "20px" }}>
      {/* Barre de recherche */}
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
            flexShrink: { xs: 1, sm: 0 },
            display: "flex",
            alignItems: "center",
            minHeight: { xs: "36px", sm: "40px" },
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
            color: { xs: "blue", sm: "blue" },
            backgroundColor: { xs: "#eab8f0a8", sm: "#eab8f0a8" },
            "&:hover": { backgroundColor: "#3518c4a3", color: "white" },
          }}
        >
          {" "}
          Cerca{" "}
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
            color: { xs: "blue", sm: "blue" },
            backgroundColor: { xs: "#eab8f0a8", sm: "#eab8f0a8" },
            "&:hover": { backgroundColor: "#3518c4a3", color: "white" },
          }}
        >
          {" "}
          Cancella filtro{" "}
        </Button>
      </Box>

      {/* Calendar Wrapper - Styles pour l'en-tête FC corrigés */}
      <Box
        sx={{
          // --- Styles Toolbar ---
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

          // --- Styles pour les BOUTONS FullCalendar (Final avec Hover violet pour inactifs) ---
          "& .fc .fc-button": {
            // Style de base pour TOUS les boutons
            backgroundColor: "#eab8f0a8", // Rose initial semi-transparent

            border: "none",
            borderRadius: "7px",
            boxShadow: "3px 3px 10px rgba(0, 0, 0, 0.3)",
            textShadow: "2px 2px 4px #15459e",
            padding: { xs: "3px 5px", sm: "10px 20px" },
            fontSize: { xs: "14px", sm: "18px" },
            textTransform: "none",
            margin: "0 2px",
            cursor: "pointer",
            // Appliquer la transition ici pour qu'elle affecte tous les changements
            transition: "background-color 0.2s ease, opacity 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.85, // Opacité par défaut pour les boutons INACTIFS
          },

          // --- Style pour le SURVOL d'un bouton INACTIF ---
          "& .fc .fc-button:not(.fc-button-primary):hover": {
            backgroundColor: "#3518c4a3", // Couleur hover foncée désirée
            opacity: 1, // Rendre opaque au survol
            // La transition est déjà définie dans le style de base .fc-button
          },

          // --- Style SPÉCIFIQUE et FORCÉ pour le bouton ACTIF ---
          "& .fc .fc-button-primary": {
            backgroundColor: "#eab8f0a8 !important", // Force la couleur rose

            opacity: "1 !important", // Force l'opacité
            color: "blue !important", // Assure que la couleur du texte reste
            "&:hover": {
              backgroundColor: "#3518c4a3",
              color: "white !important",
            },
          },

          // --- Style SPÉCIFIQUE et FORCÉ pour le SURVOL du bouton ACTIF ---
          // (Pour s'assurer qu'il ne change PAS au survol)
          "& .fc .fc-button-primary:hover": {
            backgroundColor: "#3518c4a3 !important", // Force la couleur foncée au survol
            opacity: "1 !important", // Force l'opacité au survol
            // Pas de changement visuel, la transition héritée n'a pas d'effet visible ici
          },
          // --- Fin Styles Boutons ---

          // --- Styles Titre ---
          "& .fc .fc-toolbar-title": {
            fontSize: "1.4em",
            fontWeight: "bold",
            textAlign: "center",
            margin: 0,
            [theme.breakpoints.down("sm")]: { fontSize: "1.0em" },
          },
          // --- Styles Conteneur Vue ---
          "& .fc-view-harness": { paddingTop: `${calendarHeaderHeight}px` },
        }}
      >
        {/* Calendrier */}
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
          initialView="resourceTimelineWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "resourceTimelineWeek,resourceTimelineMonth",
          }}
          buttonText={{
            today: "Oggi",
            month: "Mese",
            week: "Settimana",
            resourceTimelineWeek: "Settimana",
            resourceTimelineMonth: "Mese",
          }}
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
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
          locale={itLocale}
          resourceAreaHeaderContent="Ombrelli"
          resourceAreaWidth="60px"
          resourceLabelContent={(arg) => (
            <Typography sx={{ fontSize: "0.7rem", textAlign: "center" }}>
              {arg.resource.title}
            </Typography>
          )}
          height="auto"
          resourceLaneClassNames={(arg) => {
            if (arg.resource.id.endsWith("_M")) return "fc-lane-morning";
            if (arg.resource.id.endsWith("_P")) return "fc-lane-afternoon";
            return null;
          }}
          selectAllow={(selectInfo) =>
            selectInfo.resource &&
            (selectInfo.resource.id.includes("_M") ||
              selectInfo.resource.id.includes("_P"))
          }
          validRange={{ start: "2025-04-01", end: "2025-12-02" }}
          initialDate={INITIAL_CALENDAR_DATE}
          eventMinWidth={30}
        />
      </Box>

      {/* Modal */}
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
              {" "}
              Cancella{" "}
            </Button>
          )}
          <Button
            onClick={() => {
              setOpen(false);
              setSelectedOriginalReservation(null);
              setFormData({
                nom: "",
                prenom: "",
                endDate: "",
                condition: "jour entier",
              });
              setSelectedDate("");
              setSelectedResourceBase("");
            }}
          >
            {" "}
            Annulla{" "}
          </Button>
          <Button onClick={handleSaveReservation} variant="contained">
            {" "}
            {selectedOriginalReservation ? "Modifica" : "Aggiungi"}{" "}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default BeachPlanPeriod;
