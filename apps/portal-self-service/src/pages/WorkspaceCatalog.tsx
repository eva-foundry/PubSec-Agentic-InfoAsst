// ---------------------------------------------------------------------------
// WorkspaceCatalog — Browse available workspace types and initiate booking
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  fetchWorkspaceCatalog,
  type CatalogWorkspace,
} from "../api/client";
import BookingDialog from "../components/BookingDialog";

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    title: "Available Workspaces",
    subtitle:
      "Browse and reserve EVA Domain Assistant environments tailored to your needs",
    features: "Key Features",
    capacity: "Capacity",
    users: "users",
    pricePerWeek: "Price / Week",
    book: "Book This Workspace",
    loading: "Loading workspaces...",
    error: "Failed to load workspaces",
    retry: "Retry",
    empty: "No workspaces available at this time.",
  },
  fr: {
    title: "Espaces de travail disponibles",
    subtitle:
      "Parcourez et reservez des environnements EVA adaptes a vos besoins",
    features: "Fonctionnalites cles",
    capacity: "Capacite",
    users: "utilisateurs",
    pricePerWeek: "Prix / semaine",
    book: "Reserver cet espace",
    loading: "Chargement des espaces...",
    error: "Impossible de charger les espaces",
    retry: "Reessayer",
    empty: "Aucun espace disponible pour le moment.",
  },
};

const TYPE_BADGES: Record<string, { label: string; label_fr: string; color: string }> = {
  standard: { label: "Standard", label_fr: "Standard", color: "bg-blue-100 text-blue-800" },
  premium: { label: "Premium", label_fr: "Premium", color: "bg-purple-100 text-purple-800" },
  sandbox: { label: "Sandbox", label_fr: "Bac a sable", color: "bg-amber-100 text-amber-800" },
  restricted: { label: "Restricted", label_fr: "Restreint", color: "bg-red-100 text-red-800" },
  shared: { label: "Shared", label_fr: "Partage", color: "bg-green-100 text-green-800" },
};

const TYPE_ICONS: Record<string, string> = {
  standard: "\uD83D\uDCCA",
  premium: "\u2B50",
  sandbox: "\uD83E\uddEA",
  restricted: "\uD83D\uDD12",
  shared: "\uD83E\uDD1D",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WorkspaceCatalogProps {
  lang: Lang;
}

export default function WorkspaceCatalog({ lang }: WorkspaceCatalogProps) {
  const t = strings[lang];
  const prefersReducedMotion = useReducedMotion();

  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWorkspace, setSelectedWorkspace] =
    useState<CatalogWorkspace | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceCatalog();
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleBook = (ws: CatalogWorkspace) => {
    setSelectedWorkspace(ws);
    setBookingOpen(true);
  };

  // -- Loading state --
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  // -- Error state --
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-red-600">{t.error}</p>
          <button
            type="button"
            onClick={loadWorkspaces}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  // -- Empty state --
  if (workspaces.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="mb-8 text-sm text-gray-500">{t.subtitle}</p>
        <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-20">
          <p className="text-gray-500">{t.empty}</p>
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

      {/* Responsive grid: 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((ws) => {
          const badge = TYPE_BADGES[ws.type] ?? TYPE_BADGES.standard;
          const icon = TYPE_ICONS[ws.type] ?? "\uD83D\uDCE6";
          const features = lang === "fr" ? ws.features_fr : ws.features;
          const name = lang === "fr" ? ws.name_fr : ws.name;
          const description = lang === "fr" ? ws.description_fr : ws.description;

          return (
            <motion.div
              key={ws.id}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : { y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }
              }
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              {/* Card header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-2xl"
                  aria-hidden="true"
                >
                  {icon}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}
                >
                  {lang === "fr" ? badge.label_fr : badge.label}
                </span>
              </div>

              {/* Card body */}
              <div className="flex flex-1 flex-col px-5 pb-5">
                <h3 className="mb-1 text-lg font-semibold text-gray-900">
                  {name}
                </h3>
                <p className="mb-4 text-sm text-gray-500">{description}</p>

                {/* Feature tags */}
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    {t.features}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {features.map((feat, idx) => (
                      <motion.span
                        key={idx}
                        className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                        whileHover={
                          prefersReducedMotion
                            ? undefined
                            : {
                                backgroundImage:
                                  "linear-gradient(110deg, transparent 30%, rgba(59,130,246,0.08) 50%, transparent 70%)",
                                backgroundSize: "200% 100%",
                                backgroundPosition: ["100% 0%", "0% 0%"],
                              }
                        }
                        transition={{ duration: 0.6 }}
                      >
                        {feat}
                      </motion.span>
                    ))}
                  </div>
                </div>

                {/* Capacity + Price */}
                <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-xs text-gray-500">{t.capacity}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {ws.capacity} {t.users}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{t.pricePerWeek}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      ${ws.pricePerWeek.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Book button */}
                <button
                  type="button"
                  onClick={() => handleBook(ws)}
                  className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={`${t.book}: ${name}`}
                >
                  {t.book}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Booking dialog */}
      {selectedWorkspace && (
        <BookingDialog
          workspace={selectedWorkspace}
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          lang={lang}
        />
      )}
    </div>
  );
}
