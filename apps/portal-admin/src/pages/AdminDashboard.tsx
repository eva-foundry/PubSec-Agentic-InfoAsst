// ---------------------------------------------------------------------------
// AdminDashboard — Client overview, KPIs, booking approval queue
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonCard } from '@eva/ui-kit';
import {
  listClients,
  listAllBookings,
  listWorkspaces,
  approveBooking,
  rejectBooking,
  type Client,
  type Booking,
} from '../api/client';

type Lang = 'en' | 'fr';

interface Props {
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

const S = {
  en: {
    title: 'Admin Dashboard',
    subtitle: 'Client overview, booking approvals, and key metrics',
    loading: 'Loading dashboard...',
    error: 'Failed to load data',
    retry: 'Retry',
    // KPI cards
    totalClients: 'Total Clients',
    activeWorkspaces: 'Active Workspaces',
    pendingBookings: 'Pending Bookings',
    totalRevenue: 'Monthly Revenue',
    // Client table
    clients: 'Clients',
    orgName: 'Organization',
    status: 'Status',
    workspaces: 'Workspaces',
    queries: 'Queries',
    documents: 'Documents',
    lastActive: 'Last Active',
    never: 'Never',
    active: 'Active',
    onboarding: 'Onboarding',
    suspended: 'Suspended',
    archived: 'Archived',
    // Client detail
    clientDetail: 'Client Detail',
    billingEmail: 'Billing Email',
    entraGroup: 'Entra ID Group',
    classification: 'Classification',
    created: 'Created',
    close: 'Close',
    // Booking queue
    bookingQueue: 'Booking Approval Queue',
    workspace: 'Workspace',
    requester: 'Requester',
    dates: 'Dates',
    approve: 'Approve',
    reject: 'Reject',
    rejectReason: 'Rejection reason',
    noBookings: 'No pending bookings.',
    approving: 'Approving...',
    rejecting: 'Rejecting...',
  },
  fr: {
    title: 'Tableau de bord administrateur',
    subtitle: 'Apercu des clients, approbations et metriques cles',
    loading: 'Chargement du tableau de bord...',
    error: 'Echec du chargement des donnees',
    retry: 'Reessayer',
    totalClients: 'Total clients',
    activeWorkspaces: 'Espaces actifs',
    pendingBookings: 'Reservations en attente',
    totalRevenue: 'Revenu mensuel',
    clients: 'Clients',
    orgName: 'Organisation',
    status: 'Statut',
    workspaces: 'Espaces',
    queries: 'Requetes',
    documents: 'Documents',
    lastActive: 'Derniere activite',
    never: 'Jamais',
    active: 'Actif',
    onboarding: 'Integration',
    suspended: 'Suspendu',
    archived: 'Archive',
    clientDetail: 'Detail du client',
    billingEmail: 'Courriel de facturation',
    entraGroup: 'Groupe Entra ID',
    classification: 'Classification',
    created: 'Cree',
    close: 'Fermer',
    bookingQueue: 'File d\'approbation des reservations',
    workspace: 'Espace de travail',
    requester: 'Demandeur',
    dates: 'Dates',
    approve: 'Approuver',
    reject: 'Rejeter',
    rejectReason: 'Raison du rejet',
    noBookings: 'Aucune reservation en attente.',
    approving: 'Approbation...',
    rejecting: 'Rejet...',
  },
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  onboarding: 'bg-blue-100 text-blue-800',
  suspended: 'bg-amber-100 text-amber-800',
  archived: 'bg-gray-100 text-gray-500',
};

// ---------------------------------------------------------------------------
// Count-up animation hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  prefix = '',
  suffix = '',
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const displayed = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-gray-200 bg-white p-5"
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
        {prefix}{displayed.toLocaleString()}{suffix}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDashboard({ lang }: Props) {
  const t = S[lang];

  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail panel
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Booking actions
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsData, bookingsData, wsData] = await Promise.all([
        listClients(),
        listAllBookings(),
        listWorkspaces(),
      ]);
      setClients(clientsData);
      setBookings(bookingsData);
      setWorkspaceCount(wsData.filter((w) => w.status === 'ready').length);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Computed KPIs
  const totalClients = clients.length;
  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const totalRevenue = clients.reduce((sum, c) => sum + c.workspaces_count * 250, 0); // simplified

  const handleApprove = async (id: string) => {
    setActionInProgress(id);
    try {
      await approveBooking(id);
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'confirmed' as const } : b)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionInProgress(id);
    try {
      await rejectBooking(id, rejectReason);
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b)),
      );
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setActionInProgress(null);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: t.active,
      onboarding: t.onboarding,
      suspended: t.suspended,
      archived: t.archived,
    };
    return map[s] ?? s;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label={t.totalClients} value={totalClients} />
        <KPICard label={t.activeWorkspaces} value={workspaceCount} />
        <KPICard label={t.pendingBookings} value={pendingBookings.length} />
        <KPICard label={t.totalRevenue} value={totalRevenue} prefix="$" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Client table (2/3 width) */}
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">{t.clients}</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t.orgName}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t.status}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t.workspaces}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t.queries}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t.documents}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t.lastActive}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className={`cursor-pointer transition-colors ${
                      selectedClient?.id === client.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedClient(client); }}
                    role="button"
                    aria-label={`${t.clientDetail}: ${client.org_name}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{client.org_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[client.status] ?? ''}`}>
                        {statusLabel(client.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{client.workspaces_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{client.query_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{client.document_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {client.last_active
                        ? new Date(client.last_active).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')
                        : t.never}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: client detail or booking queue */}
        <div className="space-y-6">
          {/* Client detail panel */}
          <AnimatePresence>
            {selectedClient && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">{t.clientDetail}</h4>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(null)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={t.close}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500">{t.orgName}</dt>
                    <dd className="text-gray-900">{selectedClient.org_name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">{t.billingEmail}</dt>
                    <dd className="text-gray-900">{selectedClient.billing_contact_email}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">{t.entraGroup}</dt>
                    <dd className="text-gray-900">{selectedClient.entra_id_group}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">{t.classification}</dt>
                    <dd className="text-gray-900">{selectedClient.data_classification}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">{t.created}</dt>
                    <dd className="text-gray-900">
                      {new Date(selectedClient.created_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">{selectedClient.workspaces_count}</p>
                      <p className="text-xs text-gray-500">{t.workspaces}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">{selectedClient.query_count.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{t.queries}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">{selectedClient.document_count.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{t.documents}</p>
                    </div>
                  </div>
                </dl>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Booking approval queue */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">{t.bookingQueue}</h4>
            {pendingBookings.length === 0 ? (
              <p className="text-sm text-gray-400">{t.noBookings}</p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="rounded-md border border-gray-100 p-3"
                  >
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-900">{booking.workspace_name}</p>
                      <p className="text-xs text-gray-500">
                        {booking.requester_name} ({booking.requester_email})
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(booking.start_date).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                        {' - '}
                        {new Date(booking.end_date).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                      </p>
                    </div>

                    {rejectingId === booking.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t.rejectReason}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          aria-label={t.rejectReason}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReject(booking.id)}
                            disabled={actionInProgress === booking.id || !rejectReason.trim()}
                            className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionInProgress === booking.id ? t.rejecting : t.reject}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            {S[lang].close}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(booking.id)}
                          disabled={actionInProgress === booking.id}
                          className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionInProgress === booking.id ? t.approving : t.approve}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(booking.id)}
                          className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          {t.reject}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
