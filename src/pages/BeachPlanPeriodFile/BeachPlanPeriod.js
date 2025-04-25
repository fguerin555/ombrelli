import React, { useState, useEffect, useCallback } from "react";
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

// MODIFIÉ: ID Pomeriggio cambiato in _P per forzare l'ordinamento alfabetico M < P
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
      // Mattina (prima)
      resources.push({
        id: `${cellCode}_M`, // ID Mattina
        parentId: cellCode,
        title: "Mattina",
      });
      // Pomeriggio (dopo, con ID _P)
      resources.push({
        id: `${cellCode}_P`, // ID Pomeriggio cambiato in _P
        parentId: cellCode,
        title: "Pomer.",
      });
    }
  });
  return resources;
};

// Funzione colore (invariata, usa ancora 'apres-midi' come valore)
const getColorForCondition = (condition) => {
  switch (condition) {
    case "jour entier":
      return "red";
    case "matin":
      return "blue";
    case "apres-midi": // Il valore in Firestore/logica interna è ancora 'apres-midi'
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

function BeachPlanPeriod() {
  const [allReservations, setAllReservations] = useState([]);
  const [processedEvents, setProcessedEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedResourceBase, setSelectedResourceBase] = useState("");
  const [selectedConditionValue, setSelectedConditionValue] = useState(""); // 'matin' ou 'apres-midi'
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
          resourceId: `${item.cellCode}_M`, // Mattina
        });
        events.push({
          ...commonProps,
          id: `${item.id}_P`, // Pomeriggio usa _P
          resourceId: `${item.cellCode}_P`, // Pomeriggio usa _P
        });
      } else if (item.condition === "matin") {
        events.push({
          ...commonProps,
          id: `${item.id}_M`,
          resourceId: `${item.cellCode}_M`, // Mattina
        });
      } else if (item.condition === "apres-midi") {
        // Il valore è ancora 'apres-midi'
        events.push({
          ...commonProps,
          id: `${item.id}_P`, // Pomeriggio usa _P
          resourceId: `${item.cellCode}_P`, // Pomeriggio usa _P
        });
      }
    });
    return events;
  }, []);

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

  const handleDateSelect = (info) => {
    const resourceId = info.resource.id; // Es: "A01_M" o "A01_P"
    const baseCode = resourceId.split("_")[0];
    // Determina il valore della condizione ('matin' o 'apres-midi') basato sull'ID risorsa
    const conditionValue = resourceId.endsWith("_M") ? "matin" : "apres-midi";

    setSelectedResourceBase(baseCode);
    setSelectedConditionValue(conditionValue); // Salva 'matin' o 'apres-midi'
    setSelectedDate(info.startStr);
    setOpen(true);
    setFormData({
      nom: "",
      prenom: "",
      endDate: info.startStr,
      condition: conditionValue, // Pre-compila con 'matin' o 'apres-midi'
    });
    setSelectedOriginalReservation(null);
  };

  const handleEventClick = (info) => {
    const originalId = info.event.extendedProps?.originalId;
    if (!originalId) {
      console.error("ID Originale non trovato:", info.event);
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
      setSelectedConditionValue(""); // Non rilevante per modifica diretta
      setOpen(true);
    } else {
      console.error("Originale non trovato per ID:", originalId);
    }
  };

  const handleSaveReservation = async () => {
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
      condition: formData.condition, // 'jour entier', 'matin', o 'apres-midi'
      cellCode: cellCodeToSave,
      modifiedAt: new Date(),
    };

    const hasConflict = allReservations.some((existingRes) => {
      if (
        selectedOriginalReservation &&
        existingRes.id === selectedOriginalReservation.id
      ) {
        return false;
      }
      if (
        existingRes.cellCode !== reservationDetails.cellCode ||
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

    try {
      let updatedOriginalReservations;
      let reservationToUpdateOrAdd = { ...reservationDetails };

      if (selectedOriginalReservation) {
        const docRef = doc(db, "reservations", selectedOriginalReservation.id);
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
        handleSearch(newProcessedEvents);
        setOpen(false);
        setSelectedOriginalReservation(null);
      } catch (error) {
        console.error("Errore cancellazione:", error);
        alert(`Errore cancellazione: ${error.message}`);
      }
    }
  };

  const handleSearch = useCallback(
    (eventsToFilter = processedEvents) => {
      if (!queryStartDate || !queryEndDate) {
        setFilteredEvents(eventsToFilter);
        return;
      }
      if (queryEndDate < queryStartDate) {
        alert("Data fine ricerca non può precedere data inizio.");
        setFilteredEvents(eventsToFilter);
        return;
      }
      const filtered = eventsToFilter.filter((event) => {
        const originalData = event.extendedProps?.originalData;
        if (!originalData) return false;
        return datesOverlap(
          originalData.startDate,
          originalData.endDate,
          queryStartDate,
          queryEndDate
        );
      });
      setFilteredEvents(filtered);
    },
    [processedEvents, queryStartDate, queryEndDate]
  );

  return (
    <div style={{ padding: "20px" }}>
      {/* Ricerca */}
      <Box display="flex" alignItems="center" gap={2} mb={3} flexWrap="wrap">
        <Typography variant="h6">Ricerca per periodo :</Typography>
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
          Cercare
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setQueryStartDate("");
            setQueryEndDate("");
            setFilteredEvents(processedEvents);
          }}
        >
          Cancella filtro
        </Button>
      </Box>

      {/* Calendario */}
      <FullCalendar
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
        // --- LARGHEZZA RIDOTTA ---
        resourceAreaWidth="60px" // Prova con 60px. Se ancora troppo largo, ispeziona CSS.
        resourceLabelContent={(arg) => {
          return arg.resource.title;
        }}
        height="auto"
        resourceLaneClassNames={(arg) => {
          if (arg.resource.id.endsWith("_M")) return "fc-lane-morning";
          // Modificato per usare _P
          if (arg.resource.id.endsWith("_P")) return "fc-lane-afternoon";
          return null;
        }}
        selectAllow={(selectInfo) => {
          // Modificato per usare _P
          return (
            selectInfo.resource.id.includes("_M") ||
            selectInfo.resource.id.includes("_P") ||
            !selectInfo.resource.getChildren().length
          );
        }}
        // --- AJOUT ICI ---
        validRange={{
          start: "2025-04-01",
          end: "2025-12-02", // Important: La date de fin est exclusive
        }}
        // Optionnel: Définir la date initiale pour s'assurer qu'elle est dans la plage valide
        initialDate="2025-04-01"
      />

      {/* Modal */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>
          {selectedOriginalReservation
            ? `Modificare prenotazione (${selectedResourceBase})`
            : `Nuova Prenotazione (${selectedResourceBase} - ${selectedConditionValue})`}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Cognome"
            fullWidth
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            required
          />
          <TextField
            margin="dense"
            label="Nome"
            fullWidth
            value={formData.prenom}
            onChange={(e) =>
              setFormData({ ...formData, prenom: e.target.value })
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
            {/* Il valore è ancora 'apres-midi' ma il testo è Pomeriggio */}
            <MenuItem value="apres-midi">Pomeriggio</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          {selectedOriginalReservation && (
            <Button
              onClick={() => deleteReservation(selectedOriginalReservation.id)}
              color="error"
            >
              Cancellare
            </Button>
          )}
          <Button
            onClick={() => {
              setOpen(false);
              setSelectedOriginalReservation(null);
            }}
          >
            Annullare
          </Button>
          <Button onClick={handleSaveReservation} variant="contained">
            {selectedOriginalReservation ? "Modificare" : "Aggiungere"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default BeachPlanPeriod;
