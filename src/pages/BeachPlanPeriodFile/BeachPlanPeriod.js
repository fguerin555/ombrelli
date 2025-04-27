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
import "../../Global.css";
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
      resources.push({
        id: cellCode,
        title: cellCode,
      });
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
  return start1 <= end2 && end1 >= start2;
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
  // ... (états existants) ...
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

  // ... (processReservationsToEvents) ...
  const processReservationsToEvents = useCallback((reservations) => {
    const events = [];
    reservations.forEach((item) => {
      const commonProps = {
        extendedProps: { originalId: item.id, originalData: item },
        start: item.startDate,
        end: item.endDate ? addDays(item.endDate, 1) : "",
        title: item.prenom
          ? `${item.nom} ${item.prenom}`
          : item.nom || "Sans nom",
        color: getColorForCondition(item.condition),
      };

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

  // ... (useEffect pour loadReservations) ...
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

  // ... (useEffect pour mesurer searchBarHeight) ...
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

  // ... (useEffect optionnel pour mesurer calendarHeaderHeight) ...
  useEffect(() => {
    const headerElement = document.querySelector(".fc-header-toolbar");
    if (headerElement) {
      const measureHeader = () => {
        const height = headerElement.offsetHeight;
        if (height > 0) {
          setCalendarHeaderHeight(height);
        }
      };
      measureHeader();
      const resizeObserver = new ResizeObserver(measureHeader);
      resizeObserver.observe(headerElement);
      return () => resizeObserver.disconnect();
    }
  }, [searchBarHeight]);

  // ... (handleDateSelect, handleEventClick, handleSaveReservation, deleteReservation) ...
  const handleDateSelect = (info) => {
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
      console.error("ID Original non trouvé:", info.event);
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
      console.error("Original non trouvé pour ID:", originalId);
    }
  };

  const handleSaveReservation = async () => {
    // Validation
    if (
      !formData.nom ||
      !formData.prenom ||
      !selectedDate ||
      !formData.endDate ||
      !formData.condition
    ) {
      alert("Cognome, Nome, Data Inizio, Data Fine, Condizione obbligatori.");
      return;
    }
    if (formData.endDate < selectedDate) {
      alert("Data Fine non può precedere Data Inizio.");
      return;
    }

    const cellCodeToSave = selectedResourceBase;
    const reservationDetails = {
      nom: formData.nom,
      prenom: formData.prenom,
      startDate: selectedDate,
      endDate: formData.endDate,
      condition: formData.condition,
      cellCode: cellCodeToSave,
      modifiedAt: new Date(),
    };

    // Conflit
    const hasConflict = allReservations.some((existingRes) => {
      if (
        selectedOriginalReservation &&
        existingRes.id === selectedOriginalReservation.id
      ) {
        return false;
      }
      if (existingRes.cellCode !== reservationDetails.cellCode) {
        return false;
      }
      if (
        !datesOverlap(
          reservationDetails.startDate,
          reservationDetails.endDate,
          existingRes.startDate,
          existingRes.endDate
        )
      ) {
        return false;
      }
      if (
        reservationDetails.condition === "jour entier" ||
        existingRes.condition === "jour entier"
      ) {
        return true;
      }
      if (
        reservationDetails.condition === "matin" &&
        existingRes.condition === "matin"
      ) {
        return true;
      }
      if (
        reservationDetails.condition === "apres-midi" &&
        existingRes.condition === "apres-midi"
      ) {
        return true;
      }
      return false;
    });

    if (hasConflict) {
      alert(
        "Conflitto: ombrellone già prenotato (totalmente/parzialmente) in questo periodo/condizione."
      );
      return;
    }

    // Sauvegarde
    try {
      let updatedOriginalReservations;
      let reservationToUpdateOrAdd = { ...reservationDetails };

      if (selectedOriginalReservation) {
        // Mise à jour
        const docRef = doc(db, "reservations", selectedOriginalReservation.id);
        if (selectedOriginalReservation.serialNumber) {
          reservationToUpdateOrAdd.serialNumber =
            selectedOriginalReservation.serialNumber;
        }
        if (selectedOriginalReservation.createdAt) {
          reservationToUpdateOrAdd.createdAt =
            selectedOriginalReservation.createdAt;
        }
        await updateDoc(docRef, reservationToUpdateOrAdd);
        reservationToUpdateOrAdd.id = selectedOriginalReservation.id;
        updatedOriginalReservations = allReservations.map((res) =>
          res.id === selectedOriginalReservation.id
            ? { ...res, ...reservationToUpdateOrAdd }
            : res
        );
      } else {
        // Ajout
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

      // MàJ états
      setAllReservations(updatedOriginalReservations);
      const newProcessedEvents = processReservationsToEvents(
        updatedOriginalReservations
      );
      setProcessedEvents(newProcessedEvents);
      handleSearch(newProcessedEvents); // Réappliquer filtre

      // Reset modal
      setOpen(false);
      setSelectedOriginalReservation(null);
      setFormData({
        nom: "",
        prenom: "",
        endDate: "",
        condition: "jour entier",
      });
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert(`Errore salvataggio: ${error.message}`);
    }
  };

  const deleteReservation = async (idToDelete) => {
    if (!idToDelete) return;
    if (window.confirm("Cancellare questa prenotazione?")) {
      try {
        await deleteDoc(doc(db, "reservations", idToDelete));
        const updatedOriginalReservations = allReservations.filter(
          (e) => e.id !== idToDelete
        );
        setAllReservations(updatedOriginalReservations);
        const newProcessedEvents = processReservationsToEvents(
          updatedOriginalReservations
        );
        setProcessedEvents(newProcessedEvents);
        handleSearch(newProcessedEvents); // Réappliquer filtre
        setOpen(false);
        setSelectedOriginalReservation(null);
      } catch (error) {
        console.error("Errore cancellazione:", error);
        alert(`Errore cancellazione: ${error.message}`);
      }
    }
  };

  // --- handleSearch (CORRIGÉ) ---
  const handleSearch = useCallback(
    (eventsToFilter = processedEvents) => {
      // let dateFilterApplied = false; // <-- SUPPRIMÉ

      if (!queryStartDate || !queryEndDate) {
        // Dates invalides ou manquantes: afficher tout, pas de navigation
        setFilteredEvents(eventsToFilter);
      } else if (queryEndDate < queryStartDate) {
        // Dates inversées: afficher tout, pas de navigation
        alert("Data fine ricerca non può precedere data inizio.");
        setFilteredEvents(eventsToFilter);
      } else {
        // Dates valides: filtrer et naviguer
        // dateFilterApplied = true; // <-- SUPPRIMÉ

        // Filtrer les réservations originales
        const relevantOriginalIds = new Set(
          allReservations
            .filter((res) =>
              datesOverlap(
                res.startDate,
                res.endDate,
                queryStartDate,
                queryEndDate
              )
            )
            .map((res) => res.id)
        );
        // Filtrer les événements traités
        const filtered = eventsToFilter.filter((event) =>
          relevantOriginalIds.has(event.extendedProps?.originalId)
        );
        setFilteredEvents(filtered);

        // Naviguer le calendrier
        if (calendarRef.current) {
          try {
            calendarRef.current.getApi().gotoDate(queryStartDate);
          } catch (error) {
            console.error("Erreur lors de la navigation du calendrier:", error);
          }
        }
      }
    },
    [processedEvents, queryStartDate, queryEndDate, allReservations]
  );

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
        }}
      >
        <Typography variant="h6" sx={{ whiteSpace: "nowrap", mr: 1 }}>
          Ricerca periodo:
        </Typography>
        <TextField
          label="Data inizio"
          type="date"
          value={queryStartDate}
          onChange={(e) => setQueryStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          label="Data fine"
          type="date"
          value={queryEndDate}
          onChange={(e) => setQueryEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          inputProps={{ min: queryStartDate }}
        />
        <Button variant="contained" onClick={() => handleSearch()}>
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
                console.error(
                  "Erreur lors de la réinitialisation de la date du calendrier:",
                  error
                );
              }
            }
          }}
        >
          Cancella filtro
        </Button>
      </Box>

      {/* Wrapper Calendrier */}
      <Box
        sx={{
          "& .fc-header-toolbar": {
            position: "sticky",
            top: searchBarHeight > 0 ? `${searchBarHeight}px` : "0px",
            zIndex: 1090,
            backgroundColor: theme.palette.background.paper,
            boxShadow: theme.shadows[1],
            paddingY: theme.spacing(0.5),
            marginLeft: "-20px",
            marginRight: "-20px",
            paddingLeft: "20px",
            paddingRight: "20px",
          },
          "& .fc-view-harness": {
            paddingTop: `${calendarHeaderHeight}px`,
          },
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
          resourceLabelContent={(arg) => {
            return arg.resource.title;
          }}
          height="auto"
          resourceLaneClassNames={(arg) => {
            if (arg.resource.id.endsWith("_M")) return "fc-lane-morning";
            if (arg.resource.id.endsWith("_P")) return "fc-lane-afternoon";
            return null;
          }}
          selectAllow={(selectInfo) => {
            return (
              selectInfo.resource.id.includes("_M") ||
              selectInfo.resource.id.includes("_P")
            );
          }}
          validRange={{
            start: "2025-04-01",
            end: "2025-12-02",
          }}
          initialDate={INITIAL_CALENDAR_DATE}
        />
      </Box>

      {/* Modal */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>
          {selectedOriginalReservation
            ? `Modifica prenotazione (${selectedResourceBase})`
            : `Nuova Prenotazione (${selectedResourceBase} - ${
                formData.condition === "matin" ? "Mattina" : "Pomeriggio"
              })`}
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
            required
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
              setOpen(false);
              setSelectedOriginalReservation(null);
              setFormData({
                nom: "",
                prenom: "",
                endDate: "",
                condition: "jour entier",
              });
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
