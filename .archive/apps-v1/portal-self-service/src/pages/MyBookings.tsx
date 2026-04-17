// ---------------------------------------------------------------------------
// MyBookings — Active and past bookings with actions
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Booking } from "@eva/common";
import {
  getBookings,
  fetchWorkspaceCatalog,
  type CatalogWorkspace,
} from "../api/client";
import TeamManagementDialog from "../components/TeamManagementDialog";
import ExitSurveyDialog from "../components/ExitSurveyDialog";

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    title: "My Bookings",
    subtitle: "View and manage your workspace reservations",
    loading: "Loading bookings...",
    error: "Failed to load bookings",
    retry: "Retry",
    empty: "No bookings yet",
    emptyDesc: "Browse available workspaces to make your first reservation",
    manageTeam: "Manage Team",
    exitSurvey: "Complete Exit Survey",
    viewReceipt: "View Receipt",
    totalCost: "Total Cost",
    dateRange: "Date Range",
    entrySurvey: "Entry Survey",
    exitSurveyLabel: "Exit Survey",
    completed: "Completed",
    notCompleted: "Pending",
    active: "Active",
    cancelled: "Cancelled",
    pending: "Pending",
    confirmed: "Confirmed",
  },
  fr: {
    title: "Mes reservations",
    subtitle: "Consultez et gerez vos reservations d'espace",
    loading: "Chargement des reservations...",
    error: "Impossible de charger les reservations",
    retry: "Reessayer",
    empty: "Aucune reservation",
    emptyDesc: "Parcourez les espaces disponibles pour creer votre premiere reservation",
    manageTeam: "Gerer l'equipe",
    exitSurvey: "Sondage de sortie",
    viewReceipt: "Voir le recu",
    totalCost: "Cout total",
    dateRange: "Periode",
    entrySurvey: "Sondage d'entree",
    exitSurveyLabel: "Sondage de sortie",
    completed: "Termine",
    notCompleted: "En attente",
    active: "Actif",
    cancelled: "Annule",
    pending: "En attente",
    confirmed: "Confirme",
  },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-100", text: "text-green-800" },
  completed: { bg: "bg-amber-100", text: "text-amber-800" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-600" },
  pending: { bg: "bg-blue-100", text: "text-blue-800" },
  confirmed: { bg: "bg-blue-100", text: "text-blue-800" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MyBookingsProps {
  lang: Lang;
}

export default function MyBookings({ lang }: MyBookingsProps) {
  const t = strings[lang];
  const prefersReducedMotion = useReducedMotion();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [exitSurveyOpen, setExitSurveyOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bks, wss] = await Promise.all([
        getBookings(),
        fetchWorkspaceCatalog(),
      ]);
      setBookings(bks);
      setWorkspaces(wss);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getWorkspace = (wsId: string) =>
    workspaces.find((w) => w.id === wsId);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === "fr" ? "fr-CA" : "en-CA",
        { month: "short", day: "numeric", year: "numeric" },
      );
    } catch {
      return dateStr;
    }
  };

  const computeCost = (booking: Booking, ws: CatalogWorkspace) => {
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    const weeks = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)),
    );
    return weeks * ws.pricePerWeek;
  };

  const handleManageTeam = (b: Booking) => {
    setSelectedBooking(b);
    setTeamDialogOpen(true);
  };

  const handleExitSurvey = (b: Booking) => {
    setSelectedBooking(b);
    setExitSurveyOpen(true);
  };

  const handleExitSurveyComplete = useCallback(() => {
    // Refresh bookings after exit survey submission
    loadData();
  }, [loadData]);

  // -- Loading --
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  // -- Error --
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-red-600">{t.error}</p>
          <button
            type="button"
            onClick={loadData}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  // -- Empty --
  if (bookings.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="mb-8 text-sm text-gray-500">{t.subtitle}</p>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16">
          <div className="mb-3 text-4xl text-gray-300" aria-hidden="true">
            &#128197;
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-700">
            {t.empty}
          </h3>
          <p className="text-sm text-gray-500">{t.emptyDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
        <AnimatePresence>
          {bookings.map((booking) => {
            const ws = getWorkspace(booking.workspace_id);
            const wsName = ws
              ? lang === "fr"
                ? ws.name_fr
                : ws.name
              : booking.workspace_id;
            const statusStyle =
              STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending;
            const statusLabel =
              t[booking.status as keyof typeof t] ?? booking.status;
            const cost = ws ? computeCost(booking, ws) : 0;

            return (
              <motion.div
                key={booking.id}
                layout={!prefersReducedMotion}
                initial={
                  prefersReducedMotion ? undefined : { opacity: 0, y: 10 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  prefersReducedMotion ? undefined : { opacity: 0, y: -10 }
                }
                className="rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                {/* Card header */}
                <div className="flex items-start justify-between p-5 pb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {wsName}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Card body */}
                <div className="space-y-3 px-5 pb-4">
                  {/* Date range */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span aria-hidden="true">&#128197;</span>
                    <span>
                      {formatDate(booking.start_date)} &mdash;{" "}
                      {formatDate(booking.end_date)}
                    </span>
                  </div>

                  {/* Cost + survey badges */}
                  <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-3">
                    <div>
                      <p className="text-xs text-gray-500">{t.totalCost}</p>
                      <p className="text-sm font-semibold text-gray-900">
                        ${cost.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            booking.entry_survey_completed
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {t.entrySurvey}{" "}
                          {booking.entry_survey_completed ? "\u2713" : ""}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            booking.exit_survey_completed
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {t.exitSurveyLabel}{" "}
                          {booking.exit_survey_completed ? "\u2713" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => handleManageTeam(booking)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {t.manageTeam}
                  </button>
                  {booking.status === "active" &&
                    !booking.exit_survey_completed && (
                      <button
                        type="button"
                        onClick={() => handleExitSurvey(booking)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {t.exitSurvey}
                      </button>
                    )}
                  {booking.status === "completed" && (
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {t.viewReceipt}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Dialogs */}
      {selectedBooking && (
        <>
          <TeamManagementDialog
            bookingId={selectedBooking.id}
            open={teamDialogOpen}
            onOpenChange={setTeamDialogOpen}
            lang={lang}
          />
          <ExitSurveyDialog
            booking={selectedBooking}
            totalCost={
              (() => {
                const ws = getWorkspace(selectedBooking.workspace_id);
                return ws ? computeCost(selectedBooking, ws) : 0;
              })()
            }
            open={exitSurveyOpen}
            onOpenChange={setExitSurveyOpen}
            onComplete={handleExitSurveyComplete}
            lang={lang}
          />
        </>
      )}
    </div>
  );
}
