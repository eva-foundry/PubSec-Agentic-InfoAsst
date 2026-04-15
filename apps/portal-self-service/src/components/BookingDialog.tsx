// ---------------------------------------------------------------------------
// BookingDialog — 2-step booking wizard (Details -> Entry Survey)
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@eva/ui-kit";
import {
  createBooking,
  submitEntrySurvey,
  type CatalogWorkspace,
} from "../api/client";

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    bookTitle: "Book Workspace",
    surveyTitle: "Entry Survey",
    bookDesc: "Reserve this workspace for your team",
    surveyDesc: "Tell us about your goals and intended use",
    workspace: "Workspace",
    yourName: "Your Name",
    startDate: "Start Date",
    endDate: "End Date",
    estimatedCost: "Estimated Cost",
    weeks: "weeks",
    step1: "Booking Details",
    step2: "Entry Survey",
    cancel: "Cancel",
    back: "Back",
    continueToSurvey: "Continue to Survey",
    confirmBooking: "Confirm Booking",
    useCase: "Use Case Description",
    useCasePlaceholder: "Describe what you plan to explore with EVA DA...",
    expectedBenefits: "Expected Benefits",
    benefitsPlaceholder: "What outcomes do you expect?",
    targetMetrics: "Target Metrics",
    metricsPlaceholder: "e.g., 80% accuracy, 50% time savings",
    teamSize: "Team Size",
    documentTypes: "Document Types",
    aiFeatures: "AI Features Needed",
    dataClassification: "Data Classification",
    required: "Required",
    dateError: "End date must be after start date",
    fillRequired: "Please fill in all required fields",
    submitting: "Submitting...",
    success: "Workspace booked successfully!",
    errorSubmit: "Booking failed. Please try again.",
    person: "person",
    people: "people",
    unclassified: "Unclassified",
    protectedA: "Protected A",
    protectedB: "Protected B",
  },
  fr: {
    bookTitle: "Reserver l'espace",
    surveyTitle: "Sondage d'entree",
    bookDesc: "Reservez cet espace pour votre equipe",
    surveyDesc: "Decrivez vos objectifs et utilisation prevue",
    workspace: "Espace de travail",
    yourName: "Votre nom",
    startDate: "Date de debut",
    endDate: "Date de fin",
    estimatedCost: "Cout estime",
    weeks: "semaines",
    step1: "Details de reservation",
    step2: "Sondage d'entree",
    cancel: "Annuler",
    back: "Retour",
    continueToSurvey: "Continuer au sondage",
    confirmBooking: "Confirmer la reservation",
    useCase: "Description du cas d'utilisation",
    useCasePlaceholder: "Decrivez ce que vous souhaitez explorer avec EVA DA...",
    expectedBenefits: "Benefices attendus",
    benefitsPlaceholder: "Quels resultats attendez-vous?",
    targetMetrics: "Metriques cibles",
    metricsPlaceholder: "p. ex., 80% de precision, 50% de gain de temps",
    teamSize: "Taille de l'equipe",
    documentTypes: "Types de documents",
    aiFeatures: "Fonctionnalites IA requises",
    dataClassification: "Classification des donnees",
    required: "Requis",
    dateError: "La date de fin doit etre apres la date de debut",
    fillRequired: "Veuillez remplir tous les champs obligatoires",
    submitting: "Envoi en cours...",
    success: "Espace reserve avec succes!",
    errorSubmit: "La reservation a echoue. Veuillez reessayer.",
    person: "personne",
    people: "personnes",
    unclassified: "Non classifie",
    protectedA: "Protege A",
    protectedB: "Protege B",
  },
};

const DOCUMENT_TYPES = [
  "PDFs",
  "Word",
  "Spreadsheets",
  "Presentations",
  "Images",
  "Scanned",
  "Technical",
  "Contracts",
  "Research",
  "Email",
];

const AI_FEATURES = [
  "Q&A",
  "Summarization",
  "Translation",
  "OCR",
  "NER",
  "Sentiment",
  "Topic Modeling",
  "Citation",
  "Cross-doc Search",
  "Tagging",
];

const DATA_CLASSIFICATIONS = [
  { value: "unclassified", en: "Unclassified", fr: "Non classifie" },
  { value: "protected_a", en: "Protected A", fr: "Protege A" },
  { value: "protected_b", en: "Protected B", fr: "Protege B" },
];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 350, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.15 },
  },
};

