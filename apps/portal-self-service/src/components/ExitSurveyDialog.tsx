// ---------------------------------------------------------------------------
// ExitSurveyDialog — Exit survey with cost recovery information
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Booking } from "@eva/common";
import { submitExitSurvey, updateBooking } from "../api/client";

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    title: "Exit Survey",
    subtitle:
      "Share your results and experience to help us improve EVA Domain Assistant",
    resultsSection: "Results & Outcomes",
    actualResults: "What results did you achieve?",
    resultsPlaceholder: "Describe the outcomes you achieved...",
    goalsAchieved: "Did you achieve your stated goals?",
    goalsYes: "Yes, fully achieved",
    goalsPartial: "Partially achieved",
    goalsNo: "Not achieved",
    lessonsLearned: "Key lessons learned",
    lessonsPlaceholder: "What insights did you gain?",
    blockers: "Blockers or challenges",
    blockersPlaceholder: "Any obstacles or challenges?",
    suggestions: "Suggestions for improvement",
    suggestionsPlaceholder: "How can we improve EVA DA?",
    overallRating: "Overall experience rating",
    costSection: "Cost Recovery Information",
    department: "Department",
    departmentPlaceholder: "e.g., IT Services",
    costCenter: "Cost Center",
    costCenterPlaceholder: "e.g., CC-12345",
    approverName: "Approver Name",
    approverNamePlaceholder: "John Smith",
    approverEmail: "Approver Email",
    approverEmailPlaceholder: "john.smith@gc.ca",
    totalCost: "Total Cost",
    cancel: "Cancel",
    submit: "Submit & Complete",
    submitting: "Submitting...",
    fillRequired: "Please fill in all required fields",
    submitError: "Submission failed. Please try again.",
    required: "required",
  },
  fr: {
    title: "Sondage de sortie",
    subtitle:
      "Partagez vos resultats et votre experience pour ameliorer EVA",
    resultsSection: "Resultats et conclusions",
    actualResults: "Quels resultats avez-vous obtenus?",
    resultsPlaceholder: "Decrivez les resultats obtenus...",
    goalsAchieved: "Avez-vous atteint vos objectifs?",
    goalsYes: "Oui, entierement atteints",
    goalsPartial: "Partiellement atteints",
    goalsNo: "Non atteints",
    lessonsLearned: "Lecons apprises",
    lessonsPlaceholder: "Quelles perspectives avez-vous acquises?",
    blockers: "Obstacles ou defis",
    blockersPlaceholder: "Des obstacles ou des defis?",
    suggestions: "Suggestions d'amelioration",
    suggestionsPlaceholder: "Comment ameliorer EVA DA?",
    overallRating: "Evaluation globale de l'experience",
    costSection: "Informations de recouvrement des couts",
    department: "Departement",
    departmentPlaceholder: "p. ex., Services TI",
    costCenter: "Centre de couts",
    costCenterPlaceholder: "p. ex., CC-12345",
    approverName: "Nom de l'approbateur",
    approverNamePlaceholder: "Jean Dupont",
    approverEmail: "Courriel de l'approbateur",
    approverEmailPlaceholder: "jean.dupont@gc.ca",
    totalCost: "Cout total",
    cancel: "Annuler",
    submit: "Soumettre et terminer",
    submitting: "Envoi en cours...",
    fillRequired: "Veuillez remplir tous les champs obligatoires",
    submitError: "La soumission a echoue. Veuillez reessayer.",
    required: "requis",
  },
};

// ---------------------------------------------------------------------------
// Animation
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
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
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

