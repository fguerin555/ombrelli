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
import ScrollButtons from "../../components/ScrollButtons";

// Utilitaires
const capitalizeFirstLetter = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
const getColorForCondition = (cond) =>
  ({ "jour entier": "#e57373", matin: "#64b5f6", "apres-midi": "#ffb74d" }[
    cond
  ] || "#9e9e9e");
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const datesOverlap = (s1, e1, s2, e2) => {
  const a = new Date(s1),
    b = new Date(e1),
    c = new Date(s2),
    d = new Date(e2);
  return a <= d && b >= c;
};

const INITIAL_CALENDAR_DATE = "2025-04-01";

export default function BeachPlanPeriod() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const searchBarRef = useRef(null);
  // const scrollButtonsRef = useRef(null); // Supprimé  // const [scrollButtonsHeight, setScrollButtonsHeight] = useState(0); // Supprimé
  const calendarRef = useRef(null);

  // Données
  const [allReservations, setAllReservations] = useState([]);
  const [processedEvents, setProcessedEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);

  // Formulaire & sélection
  const [queryStartDate, setQueryStartDate] = useState("");
  const [queryEndDate, setQueryEndDate] = useState("");
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    endDate: "",
    condition: "jour entier",
  });
  const [selectedResBase, setSelectedResBase] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedOriginal, setSelectedOriginal] = useState(null);

  // Récupère resources génériques (A01..D36 -> M,P)
  const generateResources = () => {
    const letters = ["A", "B", "C", "D"];
    const res = [];
    letters.forEach((l) => {
      for (let i = 1; i <= 36; i++) {
        const num = i.toString().padStart(2, "0");
        const base = `${l}${num}`;
        res.push({ id: base, title: base });
        res.push({ id: `${base}_M`, parentId: base, title: "Mattina" });
        res.push({ id: `${base}_P`, parentId: base, title: "Pomer." });
      }
    });
    return res;
  };

  // Process reservations
  const processReservationsToEvents = useCallback((reservations) => {
    const evts = [];
    reservations.forEach((item) => {
      const { id, startDate, endDate, nom, prenom, condition, cellCode } = item;
      if (!startDate || !cellCode) return;
      const endValid = endDate >= startDate ? endDate : startDate;
      const endCal = addDays(endValid, 1);
      const title = prenom ? `${nom} ${prenom}` : nom || "Sans nom";
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

  // Chargement initial
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "reservations"));
      const alls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllReservations(alls);
      const evts = processReservationsToEvents(alls);
      setProcessedEvents(evts);
      setFilteredEvents(evts);
    })();
  }, [processReservationsToEvents]);

  // Recherche
  const handleSearch = () => {
    if (!queryStartDate || !queryEndDate) {
      setFilteredEvents(processedEvents);
      return;
    }
    const relevant = new Set(
      allReservations
        .filter((r) =>
          datesOverlap(r.startDate, r.endDate, queryStartDate, queryEndDate)
        )
        .map((r) => r.id)
    );
    setFilteredEvents(
      processedEvents.filter((e) => relevant.has(e.extendedProps.originalId))
    );
    if (calendarRef.current && !isMobile) {
      calendarRef.current.getApi().gotoDate(queryStartDate);
    }
  };

  // Form interactions
  const handleDateSelect = (info) => {
    if (!info.resource?.id.match(/_(M|P)$/)) return;
    setSelectedResBase(info.resource.id.split("_")[0]);
    setSelectedDate(info.startStr);
    setFormData({
      nom: "",
      prenom: "",
      endDate: info.startStr,
      condition: info.resource.id.endsWith("_M") ? "matin" : "apres-midi",
    });
    setSelectedOriginal(null);
    setOpen(true);
  };
  const handleEventClick = (info) => {
    const orig = allReservations.find(
      (r) => r.id === info.event.extendedProps.originalId
    );
    if (orig) {
      setSelectedOriginal(orig);
      setFormData({
        nom: orig.nom,
        prenom: orig.prenom,
        endDate: orig.endDate,
        condition: orig.condition,
      });
      setSelectedResBase(orig.cellCode);
      setSelectedDate(orig.startDate);
      setOpen(true);
    }
  };
  const resetForm = () => {
    setOpen(false);
    setSelectedOriginal(null);
  };
  const handleSave = async () => {
    if (
      !formData.nom ||
      !selectedDate ||
      !formData.endDate ||
      !formData.condition ||
      !selectedResBase
    ) {
      alert("Champs requis");
      return;
    }
    const conflict = allReservations.some(
      (r) =>
        r.id !== selectedOriginal?.id &&
        r.cellCode === selectedResBase &&
        datesOverlap(r.startDate, r.endDate, selectedDate, formData.endDate)
    );
    if (conflict) {
      alert("Conflit");
      return;
    }
    const payload = {
      nom: formData.nom,
      prenom: formData.prenom,
      startDate: selectedDate,
      endDate: formData.endDate,
      condition: formData.condition,
      cellCode: selectedResBase,
    };
    if (selectedOriginal) {
      await updateDoc(doc(db, "reservations", selectedOriginal.id), payload);
    } else {
      await addDoc(collection(db, "reservations"), payload);
    }
    // Reload
    const snap = await getDocs(collection(db, "reservations"));
    const alls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setAllReservations(alls);
    const evts = processReservationsToEvents(alls);
    setProcessedEvents(evts);
    setFilteredEvents(evts);
    resetForm();
  };
  const handleDelete = async () => {
    if (window.confirm("Confirmer?") && selectedOriginal) {
      await deleteDoc(doc(db, "reservations", selectedOriginal.id));
      // Recharger les données après suppression
      const snap = await getDocs(collection(db, "reservations"));
      const alls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllReservations(alls);
      const evts = processReservationsToEvents(alls);
      setProcessedEvents(evts);
      // Appliquer le filtre actuel aux nouvelles données
      if (!queryStartDate || !queryEndDate) {
        setFilteredEvents(evts);
      } else {
        const relevant = new Set(
          alls
            .filter((r) =>
              datesOverlap(r.startDate, r.endDate, queryStartDate, queryEndDate)
            )
            .map((r) => r.id)
        );
        setFilteredEvents(
          evts.filter((e) => relevant.has(e.extendedProps.originalId))
        );
      }
      resetForm();
    }
  };

  // Sticky heights & Variable CSS
  useEffect(() => {
    const calendarBox = calendarRef.current
      ?.getApi()
      .el?.closest(".calendar-container-box");
    let searchBarObserver;

    const updateSearchBarHeight = (height) => {
      if (calendarBox) {
        // Mettre à jour la variable CSS ici
        calendarBox.style.setProperty("--fixed-sticky-offset", `${height}px`);
        console.log(`CSS Variable --fixed-sticky-offset set to: ${height}px`);
      }
    };

    if (searchBarRef.current && !isMobile) {
      searchBarObserver = new ResizeObserver(([entry]) => {
        updateSearchBarHeight(entry.target.offsetHeight);
      });
      searchBarObserver.observe(searchBarRef.current);
      // Mise à jour initiale
      updateSearchBarHeight(searchBarRef.current.offsetHeight);
    } else {
      updateSearchBarHeight(0); // Reset si mobile ou pas de barre
    }

    return () => {
      if (searchBarObserver) {
        searchBarObserver.disconnect();
      }
      // Nettoyer la variable CSS si le composant est démonté
      if (calendarBox) {
        calendarBox.style.removeProperty("--fixed-sticky-offset");
      }
    };
  }, [isMobile]); // Dépend de isMobile pour réévaluer si la barre est affichée

  // Ajout d'un console.log pour vérifier les hauteurs

  return (
    <div style={{ padding: 20 }}>
      {/* Barre de recherche sticky - Réactivée */}
      {!isMobile && (
        <Box
          ref={searchBarRef}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1100,
            background: theme.palette.background.paper,
            p: 2,
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center", // Pour aligner verticalement les éléments
          }}
        >
          <Typography>Ricerca periodo:</Typography>
          <TextField
            label="Data inizio"
            type="date"
            value={queryStartDate}
            onChange={(e) => setQueryStartDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Data fine"
            type="date"
            value={queryEndDate}
            onChange={(e) => setQueryEndDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: queryStartDate }}
          />
          <Button variant="contained" onClick={handleSearch} size="small">
            Cerca
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setQueryStartDate("");
              setQueryEndDate("");
              setFilteredEvents(processedEvents);
              if (calendarRef.current && !isMobile)
                calendarRef.current.getApi().gotoDate(INITIAL_CALENDAR_DATE);
            }}
            size="small"
          >
            Cancella filtro
          </Button>
          {/* ScrollButtons déplacés ici */}
          <Box
            sx={{ marginLeft: "auto", display: "flex", alignItems: "center" }}
          >
            {" "}
            {/* Pour les pousser à droite */}
            <ScrollButtons
              onPrevClick={() => calendarRef.current?.getApi().prev()}
              onNextClick={() => calendarRef.current?.getApi().next()}
              isPrevDisabled={false}
              isNextDisabled={false}
            />
          </Box>
        </Box>
      )}

      {/* Box des boutons supprimé */}

      {/* Calendrier avec sticky header dates */}
      <Box
        // Ajout d'une classe pour cibler plus facilement ce Box spécifique
        className="calendar-container-box"
        sx={{
          // overflowX: "auto", // ENLEVÉ - Cassait le contexte sticky pour la page
          // Cible les en-têtes de colonne (dates) DANS la section header
          "& .fc-scrollgrid-section-header .fc-col-header": {
            position: "sticky", // Revenir à la valeur dynamique
            top: "88px", // Utilise la variable CSS
            zIndex: 1085,
            backgroundColor: theme.palette.background.paper,
          },
          // Cible l'en-tête de la zone de ressource ("Ombrelli") DANS la section header
          "& .fc-scrollgrid-section-header .fc-resource-area-header": {
            position: "sticky", // Revenir à la valeur dynamique
            top: "88px", // Utilise la variable CSS
            left: 0,
            zIndex: 1086,
            backgroundColor: theme.palette.background.paper,
          },
          // Cible TOUS les conteneurs scroller INTERNES de la section header
          "& .fc-scrollgrid-section-header .fc-scroller": {
            overflow: "visible !important",
            // Ajout pour essayer de contrer le style inline et aider overflow:visible
            minHeight: "1px",
          },
          // Cible AUSSI les conteneurs "harness" qui enveloppent les scrollers dans l'en-tête
          "& .fc-scrollgrid-section-header .fc-scroller-harness": {
            overflow: "visible !important", // Force AUSSI leur overflow pour ne pas casser le sticky
          },
          // *** NOUVEAU : Gérer le scroll horizontal DANS le corps du calendrier ***
          "& .fc-scrollgrid-section-body .fc-scroller": {
            overflowX: "auto !important", // Appliquer le scroll horizontal ici
            overflowY: "hidden !important", // Empêcher le scroll vertical ici (géré par la page)
          },
          // *** NOUVELLE TENTATIVE : Forcer l'overflow sur fc-view-harness ***
          "& .fc-view-harness": {
            overflow: "visible !important",
          },
          // *** Suppression de l'override du scroller des ressources du BODY (moins probable) ***
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
          initialView="resourceTimelineWeek"
          locale={itLocale}
          headerToolbar={false}
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
          resources={generateResources()}
          events={filteredEvents}
          select={handleDateSelect}
          eventClick={handleEventClick}
          slotDuration={{ days: 1 }}
          slotLabelFormat={{
            weekday: "short",
            day: "numeric",
            month: "numeric",
            omitCommas: true,
          }}
          resourceAreaWidth="60px"
          resourceAreaHeaderContent="Ombrelli"
          resourceLabelContent={(arg) => (
            <Typography sx={{ fontSize: "0.7rem", textAlign: "center" }}>
              {arg.resource.title}
            </Typography>
          )}
          displayEventTime={false}
          selectable
          validRange={{ start: INITIAL_CALENDAR_DATE, end: "2025-12-02" }}
          initialDate={INITIAL_CALENDAR_DATE}
          height="auto" // Important pour que les scrollers internes fonctionnent correctement
        />
      </Box>

      {/* Le div gris pour tester le scroll peut être enlevé si le scroll naturel est suffisant */}
      {/* <div style={{ height: '2000px', background: 'lightgray', marginTop: '20px' }}>
        Espace pour tester le défilement
      </div> */}

      {/* Dialog */}
      <Dialog open={open} onClose={resetForm} fullWidth maxWidth="xs">
        <DialogTitle>
          {selectedOriginal
            ? `Modifica (${selectedResBase})`
            : `Nuova (${selectedResBase} - ${selectedDate})`}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
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
          />
          <TextField
            fullWidth
            margin="dense"
            label="Nome"
            value={formData.prenom}
            onChange={(e) =>
              setFormData({
                ...formData,
                prenom: capitalizeFirstLetter(e.target.value),
              })
            }
          />
          <TextField
            fullWidth
            margin="dense"
            label="Data Inizio"
            type="date"
            value={selectedDate}
            InputLabelProps={{ shrink: true }}
            disabled
          />
          <TextField
            fullWidth
            margin="dense"
            label="Data Fine"
            type="date"
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
            fullWidth
            margin="dense"
            label="Condizione"
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
          {selectedOriginal && (
            <Button color="error" onClick={handleDelete}>
              Cancella
            </Button>
          )}
          <Button onClick={resetForm}>Annulla</Button>
          <Button onClick={handleSave} variant="contained">
            {selectedOriginal ? "Modifica" : "Aggiungi"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
