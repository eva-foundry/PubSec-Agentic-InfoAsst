// ---------------------------------------------------------------------------
// TeamManagementDialog — RBAC team management per booking
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { TeamMember, TeamRole } from "@eva/common";
import { getTeamMembers, addTeamMember, removeTeamMember } from "../api/client";

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    title: "Team Management",
    subtitle: "Add team members and assign roles for workspace access",
    addMember: "Add Team Member",
    name: "Name",
    namePlaceholder: "Jane Doe",
    email: "Email",
    emailPlaceholder: "jane.doe@gc.ca",
    role: "Role",
    addButton: "Add Member",
    currentTeam: "Current Team",
    emptyTeam:
      "No team members yet. Add members to collaborate on this workspace.",
    remove: "Remove",
    done: "Done",
    rolePermissions: "Role Permissions",
    reader: "Reader",
    contributor: "Contributor",
    admin: "Admin",
    readerDesc: "View-only access to workspace and documents",
    contributorDesc: "Upload and manage documents, run queries",
    adminDesc: "Full access including team management and configuration",
    fillFields: "Please fill in name and email",
    addError: "Failed to add team member",
    removeError: "Failed to remove team member",
    loading: "Loading team...",
  },
  fr: {
    title: "Gestion de l'equipe",
    subtitle:
      "Ajoutez des membres et attribuez des roles pour l'acces a l'espace",
    addMember: "Ajouter un membre",
    name: "Nom",
    namePlaceholder: "Jeanne Dupont",
    email: "Courriel",
    emailPlaceholder: "jeanne.dupont@gc.ca",
    role: "Role",
    addButton: "Ajouter",
    currentTeam: "Equipe actuelle",
    emptyTeam:
      "Aucun membre. Ajoutez des membres pour collaborer sur cet espace.",
    remove: "Retirer",
    done: "Termine",
    rolePermissions: "Permissions des roles",
    reader: "Lecteur",
    contributor: "Contributeur",
    admin: "Administrateur",
    readerDesc: "Acces en lecture seule a l'espace et aux documents",
    contributorDesc: "Televersement et gestion des documents, execution de requetes",
    adminDesc:
      "Acces complet incluant la gestion de l'equipe et la configuration",
    fillFields: "Veuillez remplir le nom et le courriel",
    addError: "Impossible d'ajouter le membre",
    removeError: "Impossible de retirer le membre",
    loading: "Chargement de l'equipe...",
  },
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  reader: "bg-gray-100 text-gray-700",
  contributor: "bg-blue-100 text-blue-700",
  admin: "bg-purple-100 text-purple-700",
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

interface TeamManagementDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamManagementDialog({
  bookingId,
  open,
  onOpenChange,
  lang,
}: TeamManagementDialogProps) {
  const t = strings[lang];
  const prefersReducedMotion = useReducedMotion();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<TeamRole>("reader");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeamMembers(bookingId);
      setMembers(data);
    } catch {
      // silently fail, team list may just be empty
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open, loadMembers]);

  const handleAdd = useCallback(async () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      setErrorMsg(t.fillFields);
      setShakeKey((k) => k + 1);
      return;
    }
    setErrorMsg(null);
    try {
      const added = await addTeamMember(bookingId, {
        name: memberName.trim(),
        email: memberEmail.trim(),
        role: memberRole,
      });
      setMembers((prev) => [...prev, added]);
      setMemberName("");
      setMemberEmail("");
      setMemberRole("reader");
    } catch {
      setErrorMsg(t.addError);
      setShakeKey((k) => k + 1);
    }
  }, [bookingId, memberName, memberEmail, memberRole, t]);

  const handleRemove = useCallback(
    async (userId: string) => {
      try {
        await removeTeamMember(bookingId, userId);
        setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      } catch {
        setErrorMsg(t.removeError);
      }
    },
    [bookingId, t],
  );

  const roleLabel = (role: string) => {
    const key = role as keyof typeof t;
    return t[key] ?? role;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="team-overlay"
            variants={prefersReducedMotion ? undefined : overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            key="team-dialog"
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

                {/* Add member form */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900">{t.addMember}</h3>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="tm-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.name}
                    </label>
                    <input
                      id="tm-name"
                      type="text"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="tm-email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.email}
                    </label>
                    <input
                      id="tm-email"
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="tm-role"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t.role}
                    </label>
                    <select
                      id="tm-role"
                      value={memberRole}
                      onChange={(e) =>
                        setMemberRole(e.target.value as TeamRole)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="reader">{t.reader}</option>
                      <option value="contributor">{t.contributor}</option>
                      <option value="admin">{t.admin}</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      {memberRole === "reader"
                        ? t.readerDesc
                        : memberRole === "contributor"
                          ? t.contributorDesc
                          : t.adminDesc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAdd}
                    className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {t.addButton}
                  </button>
                </div>

                {/* Current team */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">
                    {t.currentTeam} ({members.length})
                  </h3>

                  {loading ? (
                    <p className="text-sm text-gray-500">{t.loading}</p>
                  ) : members.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                      <p className="text-sm text-gray-500">{t.emptyTeam}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {members.map((member) => (
                          <motion.div
                            key={member.id}
                            initial={
                              prefersReducedMotion
                                ? undefined
                                : { opacity: 0, height: 0 }
                            }
                            animate={{ opacity: 1, height: "auto" }}
                            exit={
                              prefersReducedMotion
                                ? undefined
                                : { opacity: 0, height: 0 }
                            }
                            className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {member.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.email}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  ROLE_BADGE_STYLES[member.role] ??
                                  ROLE_BADGE_STYLES.reader
                                }`}
                              >
                                {roleLabel(member.role)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemove(member.user_id)}
                                className="rounded p-1 text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                                aria-label={`${t.remove} ${member.name}`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Role permissions reference */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">
                    {t.rolePermissions}
                  </h4>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p>
                      <strong>{t.reader}:</strong> {t.readerDesc}
                    </p>
                    <p>
                      <strong>{t.contributor}:</strong> {t.contributorDesc}
                    </p>
                    <p>
                      <strong>{t.admin}:</strong> {t.adminDesc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {t.done}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