interface ExitSurveyDialogProps {
  booking: Booking;
  totalCost: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExitSurveyDialog({
  booking,
  totalCost,
  open,
  onOpenChange,
  onComplete,
  lang,
}: ExitSurveyDialogProps) {
  const t = strings[lang];
  const prefersReducedMotion = useReducedMotion();

  // -- Results fields --
  const [actualResults, setActualResults] = useState("");
  const [goalsAchieved, setGoalsAchieved] = useState<"yes" | "partial" | "no">(
    "yes",
  );
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [blockers, setBlockers] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [rating, setRating] = useState(5);

  // -- Cost recovery fields --
  const [department, setDepartment] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const resetForm = useCallback(() => {
    setActualResults("");
    setGoalsAchieved("yes");
    setLessonsLearned("");
    setBlockers("");
    setSuggestions("");
    setRating(5);
    setDepartment("");
    setCostCenter("");
    setApproverName("");
    setApproverEmail("");
    setErrorMsg(null);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (
      !actualResults.trim() ||
      !lessonsLearned.trim() ||
      !department.trim() ||
      !costCenter.trim() ||
      !approverName.trim() ||
      !approverEmail.trim()
    ) {
      setErrorMsg(t.fillRequired);
      setShakeKey((k) => k + 1);
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await submitExitSurvey({
        booking_id: booking.id,
        actual_results: actualResults.trim(),
        goals_achieved: goalsAchieved,
        lessons_learned: lessonsLearned.trim(),
        blockers: blockers.trim() || undefined,
        suggestions: suggestions.trim() || undefined,
        rating,
        department: department.trim(),
        cost_center: costCenter.trim(),
        approver_name: approverName.trim(),
        approver_email: approverEmail.trim(),
      });

      // Mark booking as completed
      await updateBooking(booking.id, {
        status: "completed",
        exit_survey_completed: true,
      });

      handleClose();
      onComplete();
    } catch {
      setErrorMsg(t.submitError);
      setShakeKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }, [
    actualResults,
    goalsAchieved,
    lessonsLearned,
    blockers,
    suggestions,
    rating,
    department,
    costCenter,
    approverName,
    approverEmail,
    booking.id,
    t,
    handleClose,
    onComplete,
  ]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="exit-overlay"
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
            key="exit-dialog"
            variants={prefersReducedMotion ? undefined : dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
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
                  {t.title}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">{t.subtitle}</p>
              </div>

              {/* Body */}
              <div className="space-y-6 px-6 py-5">
                {/* Error */}
                {errorMsg && (
                  <div
                    className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {errorMsg}
                  </div>
                )}

                {/* Results section */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900">
                    {t.resultsSection}
                  </h3>

                  {/* Actual results */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-results"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.actualResults} *
                    </label>
                    <textarea
                      id="exit-results"
                      value={actualResults}
                      onChange={(e) => setActualResults(e.target.value)}
                      placeholder={t.resultsPlaceholder}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      aria-required="true"
                    />
                  </div>

                  {/* Goals achieved */}
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-gray-700">
                      {t.goalsAchieved} *
                    </legend>
                    {(
                      [
                        ["yes", t.goalsYes],
                        ["partial", t.goalsPartial],
                        ["no", t.goalsNo],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="goals-achieved"
                          value={value}
                          checked={goalsAchieved === value}
                          onChange={() => setGoalsAchieved(value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>

                  {/* Lessons learned */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-lessons"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.lessonsLearned} *
                    </label>
                    <textarea
                      id="exit-lessons"
                      value={lessonsLearned}
                      onChange={(e) => setLessonsLearned(e.target.value)}
                      placeholder={t.lessonsPlaceholder}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      aria-required="true"
                    />
                  </div>

                  {/* Blockers */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-blockers"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.blockers}
                    </label>
                    <textarea
                      id="exit-blockers"
                      value={blockers}
                      onChange={(e) => setBlockers(e.target.value)}
                      placeholder={t.blockersPlaceholder}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Suggestions */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-suggestions"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.suggestions}
                    </label>
                    <textarea
                      id="exit-suggestions"
                      value={suggestions}
                      onChange={(e) => setSuggestions(e.target.value)}
                      placeholder={t.suggestionsPlaceholder}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Rating slider */}
                  <div className="space-y-2">
                    <label
                      htmlFor="exit-rating"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.overallRating}: {rating}/10
                    </label>
                    <input
                      id="exit-rating"
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={rating}
                      onChange={(e) => setRating(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600"
                      aria-valuemin={1}
                      aria-valuemax={10}
                      aria-valuenow={rating}
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                </div>

                {/* Cost recovery section */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900">
                    {t.costSection}
                  </h3>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-dept"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.department} *
                    </label>
                    <input
                      id="exit-dept"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder={t.departmentPlaceholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-cc"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.costCenter} *
                    </label>
                    <input
                      id="exit-cc"
                      type="text"
                      value={costCenter}
                      onChange={(e) => setCostCenter(e.target.value)}
                      placeholder={t.costCenterPlaceholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-approver-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.approverName} *
                    </label>
                    <input
                      id="exit-approver-name"
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder={t.approverNamePlaceholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="exit-approver-email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.approverEmail} *
                    </label>
                    <input
                      id="exit-approver-email"
                      type="email"
                      value={approverEmail}
                      onChange={(e) => setApproverEmail(e.target.value)}
                      placeholder={t.approverEmailPlaceholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      aria-required="true"
                    />
                  </div>

                  {/* Total cost display */}
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {t.totalCost}
                      </span>
                      <span className="text-lg font-bold text-blue-700">
                        ${totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {submitting ? t.submitting : t.submit}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
