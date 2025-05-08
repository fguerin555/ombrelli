// /Users/fredericguerin/Desktop/ombrelli/src/pages/BeachPlanFile/ReservationModal.js
import React, { useState, useEffect, useCallback } from "react";
import styles from "./ReservationModal.module.css";

// --- Fonctions Utilitaires ---
const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const capitalizeFirstLetter = (string) => {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  } catch (e) {
    console.warn("Formatage date échoué pour:", dateStr);
    return dateStr;
  }
};

const VALID_CABINS = "ABCDEFGHIJKLMNOPQRSTUWXYZ".split("");

const datesOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return start1 <= end2 && end1 >= start2;
};
// --- Fin Fonctions Utilitaires ---

// Helper pour initialiser un formulaire de demi-journée
const initializeHalfDayForm = (data, selectedDate, todayString) => {
  return {
    id: data.id || null,
    serialNumber: data.serialNumber || null,
    nom: capitalizeFirstLetter(data.nom || ""),
    prenom: capitalizeFirstLetter(data.prenom || ""),
    numBeds:
      data.numBeds === undefined
        ? 2
        : Math.min(Math.max(Number(data.numBeds) || 0, 0), 3),
    registiPoltrona: data.registiPoltrona || "", // Devrait être 'T' pour Transat ou 'R' pour Regista
    startDate: data.startDate || selectedDate || todayString,
    endDate: data.endDate || selectedDate || todayString,
    condition: data.condition, // Sera 'matin' ou 'apres-midi'
    cabina: data.cabina || null, // Ajouté pour initialiser la cabine
  };
};

