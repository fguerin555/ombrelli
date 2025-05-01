import React, { useState, useEffect, useCallback, useMemo } from "react"; // Suppression useRef
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline"; // Assurez-vous que le plugin est bien inclus
import interactionPlugin from "@fullcalendar/interaction"; // Ajout pour l'interaction (select, eventClick)
import itLocale from "@fullcalendar/core/locales/it"; // Importer la locale italienne
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from "@mui/material"; // Ajout des composants Dialog
import { useTheme } from "@mui/material/styles"; // Importer useTheme pour le fond
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore"; // Ajout imports Firebase
import { db } from "./firebase"; // Import db depuis le bon chemin

export default function StickyCalendarTest() {
  // Utilisation de useMemo pour mémoriser 'resources'
  const resources = useMemo(() => {
    // Garde la génération des ressources
    const resourcesArray = [];
    const letters = ["A", "B", "C", "D"];
    // Création dynamique des ressources (A01-D36 avec sous-ressources)
    letters.forEach((letter) => {
      for (let i = 1; i <= 36; i++) {
        const num = i.toString().padStart(2, "0");
        const id = `${letter}${num}`;
        resourcesArray.push({ id, title: id });
        resourcesArray.push({ id: `${id}_M`, parentId: id, title: "Mattina" });
        resourcesArray.push({
          id: `${id}_P`, // Garde Pomeriggio pour correspondre à la condition
          parentId: id,
          title: "Pomeriggio",
        });
      }
    });
    return resourcesArray;
  }, []); // Utilisez un tableau vide comme dépendance pour n'exécuter cette logique qu'une seule fois

  // --- Début du code ajouté depuis BeachPlanPeriod ---

  // Utilitaires copiés
  const capitalizeFirstLetter = (s) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
  const getColorForCondition = (cond) =>
    ({
      "jour entier": "#e57373", // Rouge
      matin: "#64b5f6", // Bleu
      "apres-midi": "#ffb74d", // Orange
    }[cond] || "#9e9e9e"); // Gris par défaut
  const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const datesOverlap = (s1, e1, s2, e2) => {
    if (!s1 || !e1 || !s2 || !e2) return false; // Vérification null/undefined
    const a = new Date(s1),
      b = new Date(e1),
      c = new Date(s2),
      d = new Date(e2);
    return a <= d && b >= c;
  };

  // États copiés
  const [allReservations, setAllReservations] = useState([]);
  const [processedEvents, setProcessedEvents] = useState([]);
  // Note: filteredEvents n'est pas utilisé ici car il n'y a pas de barre de recherche
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

  // Process reservations (copié et adapté)
  const processReservationsToEvents = useCallback((reservations) => {
    const evts = [];
    reservations.forEach((item) => {
      const { id, startDate, endDate, nom, prenom, condition, cellCode } = item;
      if (!startDate || !cellCode) return;
      const endValid = endDate && endDate >= startDate ? endDate : startDate; // Vérifie endDate
      const endCal = addDays(endValid, 1); // FullCalendar exclut la date de fin
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
        // Doit correspondre à la valeur exacte
        evts.push({ ...common, id: `${id}_P`, resourceId: `${cellCode}_P` });
      }
    });
    return evts;
  }, []);

  // Chargement initial (copié)
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
        // Gérer l'erreur (ex: afficher un message)
      }
    })();
  }, [processReservationsToEvents]);

  // Gestionnaires d'événements (copiés et adaptés de BeachPlanPeriod)
  const handleDateSelect = (info) => {
    if (!info.resource?.id.match(/_(M|P)$/)) return; // Ne rien faire si on clique sur le parent A01
    setSelectedResBase(info.resource.id.split("_")[0]);
    setSelectedDate(info.startStr);
    setFormData({
      nom: "",
      prenom: "",
      endDate: info.startStr, // Par défaut, fin = début
      condition: info.resource.id.endsWith("_M") ? "matin" : "apres-midi",
    });
    setSelectedOriginal(null); // C'est une nouvelle réservation
    setOpen(true);
  };

  const handleEventClick = (info) => {
    const orig = allReservations.find(
      (r) => r.id === info.event.extendedProps.originalId
    );
    if (orig) {
      setSelectedOriginal(orig);
      setFormData({
        nom: orig.nom || "",
        prenom: orig.prenom || "",
        endDate: orig.endDate || orig.startDate, // Assurer une valeur
        condition: orig.condition || "jour entier", // Assurer une valeur
      });
      setSelectedResBase(orig.cellCode);
      setSelectedDate(orig.startDate);
      setOpen(true);
    } else {
      console.warn("Original reservation not found for event:", info.event);
    }
  };

  const resetForm = () => {
    setOpen(false);
    setSelectedOriginal(null);
    // Réinitialiser formData peut être utile aussi
    setFormData({ nom: "", prenom: "", endDate: "", condition: "jour entier" });
  };

  const handleSave = async () => {
    if (
      !formData.nom ||
      !selectedDate ||
      !formData.endDate ||
      !formData.condition ||
      !selectedResBase
    ) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    // Vérification de conflit (simplifiée, peut nécessiter ajustement pour M/P)
    const conflict = allReservations.some((r) => {
      if (r.id === selectedOriginal?.id) return false; // Ne pas comparer avec soi-même
      if (r.cellCode !== selectedResBase) return false; // Pas le même parasol
      if (!datesOverlap(r.startDate, r.endDate, selectedDate, formData.endDate))
        return false; // Pas de chevauchement de dates

      // Vérification plus fine des conditions (matin/aprem/jour entier)
      const newIsMatin =
        formData.condition === "matin" || formData.condition === "jour entier";
      const newIsAprem =
        formData.condition === "apres-midi" ||
        formData.condition === "jour entier";
      const existingIsMatin =
        r.condition === "matin" || r.condition === "jour entier";
      const existingIsAprem =
        r.condition === "apres-midi" || r.condition === "jour entier";

      return (newIsMatin && existingIsMatin) || (newIsAprem && existingIsAprem);
    });

    if (conflict) {
      alert("Conflit de réservation détecté pour ce parasol et cette période.");
      return;
    }

    const payload = {
      nom: formData.nom,
      prenom: formData.prenom || "", // Assurer une chaîne vide si non fourni
      startDate: selectedDate,
      endDate: formData.endDate,
      condition: formData.condition,
      cellCode: selectedResBase,
    };

    try {
      if (selectedOriginal) {
        await updateDoc(doc(db, "reservations", selectedOriginal.id), payload);
      } else {
        await addDoc(collection(db, "reservations"), payload);
      }

      // Recharger les données après sauvegarde
      const snap = await getDocs(collection(db, "reservations"));
      const alls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllReservations(alls);
      const evts = processReservationsToEvents(alls);
      setProcessedEvents(evts);
      resetForm();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Une erreur est survenue lors de la sauvegarde.");
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir supprimer cette réservation ?"
      ) &&
      selectedOriginal
    ) {
      try {
        await deleteDoc(doc(db, "reservations", selectedOriginal.id));

        // Recharger les données après suppression
        const snap = await getDocs(collection(db, "reservations"));
        const alls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllReservations(alls);
        const evts = processReservationsToEvents(alls);
        setProcessedEvents(evts);
        resetForm();
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Une erreur est survenue lors de la suppression.");
      }
    }
  };

  // --- Fin du code ajouté depuis BeachPlanPeriod ---

  const theme = useTheme(); // Récupérer le thème

  return (
    // Le Box principal n'écoute plus le double clic
    <Box sx={{ height: "90vh", overflow: "auto", border: "1px solid #ccc" }}>
      {/*
      <Box
        sx={{
          height: "50px",
          backgroundColor: theme.palette.background.paper, // Utiliser la couleur du thème
          position: "sticky",
          top: 0,
          zIndex: 1200, // zIndex élevé pour être au-dessus du calendrier
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid #ccc",
        }}
      >
        Sticky Search Bar
      </Box>
      */}
      {/* Ce Box contient le calendrier et gère les styles sticky/scroll */}
      <Box
        sx={{
          // --- Styles pour rendre les en-têtes de la GRILLE sticky ---
          // Cibler la ligne (TR) qui contient les en-têtes de la grille
          "& .fc-scrollgrid-section-sticky": {
            position: "sticky",
            top: 0, // Coller en haut du conteneur scrollable principal
            zIndex: 1090,
          },
          // Appliquer le fond aux cellules TH et corriger l'overflow (nécessaire pour sticky)
          "& .fc-scrollgrid-section-sticky > th": {
            backgroundColor: theme.palette.background.paper,
            overflow: "visible !important", // Correctif overflow pour sticky
          },
          // --- Styles pour assurer le scroll horizontal DANS LE CORPS ---
          // (Garder ces styles)
          "& .fc-scrollgrid-section-body .fc-scroller, & .fc-scrollgrid-section-body .fc-scroller-harness":
            {
              // Correction: il manquait une accolade ouvrante ici
              overflow: "auto hidden !important", // Force X:auto et Y:hidden
            },
        }}
        // onDoubleClick={handleDoubleClick} // Suppression du gestionnaire double clic
      >
        <FullCalendar
          // ref={calendarRef} // Suppression de la ref
          plugins={[dayGridPlugin, resourceTimelinePlugin, interactionPlugin]} // Ajout interactionPlugin
          headerToolbar={false} // Supprimer la barre d'outils par défaut
          initialView="resourceTimeline" // Utiliser la vue timeline générique
          // duration={{ weeks: 4 }}        // On utilise visibleRange à la place
          visibleRange={{ start: "2025-05-01", end: "2025-12-02" }} // Plage du 01/05 au 01/12 inclus (gardé)
          resources={resources} // Passez bien les ressources comme ceci // --- Rétablissement des props d'interaction simple clic ---
          events={processedEvents} // Utiliser les événements traités depuis Firebase
          selectable={true} // Permettre la sélection de dates/cellules
          select={handleDateSelect} // Gérer la sélection
          eventClick={handleEventClick} // Gérer le clic sur événement
          initialDate="2025-05-01" // Commencer la vue au début de la plage
          locale={itLocale} // Utiliser la locale italienne
          resourceAreaHeaderContent="Ombrelli"
          slotDuration={{ days: 1 }}
          slotLabelFormat={{
            weekday: "short",
            day: "numeric",
            month: "numeric",
            omitCommas: true,
          }}
          displayEventTime={false} // Ne pas afficher l'heure sur les événements
          height="auto" // Laisser FullCalendar gérer sa hauteur interne
        />
      </Box>

      {/* --- Début Dialog JSX ajouté --- */}
      <Dialog open={open} onClose={resetForm} fullWidth maxWidth="xs">
        <DialogTitle>
          {selectedOriginal
            ? `Modifica Prenotazione (${selectedResBase})`
            : `Nuova Prenotazione (${selectedResBase} - ${selectedDate})`}
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
            disabled // La date de début est déterminée par la sélection
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
            inputProps={{ min: selectedDate }} // La date de fin ne peut pas être avant le début
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
              {" "}
              Cancella{" "}
            </Button>
          )}
          <Button onClick={resetForm}>Annulla</Button>
          <Button onClick={handleSave} variant="contained">
            {selectedOriginal ? "Modifica" : "Aggiungi"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* --- Fin Dialog JSX ajouté --- */}
    </Box>
  );
}