const shakeVariants = {
  shake: {
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: 0.4 },
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookingDialogProps {
  workspace: CatalogWorkspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookingDialog({
  workspace,
  open,
  onOpenChange,
  lang,
}: BookingDialogProps) {
  const t = strings[lang];
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [step, setStep] = useState<1 | 2>(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // -- Survey fields --
  const [useCase, setUseCase] = useState("");
  const [expectedBenefits, setExpectedBenefits] = useState("");
  const [targetMetrics, setTargetMetrics] = useState("");
  const [teamSize, setTeamSize] = useState("1");
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedAIFeatures, setSelectedAIFeatures] = useState<string[]>([]);
  const [dataClassification, setDataClassification] = useState("unclassified");

  // -- Computed cost --
  const costInfo = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    const weeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
    return { weeks, total: weeks * workspace.pricePerWeek };
  }, [startDate, endDate, workspace.pricePerWeek]);

  const triggerShake = useCallback(() => {
    setShakeKey((k) => k + 1);
  }, []);

  const resetForm = useCallback(() => {
    setStep(1);
    setStartDate("");
    setEndDate("");
    setUseCase("");
    setExpectedBenefits("");
    setTargetMetrics("");
    setTeamSize("1");
    setSelectedDocTypes([]);
    setSelectedAIFeatures([]);
    setDataClassification("unclassified");
    setErrorMsg(null);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleStep1Continue = useCallback(() => {
    if (!startDate || !endDate) {
      setErrorMsg(t.fillRequired);
      triggerShake();
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setErrorMsg(t.dateError);
      triggerShake();
      return;
    }
    setErrorMsg(null);
    setStep(2);
  }, [startDate, endDate, t, triggerShake]);

  const handleSubmit = useCallback(async () => {
    if (!useCase || !expectedBenefits || !targetMetrics) {
      setErrorMsg(t.fillRequired);
      triggerShake();
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const booking = await createBooking({
        workspace_id: workspace.id,
        start_date: startDate,
        end_date: endDate,
      });

      await submitEntrySurvey({
        booking_id: booking.id,
        use_case: useCase,
        expected_benefits: expectedBenefits,
        target_metrics: targetMetrics,
        team_size: parseInt(teamSize, 10),
        document_types: selectedDocTypes,
        ai_features: selectedAIFeatures,
        data_classification: dataClassification,
      });

      handleClose();
    } catch {
      setErrorMsg(t.errorSubmit);
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }, [
    useCase,
    expectedBenefits,
    targetMetrics,
    workspace.id,
    startDate,
    endDate,
    teamSize,
    selectedDocTypes,
    selectedAIFeatures,
    dataClassification,
    t,
    triggerShake,
    handleClose,
  ]);

  const toggleItem = (
    list: string[],
    setter: (v: string[]) => void,
    item: string,
  ) => {
    setter(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
    );
  };

  const wsName = lang === "fr" ? workspace.name_fr : workspace.name;

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="booking-overlay"
            variants={prefersReducedMotion ? undefined : overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/40"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            key="booking-dialog"
            variants={prefersReducedMotion ? undefined : dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={step === 1 ? t.bookTitle : t.surveyTitle}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              key={shakeKey}
              variants={prefersReducedMotion ? undefined : shakeVariants}
              animate={shakeKey > 0 ? "shake" : undefined}
              className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {step === 1 ? t.bookTitle : t.surveyTitle}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {step === 1 ? t.bookDesc : t.surveyDesc}
                </p>

                {/* Step progress */}
                <div className="mt-4 flex items-center gap-2">
                  <StepIndicator
                    number={1}
                    label={t.step1}
                    active={step === 1}
                    completed={step === 2}
                    reducedMotion={!!prefersReducedMotion}
                  />
                  <div className="relative h-0.5 flex-1 bg-gray-200 overflow-hidden rounded-full">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: step === 2 ? "100%" : "0%" }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 300, damping: 30 }
                      }
                    />
                  </div>
                  <StepIndicator
                    number={2}
                    label={t.step2}
                    active={step === 2}
                    completed={false}
                    reducedMotion={!!prefersReducedMotion}
                  />
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                {/* Error message */}
                {errorMsg && (
                  <div
                    className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {errorMsg}
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    {/* Workspace name */}
                    <FieldGroup label={t.workspace}>
                      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {wsName}
                      </div>
                    </FieldGroup>

                    {/* User name */}
                    <FieldGroup label={t.yourName}>
                      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {user?.name ?? "---"}
                      </div>
                    </FieldGroup>

                    {/* Date range */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FieldGroup label={`${t.startDate} *`}>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                          aria-required="true"
                        />
                      </FieldGroup>
                      <FieldGroup label={`${t.endDate} *`}>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate || undefined}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                          aria-required="true"
                        />
                      </FieldGroup>
                    </div>

                    {/* Cost calculation */}
                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {t.estimatedCost}
                        </span>
                        <span className="text-lg font-bold text-blue-700">
                          {costInfo
                            ? `$${costInfo.total.toLocaleString()} (${costInfo.weeks} ${t.weeks})`
                            : `$${workspace.pricePerWeek.toLocaleString()} / ${t.weeks}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    {/* Use case */}
                    <FieldGroup label={`${t.useCase} *`}>
                      <textarea
                        value={useCase}
                        onChange={(e) => setUseCase(e.target.value)}
                        placeholder={t.useCasePlaceholder}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                        aria-required="true"
                      />
                    </FieldGroup>

                    {/* Expected benefits */}
                    <FieldGroup label={`${t.expectedBenefits} *`}>
                      <textarea
                        value={expectedBenefits}
                        onChange={(e) => setExpectedBenefits(e.target.value)}
                        placeholder={t.benefitsPlaceholder}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                        aria-required="true"
                      />
                    </FieldGroup>

                    {/* Target metrics */}
                    <FieldGroup label={`${t.targetMetrics} *`}>
                      <textarea
                        value={targetMetrics}
                        onChange={(e) => setTargetMetrics(e.target.value)}
                        placeholder={t.metricsPlaceholder}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                        aria-required="true"
                      />
                    </FieldGroup>

                    {/* Team size */}
                    <FieldGroup label={`${t.teamSize} *`}>
                      <select
                        value={teamSize}
                        onChange={(e) => setTeamSize(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        aria-required="true"
                      >
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n}{" "}
                              {n === 1 ? t.person : t.people}
                            </option>
                          ),
                        )}
                      </select>
                    </FieldGroup>

                    {/* Document types multi-select */}
                    <FieldGroup label={`${t.documentTypes} *`}>
                      <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-gray-300 p-3">
                        {DOCUMENT_TYPES.map((dt) => (
                          <label
                            key={dt}
                            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDocTypes.includes(dt)}
                              onChange={() =>
                                toggleItem(
                                  selectedDocTypes,
                                  setSelectedDocTypes,
                                  dt,
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {dt}
                          </label>
                        ))}
                      </div>
                    </FieldGroup>

                    {/* AI features multi-select */}
                    <FieldGroup label={`${t.aiFeatures} *`}>
                      <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-gray-300 p-3">
                        {AI_FEATURES.map((feat) => (
                          <label
                            key={feat}
                            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAIFeatures.includes(feat)}
                              onChange={() =>
                                toggleItem(
                                  selectedAIFeatures,
                                  setSelectedAIFeatures,
                                  feat,
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {feat}
                          </label>
                        ))}
                      </div>
                    </FieldGroup>

                    {/* Data classification */}
                    <FieldGroup label={`${t.dataClassification} *`}>
                      <select
                        value={dataClassification}
                        onChange={(e) => setDataClassification(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        aria-required="true"
                      >
                        {DATA_CLASSIFICATIONS.map((dc) => (
                          <option key={dc.value} value={dc.value}>
                            {lang === "fr" ? dc.fr : dc.en}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
                {step === 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleStep1Continue}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {t.continueToSurvey}
                    </button>
                  </>
                )}
                {step === 2 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setStep(1);
                      }}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {t.back}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {submitting ? t.submitting : t.confirmBooking}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div id={id}>{children}</div>
    </div>
  );
}

function StepIndicator({
  number,
  label,
  active,
  completed,
  reducedMotion,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
  reducedMotion: boolean;
}) {
  const bg = active
    ? "bg-blue-600 text-white"
    : completed
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-200 text-gray-500";

  return (
    <div className="flex items-center gap-2">
      <motion.div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${bg}`}
        animate={
          reducedMotion
            ? undefined
            : { scale: active ? 1.1 : 1 }
        }
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        aria-current={active ? "step" : undefined}
      >
        {completed ? "\u2713" : number}
      </motion.div>
      <span
        className={`text-xs font-medium ${active ? "text-blue-700" : "text-gray-500"}`}
      >
        {label}
      </span>
    </div>
  );
}