const ReservationModal = ({
  isOpen,
  onClose,
  cellCode,
  reservationData,
  onSave,
  onDelete,
  isSaving,
  selectedDate,
  allReservations,
}) => {
  const todayString = getTodayString();
  const isDualMode = reservationData && reservationData.type === "dual";

  // --- États pour le mode formulaire unique (ou nouvelle résa) ---
  const [formData, setFormData] = useState({});
  const [isNew, setIsNew] = useState(true);
  const [mode, setMode] = useState("loading"); // loading, view, addHalfDay, editExisting
  const [freeHalfDay, setFreeHalfDay] = useState(null);
  const [existingHalfDayCondition, setExistingHalfDayCondition] =
    useState(null);
  const [singleDayCondition, setSingleDayCondition] = useState("");
  const [showSingleDayOptions, setShowSingleDayOptions] = useState(false);
  const [requestCabin, setRequestCabin] = useState(false);
  const [assignedCabin, setAssignedCabin] = useState("");
  const [cabinError, setCabinError] = useState("");
  const [umbrellaConflictError, setUmbrellaConflictError] = useState("");

  // --- États pour le mode double formulaire (matin ET après-midi) ---
  const [formDataMorning, setFormDataMorning] = useState({});
  const [requestCabinMorning, setRequestCabinMorning] = useState(false);
  const [assignedCabinMorning, setAssignedCabinMorning] = useState("");
  const [cabinErrorMorning, setCabinErrorMorning] = useState("");
  const [umbrellaConflictErrorMorning, setUmbrellaConflictErrorMorning] =
    useState("");

  const [formDataAfternoon, setFormDataAfternoon] = useState({});
  const [requestCabinAfternoon, setRequestCabinAfternoon] = useState(false);
  const [assignedCabinAfternoon, setAssignedCabinAfternoon] = useState("");
  const [cabinErrorAfternoon, setCabinErrorAfternoon] = useState("");
  const [umbrellaConflictErrorAfternoon, setUmbrellaConflictErrorAfternoon] =
    useState("");

  // --- Fonctions Callback Mémorisées ---
  const findNextAvailableCabin = useCallback(
    (startDate, endDate, currentReservationId) => {
      if (!startDate || !endDate || !Array.isArray(allReservations))
        return null;
      const conflictingCabins = allReservations
        .filter(
          (res) =>
            res.cabina &&
            res.id !== currentReservationId &&
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

  const resetFormForNew = useCallback(
    (condition = "jour entier", keepDates = false, baseFormData = {}) => {
      setFormData({
        id: null,
        serialNumber: null,
        nom: "",
        prenom: "",
        numBeds: 2,
        registiPoltrona: "",
        startDate: keepDates
          ? baseFormData.startDate
          : selectedDate || todayString,
        endDate: keepDates ? baseFormData.endDate : selectedDate || todayString,
        condition: condition,
        cabina: null, // Assurer que cabina est null pour une nouvelle résa
      });
      setRequestCabin(false);
      setAssignedCabin("");
      setCabinError("");
      setUmbrellaConflictError("");
      setShowSingleDayOptions(false);
    },
    [selectedDate, todayString]
  );

  // --- useEffect Principal: Initialisation et Détermination du Mode ---
  useEffect(() => {
    if (isOpen) {
      setMode("loading");
      setFreeHalfDay(null);
      setExistingHalfDayCondition(null);
      setUmbrellaConflictError("");
      setUmbrellaConflictErrorMorning("");
      setUmbrellaConflictErrorAfternoon("");

      if (isDualMode) {
        // --- CAS DUAL MODE ---
        const morningData = reservationData.morning || {};
        const afternoonData = reservationData.afternoon || {};

        setFormDataMorning(
          initializeHalfDayForm(morningData, selectedDate, todayString)
        );
        setRequestCabinMorning(!!morningData.cabina);
        setAssignedCabinMorning(morningData.cabina || "");
        setCabinErrorMorning("");

        setFormDataAfternoon(
          initializeHalfDayForm(afternoonData, selectedDate, todayString)
        );
        setRequestCabinAfternoon(!!afternoonData.cabina);
        setAssignedCabinAfternoon(afternoonData.cabina || "");
        setCabinErrorAfternoon("");

        setIsNew(false); // Les deux sont considérées comme existantes si elles ont un ID
        setMode("editExisting"); // On est en mode édition pour les deux
        setShowSingleDayOptions(false);
      } else {
        // --- CAS SINGLE MODE (ou nouvelle) ---
        const initialData = reservationData || {};
        const isActuallyNew = !initialData.id;
        setIsNew(isActuallyNew);

        const initialCondition = initialData.condition || "jour entier";
        const initialStartDate =
          initialData.startDate || selectedDate || todayString;
        const initialEndDate =
          initialData.endDate || selectedDate || todayString;

        setFormData({
          id: initialData.id || null,
          serialNumber: initialData.serialNumber || null,
          nom: capitalizeFirstLetter(initialData.nom || ""),
          prenom: capitalizeFirstLetter(initialData.prenom || ""),
          numBeds:
            initialData.numBeds === undefined
              ? 2
              : Math.min(Math.max(Number(initialData.numBeds) || 0, 0), 3),
          registiPoltrona: initialData.registiPoltrona || "",
          startDate: initialStartDate,
          endDate: initialEndDate,
          condition: initialCondition,
          cabina: initialData.cabina || null,
        });

        const initialRequestCabin = !!initialData.cabina;
        setRequestCabin(initialRequestCabin);
        setAssignedCabin(initialData.cabina || "");
        setCabinError("");

        let determinedMode = "editExisting";
        if (
          !isActuallyNew &&
          initialCondition !== "jour entier" &&
          selectedDate >= initialStartDate &&
          selectedDate <= initialEndDate
        ) {
          setExistingHalfDayCondition(initialCondition);
          const otherHalf =
            initialCondition === "matin" ? "apres-midi" : "matin";
          const conflictWithOtherHalf = allReservations.some(
            (res) =>
              res.id !== initialData.id &&
              res.cellCode === cellCode &&
              selectedDate >= res.startDate &&
              selectedDate <= res.endDate &&
              (res.condition === otherHalf || res.condition === "jour entier")
          );
          if (!conflictWithOtherHalf) {
            setFreeHalfDay(otherHalf);
            determinedMode = "view";
          } else {
            determinedMode = "editExisting";
          }
        } else if (isActuallyNew) {
          determinedMode = "editExisting";
          resetFormForNew(
            initialData.condition || "jour entier",
            false,
            initialData
          );
        }
        setMode(determinedMode);

        const isMultiDay = initialStartDate !== initialEndDate;
        const isSelectedDateWithinRange =
          selectedDate &&
          selectedDate >= initialStartDate &&
          selectedDate <= initialEndDate;
        const shouldShowSplit =
          !isActuallyNew &&
          isMultiDay &&
          isSelectedDateWithinRange &&
          determinedMode === "editExisting";
        setShowSingleDayOptions(shouldShowSplit);
        setSingleDayCondition(shouldShowSplit ? initialCondition : "");
      }
    } else {
      // Modal fermé: Reset complet
      setMode("loading");
      setFormData({});
      setIsNew(true);
      setFreeHalfDay(null);
      setExistingHalfDayCondition(null);
      setRequestCabin(false);
      setAssignedCabin("");
      setCabinError("");
      setUmbrellaConflictError("");
      setShowSingleDayOptions(false);
      setSingleDayCondition("");

      setFormDataMorning({});
      setRequestCabinMorning(false);
      setAssignedCabinMorning("");
      setCabinErrorMorning("");
      setUmbrellaConflictErrorMorning("");

      setFormDataAfternoon({});
      setRequestCabinAfternoon(false);
      setAssignedCabinAfternoon("");
      setCabinErrorAfternoon("");
      setUmbrellaConflictErrorAfternoon("");
    }
  }, [
    reservationData,
    isOpen,
    selectedDate,
    todayString,
    allReservations,
    cellCode,
    resetFormForNew,
    isDualMode,
  ]);

  // --- useEffects pour la gestion des Cabines (single, morning, afternoon) ---
  const useCabinEffect = (
    formDt,
    reqCabin,
    setAssCabin,
    setCabError,
    currentResId
  ) => {
    useEffect(() => {
      if (!isOpen || !formDt || Object.keys(formDt).length === 0) {
        // Vérifie si formDt est initialisé
        setAssCabin("");
        setCabError("");
        return;
      }
      if (reqCabin) {
        if (
          formDt.startDate &&
          formDt.endDate &&
          formDt.startDate <= formDt.endDate
        ) {
          const nextCabin = findNextAvailableCabin(
            formDt.startDate,
            formDt.endDate,
            currentResId
          );
          if (nextCabin) {
            setAssCabin(nextCabin);
            setCabError("");
          } else {
            setAssCabin("");
            setCabError("Nessuna cabina disponibile.");
          }
        } else {
          setAssCabin("");
          if (
            formDt.startDate &&
            formDt.endDate &&
            formDt.startDate > formDt.endDate
          ) {
            setCabError("Fine prima di inizio.");
          } else {
            setCabError(""); // Pas d'erreur si dates non valides mais pas encore de conflit
          }
        }
      } else {
        setAssCabin("");
        setCabError("");
      }
    }, [
      isOpen,
      reqCabin,
      formDt?.startDate, // Optional chaining
      formDt?.endDate, // Optional chaining
      findNextAvailableCabin,
      currentResId,
      setAssCabin,
      setCabError,
      formDt, // Ajout de formDt comme dépendance
    ]);
  };

  useCabinEffect(
    formData,
    requestCabin,
    setAssignedCabin,
    setCabinError,
    formData.id
  );
  // Appeler les Hooks pour morning/afternoon inconditionnellement.
  // Les Hooks eux-mêmes ont des gardes pour ne rien faire si formDt est vide.
  useCabinEffect(
    formDataMorning,
    requestCabinMorning,
    setAssignedCabinMorning,
    setCabinErrorMorning,
    formDataMorning.id
  );
  useCabinEffect(
    formDataAfternoon,
    requestCabinAfternoon,
    setAssignedCabinAfternoon,
    setCabinErrorAfternoon,
    formDataAfternoon.id
  );

  // --- useEffects pour la vérification de conflit d'Ombrellone ---
  const useUmbrellaConflictEffect = (
    formDt,
    setConflictError,
    currentMode // 'editExisting', 'addHalfDay', 'view', 'loading'
  ) => {
    useEffect(() => {
      if (
        !isOpen ||
        currentMode === "loading" ||
        (currentMode === "view" && !isDualMode) || // Pas de vérif en mode view single
        !formDt ||
        Object.keys(formDt).length === 0 // Si formDt n'est pas prêt
      ) {
        setConflictError("");
        return;
      }
      setConflictError(""); // Reset avant chaque vérification

      if (
        !cellCode ||
        !formDt.startDate ||
        !formDt.endDate ||
        !formDt.condition ||
        !Array.isArray(allReservations) ||
        formDt.startDate > formDt.endDate
      ) {
        return; // Pas assez d'infos pour vérifier ou dates invalides
      }

      const currentId = formDt.id;
      const currentStart = formDt.startDate;
      const currentEnd = formDt.endDate;
      const currentCondition = formDt.condition;

      const conflictingRes = allReservations.find((existingRes) => {
        if (currentId && existingRes.id === currentId) return false; // Ne pas comparer avec soi-même
        if (
          existingRes.cellCode === cellCode &&
          datesOverlap(
            currentStart,
            currentEnd,
            existingRes.startDate,
            existingRes.endDate
          )
        ) {
          const existingCondition = existingRes.condition;
          // Conflit si:
          // 1. L'un ou l'autre est "jour entier"
          // 2. Les deux sont "matin"
          // 3. Les deux sont "apres-midi"
          if (
            currentCondition === "jour entier" ||
            existingCondition === "jour entier" ||
            currentCondition === existingCondition // Couvre matin/matin et apres-midi/apres-midi
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
        setConflictError(
          `Conflitto: Ombrellone ${cellCode} già prenotato (${existingCondText}) ${conflictPeriod} (Cliente: ${
            conflictingRes.nom
          } ${conflictingRes.prenom}, N° ${
            conflictingRes.serialNumber || "N/A"
          }). Modificare date o condizione.`
        );
      } else {
        setConflictError("");
      }
    }, [
      isOpen,
      currentMode,
      cellCode,
      formDt?.startDate, // Optional chaining
      formDt?.endDate,
      formDt?.condition,
      formDt?.id,
      allReservations,
      setConflictError,
      isDualMode,
      formDt, // Ajout de formDt comme dépendance
    ]);
  };

  useUmbrellaConflictEffect(formData, setUmbrellaConflictError, mode);
  // Appeler les Hooks pour morning/afternoon inconditionnellement.
  // Les Hooks eux-mêmes ont des gardes pour ne rien faire si formDt est vide.
  useUmbrellaConflictEffect(
    formDataMorning,
    setUmbrellaConflictErrorMorning,
    isDualMode ? "editExisting" : "loading" // Fournir un mode pertinent
  );
  useUmbrellaConflictEffect(
    formDataAfternoon,
    setUmbrellaConflictErrorAfternoon,
    isDualMode ? "editExisting" : "loading" // Fournir un mode pertinent
  );

  // --- Gestionnaires d'Événements du Formulaire ---
  const handleAddHalfDayClick = () => {
    resetFormForNew(freeHalfDay, true, formData);
    setMode("addHalfDay");
  };

  const handleEditExistingClick = () => {
    setMode("editExisting");
  };

  const createChangeHandler = (
    setFormDt,
    setRequestCab, // Fonction pour mettre à jour requestCabin (e.g., setRequestCabin, setRequestCabinMorning)
    currentIsNew, // Pour le formulaire single
    currentModeForSplitLogic // Pour le formulaire single
  ) => {
    return (e) => {
      const { name, value, type, checked } = e.target;

      if (name === "requestCabin") {
        setRequestCab(checked); // Utilise la fonction passée en argument
        return;
      }
      if (name === "singleDayCondition") {
        setSingleDayCondition(value);
        return;
      }

      let processedValue = value;
      if (name === "registiPoltrona") {
        const upperValue = value.toUpperCase();
        processedValue = ["R", "T", ""].includes(upperValue) ? upperValue : "";
      } else if (name === "nom" || name === "prenom") {
        processedValue = capitalizeFirstLetter(value);
      } else if (type === "number") {
        const numValue = e.target.valueAsNumber;
        processedValue = isNaN(numValue) ? "" : numValue;
        if (name === "numBeds" && typeof processedValue === "number") {
          processedValue = Math.min(Math.max(processedValue, 0), 3);
        }
      }

      setFormDt((prev) => {
        const newState = { ...prev, [name]: processedValue };
        if (
          name === "startDate" &&
          newState.endDate &&
          newState.endDate < processedValue
        ) {
          newState.endDate = processedValue;
        }
        if (
          name === "endDate" &&
          newState.startDate &&
          processedValue < newState.startDate
        ) {
          newState.startDate = processedValue;
        }

        // Logique showSingleDayOptions uniquement pour le formulaire single
        if (setFormDt === setFormData) {
          // Vérifie si c'est le handler pour le formulaire principal
          if (currentModeForSplitLogic === "editExisting") {
            const isMultiDay =
              newState.startDate &&
              newState.endDate &&
              newState.startDate !== newState.endDate;
            const isSelectedDateWithinRange =
              selectedDate &&
              newState.startDate &&
              newState.endDate &&
              selectedDate >= newState.startDate &&
              selectedDate <= newState.endDate;
            setShowSingleDayOptions(
              !currentIsNew && isMultiDay && isSelectedDateWithinRange
            );
          } else {
            setShowSingleDayOptions(false);
          }
        }
        return newState;
      });
    };
  };

  const handleChange = createChangeHandler(
    setFormData,
    setRequestCabin,
    isNew,
    mode
  );
  const handleChangeMorning = createChangeHandler(
    setFormDataMorning,
    setRequestCabinMorning, // Passe la bonne fonction setRequestCabin
    false,
    "editExisting"
  );
  const handleChangeAfternoon = createChangeHandler(
    setFormDataAfternoon,
    setRequestCabinAfternoon, // Passe la bonne fonction setRequestCabin
    false,
    "editExisting"
  );

  const createSaveHandler = (
    formDt,
    reqCabin,
    assCabin,
    cabError,
    umbConflictError,
    currentIsNew, // Pour le cas single
    currentModeForSaveLogic // Pour le cas single
  ) => {
    return (e) => {
      e.preventDefault();
      if (!formDt.nom || !formDt.prenom) {
        alert("Cognome e Nome sono obbligatori.");
        return;
      }
      if (!formDt.startDate || !formDt.endDate) {
        alert("Le date di inizio e fine sono obbligatorie.");
        return;
      }
      if (formDt.endDate < formDt.startDate) {
        alert("La data di fine non può essere precedente alla data di inizio.");
        return;
      }
      if (
        formDt.numBeds === "" ||
        isNaN(formDt.numBeds) ||
        formDt.numBeds < 0 ||
        formDt.numBeds > 3
      ) {
        alert("Il numero di lettini deve essere compreso tra 0 e 3.");
        return;
      }
      if (reqCabin && !assCabin && cabError) {
        alert(`Impossibile salvare: ${cabError}`);
        return;
      }
      if (reqCabin && !assCabin && !cabError) {
        alert(
          "Attendere l'assegnazione della cabina o deselezionare la richiesta."
        );
        return;
      }
      if (umbConflictError) {
        alert(
          "Impossibile salvare a causa di un conflitto con un'altra prenotazione.\n" +
            umbConflictError
        );
        return;
      }

      let dataToSend = {
        ...formDt,
        cellCode,
        cabina: reqCabin && assCabin ? assCabin : null,
      };

      // Logique de split (uniquement pour le formulaire single)
      if (
        formDt === formData && // S'applique seulement au formulaire single
        currentModeForSaveLogic === "editExisting" &&
        showSingleDayOptions &&
        singleDayCondition &&
        singleDayCondition !== formDt.condition // Condition pour le jour splitté est différente
      ) {
        dataToSend = {
          ...dataToSend,
          modifySingleDay: true,
          targetDate: selectedDate,
          targetDateCondition: singleDayCondition,
        };
      } else {
        dataToSend.modifySingleDay = false;
      }

      // Forcer création si 'addHalfDay' (uniquement pour le formulaire single)
      if (formDt === formData && currentModeForSaveLogic === "addHalfDay") {
        delete dataToSend.id;
        delete dataToSend.serialNumber;
      }
      // Forcer création si changement nom/prénom sur une résa existante (uniquement pour le formulaire single)
      else if (
        formDt === formData &&
        currentModeForSaveLogic === "editExisting" &&
        reservationData &&
        reservationData.id &&
        (formDt.nom !== capitalizeFirstLetter(reservationData.nom || "") ||
          formDt.prenom !== capitalizeFirstLetter(reservationData.prenom || ""))
      ) {
        delete dataToSend.id;
        delete dataToSend.serialNumber;
      }

      onSave(dataToSend);
    };
  };

  const handleSave = createSaveHandler(
    formData,
    requestCabin,
    assignedCabin,
    cabinError,
    umbrellaConflictError,
    isNew,
    mode
  );
  const handleSaveMorning = createSaveHandler(
    formDataMorning,
    requestCabinMorning,
    assignedCabinMorning,
    cabinErrorMorning,
    umbrellaConflictErrorMorning,
    false,
    "editExisting"
  );
  const handleSaveAfternoon = createSaveHandler(
    formDataAfternoon,
    requestCabinAfternoon,
    assignedCabinAfternoon,
    cabinErrorAfternoon,
    umbrellaConflictErrorAfternoon,
    false,
    "editExisting"
  );

  const createDeleteHandler = (formDt) => {
    return () => {
      if (formDt.id) {
        onDelete(formDt.id);
      } else {
        alert("Eliminazione non applicabile per una nuova prenotazione.");
      }
    };
  };

  const handleDeleteClick = createDeleteHandler(formData);
  const handleDeleteMorning = createDeleteHandler(formDataMorning);
  const handleDeleteAfternoon = createDeleteHandler(formDataAfternoon);

  // --- Rendu du Formulaire (partie réutilisable) ---
  const renderFormFields = (
    formDt,
    handleChangeFn,
    reqCabin,
    // setReqCabinFn, // Plus besoin de passer setReqCabinFn, handleChangeFn s'en occupe
    assCabin,
    cabErrorTxt,
    umbConflictErrorTxt,
    isNewFlag,
    currentFormMode,
    periodLabel = null
  ) => {
    if (!formDt || Object.keys(formDt).length === 0) {
      return <p>Caricamento dati modulo...</p>; // Ou un autre placeholder
    }

    const isSaveDisabled =
      isSaving ||
      (reqCabin && !assCabin && !!cabErrorTxt) ||
      !!umbConflictErrorTxt;

    const isImplicitlyNewSingle =
      formDt === formData &&
      (currentFormMode === "addHalfDay" ||
        (currentFormMode === "editExisting" &&
          reservationData &&
          reservationData.id &&
          (formDt.nom !== capitalizeFirstLetter(reservationData.nom || "") ||
            formDt.prenom !==
              capitalizeFirstLetter(reservationData.prenom || ""))));

    return (
      <div className={periodLabel ? styles.halfDayFormSection : ""}>
        {periodLabel && <h3>Prenotazione {periodLabel}</h3>}
        {formDt.serialNumber &&
          (isDualMode ||
            (currentFormMode === "editExisting" &&
              !isImplicitlyNewSingle &&
              !isNewFlag)) && (
            <p className={styles.serialNumber}>
              N° Prenotazione: <strong>{formDt.serialNumber}</strong>
            </p>
          )}

        <div className={styles.formGroup}>
          <label htmlFor={`condition-${periodLabel || "single"}`}>
            Condizione:
          </label>
          <select
            id={`condition-${periodLabel || "single"}`}
            name="condition"
            value={formDt.condition || "jour entier"}
            onChange={handleChangeFn}
            required
            disabled={
              (isDualMode &&
                (periodLabel === "Matin" || periodLabel === "Après-midi")) ||
              (formDt === formData && currentFormMode === "addHalfDay")
            }
          >
            <option value="jour entier">Giorno Intero</option>
            <option value="matin">Mattina</option>
            <option value="apres-midi">Pomeriggio</option>
          </select>
          {formDt === formData && currentFormMode === "addHalfDay" && (
            <small style={{ marginLeft: "10px" }}>
              (Per la mezza giornata libera)
            </small>
          )}
        </div>

        {umbConflictErrorTxt && (
          <p
            className={styles.errorText}
            style={{
              color: "red",
              fontWeight: "bold",
              marginTop: "-5px",
              marginBottom: "10px",
            }}
          >
            {umbConflictErrorTxt}
          </p>
        )}

        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label htmlFor={`nom-${periodLabel || "single"}`}>Cognome:</label>
            <input
              id={`nom-${periodLabel || "single"}`}
              name="nom"
              value={formDt.nom || ""}
              onChange={handleChangeFn}
              required
              autoComplete="family-name"
              type="text"
            />
          </div>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label htmlFor={`prenom-${periodLabel || "single"}`}>Nome:</label>
            <input
              id={`prenom-${periodLabel || "single"}`}
              name="prenom"
              value={formDt.prenom || ""}
              onChange={handleChangeFn}
              required
              autoComplete="given-name"
              type="text"
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label htmlFor={`numBeds-${periodLabel || "single"}`}>
              N° lettini (0-3):
            </label>
            <input
              id={`numBeds-${periodLabel || "single"}`}
              name="numBeds"
              value={formDt.numBeds ?? ""}
              onChange={handleChangeFn}
              required
              min="0"
              max="3"
              type="number"
              step="1"
            />
          </div>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label htmlFor={`registiPoltrona-${periodLabel || "single"}`}>
              + Regista (R) / Transat (T)
            </label>
            <input
              id={`registiPoltrona-${periodLabel || "single"}`}
              name="registiPoltrona"
              value={formDt.registiPoltrona || ""}
              onChange={handleChangeFn}
              maxLength="1"
              placeholder="R / T"
              style={{ textTransform: "uppercase" }}
              type="text"
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label htmlFor={`startDate-${periodLabel || "single"}`}>
              Primo Giorno:
            </label>
            <input
              id={`startDate-${periodLabel || "single"}`}
              name="startDate"
              value={formDt.startDate || ""}
              onChange={handleChangeFn}
              required
              type="date"
            />
          </div>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label htmlFor={`endDate-${periodLabel || "single"}`}>
              Ultimo Giorno:
            </label>
            <input
              id={`endDate-${periodLabel || "single"}`}
              name="endDate"
              value={formDt.endDate || ""}
              onChange={handleChangeFn}
              required
              min={formDt.startDate || ""}
              type="date"
            />
          </div>
        </div>

        <div
          className={styles.formGroup}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "10px",
          }}
        >
          <label
            htmlFor={`requestCabin-${periodLabel || "single"}`}
            style={{ marginBottom: 0, marginRight: "5px" }}
          >
            Richiedi Cabina:
          </label>
          <input
            type="checkbox"
            id={`requestCabin-${periodLabel || "single"}`}
            name="requestCabin"
            checked={reqCabin}
            onChange={handleChangeFn}
            style={{
              width: "auto",
              cursor: "pointer",
              transform: "scale(1.2)",
            }}
          />
          {reqCabin && (
            <span
              className={`${styles.assignedCabinInfo} ${
                cabErrorTxt ? styles.errorText : ""
              }`}
              style={{ marginLeft: "10px", fontWeight: "bold" }}
            >
              {assCabin
                ? `Assegnata: ${assCabin}`
                : cabErrorTxt || "Ricerca..."}
            </span>
          )}
        </div>

        {formDt === formData &&
          currentFormMode === "editExisting" &&
          showSingleDayOptions && (
            <div className={styles.singleDaySection}>
              <p>
                Modifica solo per il giorno{" "}
                <strong>{formatDateForDisplay(selectedDate)}</strong>
              </p>
              <div className={styles.formGroup}>
                <label htmlFor="singleDayCondition">
                  Condizione per questo giorno:
                </label>
                <select
                  id="singleDayCondition"
                  name="singleDayCondition"
                  value={singleDayCondition}
                  onChange={handleChangeFn}
                >
                  <option value={formDt.condition || "jour entier"}>
                    -- Mantieni (
                    {formDt.condition
                      .replace("jour entier", "Giorno Intero")
                      .replace("matin", "Mattina")
                      .replace("apres-midi", "Pomeriggio")}
                    ) --
                  </option>
                  {formDt.condition !== "jour entier" && (
                    <option value="jour entier">Giorno Intero</option>
                  )}
                  {formDt.condition !== "matin" && (
                    <option value="matin">Mattina</option>
                  )}
                  {formDt.condition !== "apres-midi" && (
                    <option value="apres-midi">Pomeriggio</option>
                  )}
                </select>
              </div>
              <small>
                Selezionando una condizione diversa qui, la prenotazione verrà
                divisa.
              </small>
            </div>
          )}
      </div>
    );
  };

  // --- Rendu JSX Principal ---
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>
          {isDualMode
            ? "Gestione Prenotazioni"
            : mode === "addHalfDay" || (isNew && mode !== "view")
            ? "Nuova Prenotazione"
            : "Modifica Prenotazione"}
          {" per "}
          <strong>{cellCode}</strong>
        </h2>

        {isDualMode ? (
          <>
            <form onSubmit={handleSaveMorning} style={{ marginBottom: "20px" }}>
              {renderFormFields(
                formDataMorning,
                handleChangeMorning,
                requestCabinMorning,
                // setRequestCabinMorning, // Retiré, géré par handleChangeMorning
                assignedCabinMorning,
                cabinErrorMorning,
                umbrellaConflictErrorMorning,
                false,
                "editExisting",
                "Matin"
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={handleDeleteMorning}
                  disabled={isSaving || !formDataMorning.id}
                >
                  Elimina Mattina
                </button>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    (requestCabinMorning &&
                      !assignedCabinMorning &&
                      !!cabinErrorMorning) ||
                    !!umbrellaConflictErrorMorning
                  }
                >
                  {isSaving ? "Salvataggio..." : "Salva Mattina"}
                </button>
              </div>
            </form>
            <hr className={styles.formSeparator} />
            <form onSubmit={handleSaveAfternoon}>
              {renderFormFields(
                formDataAfternoon,
                handleChangeAfternoon,
                requestCabinAfternoon,
                // setRequestCabinAfternoon, // Retiré, géré par handleChangeAfternoon
                assignedCabinAfternoon,
                cabinErrorAfternoon,
                umbrellaConflictErrorAfternoon,
                false,
                "editExisting",
                "Après-midi"
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={handleDeleteAfternoon}
                  disabled={isSaving || !formDataAfternoon.id}
                >
                  Elimina Pomeriggio
                </button>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    (requestCabinAfternoon &&
                      !assignedCabinAfternoon &&
                      !!cabinErrorAfternoon) ||
                    !!umbrellaConflictErrorAfternoon
                  }
                >
                  {isSaving ? "Salvataggio..." : "Salva Pomeriggio"}
                </button>
              </div>
            </form>
            <div className={styles.buttonGroup} style={{ marginTop: "20px" }}>
              <button type="button" onClick={onClose} disabled={isSaving}>
                Esci
              </button>
            </div>
          </>
        ) : (
          <>
            {mode === "view" && freeHalfDay && (
              <div className={styles.actionChoiceSection}>
                <p>
                  Prenotazione esistente per{" "}
                  <strong>
                    {existingHalfDayCondition === "matin"
                      ? "la Mattina"
                      : "il Pomeriggio"}
                  </strong>
                  .
                </p>
                <p>
                  L'altra metà giornata (
                  <strong>
                    {freeHalfDay === "matin" ? "Mattina" : "Pomeriggio"}
                  </strong>
                  ) è libera il {formatDateForDisplay(selectedDate)}.
                </p>
                <p>Cosa vuoi fare?</p>
                <div className={styles.buttonGroupChoice}>
                  <button
                    onClick={handleAddHalfDayClick}
                    className={styles.choiceButton}
                  >
                    Aggiungi Nuova (
                    {freeHalfDay === "matin" ? "Mattina" : "Pomeriggio"})
                  </button>
                  <button
                    onClick={handleEditExistingClick}
                    className={styles.choiceButton}
                  >
                    Modifica Esistente (
                    {existingHalfDayCondition === "matin"
                      ? "Mattina"
                      : "Pomeriggio"}
                    )
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ marginTop: "15px" }}
                >
                  Annulla / Esci
                </button>
              </div>
            )}

            {(mode === "editExisting" || mode === "addHalfDay") && (
              <form onSubmit={handleSave}>
                {renderFormFields(
                  formData,
                  handleChange,
                  requestCabin,
                  // setRequestCabin, // Retiré, géré par handleChange
                  assignedCabin,
                  cabinError,
                  umbrellaConflictError,
                  isNew,
                  mode
                )}
                <div className={styles.buttonGroup}>
                  <button type="button" onClick={onClose} disabled={isSaving}>
                    Esci
                  </button>
                  {mode === "editExisting" &&
                    !isNew &&
                    !(
                      mode === "editExisting" &&
                      reservationData &&
                      reservationData.id &&
                      (formData.nom !==
                        capitalizeFirstLetter(reservationData.nom || "") ||
                        formData.prenom !==
                          capitalizeFirstLetter(reservationData.prenom || ""))
                    ) && (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={handleDeleteClick}
                        disabled={isSaving || !formData.id}
                      >
                        Elimina
                      </button>
                    )}
                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      (requestCabin && !assignedCabin && !!cabinError) ||
                      !!umbrellaConflictError
                    }
                  >
                    {isSaving ? "Salvataggio..." : "Salva"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
        {mode === "loading" && !isDualMode && <p>Caricamento...</p>}
      </div>
    </div>
  );
};

export default ReservationModal;
