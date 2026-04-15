// ---------------------------------------------------------------------------
// LiveOps Command Center — service health, queues, capacity, incidents
// ---------------------------------------------------------------------------

import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';

type Lang = 'en' | 'fr';

const T = {
  en: {
    title: 'LiveOps Command Center',
    serviceHealth: 'Service Health Grid',
    service: 'Service',
    latencyP99: 'Latency p99',
    errorRate: 'Error Rate',
    lastChecked: 'Last Checked',
    queueMonitoring: 'Queue Monitoring',
    queueName: 'Queue Name',
    depth: 'Depth',
    processingRate: 'Avg Processing',
    backlogAge: 'Backlog Age',
    status: 'Status',
    workspaceUtilization: 'Workspace Utilization',
    activeBookings: 'active bookings',
    capacity: 'capacity',
    incidentTimeline: 'Incident Timeline',
    noIncidents: 'No incidents in the current period. All systems operational.',
    uptime: 'Uptime',
    slaTarget: 'SLA Target',
    incidentsMtd: 'Incidents (MTD)',
    totalDocuments: 'Total Documents',
    totalChunks: 'Total Chunks',
    activeWorkspaces: 'Active Workspaces',
  },
  fr: {
    title: 'Centre de commande LiveOps',
    serviceHealth: 'Grille de sante des services',
    service: 'Service',
    latencyP99: 'Latence p99',
    errorRate: 'Taux d\'erreur',
    lastChecked: 'Derniere verification',
    queueMonitoring: 'Surveillance des files d\'attente',
    queueName: 'Nom de la file',
    depth: 'Profondeur',
    processingRate: 'Traitement moyen',
    backlogAge: 'Age du retard',
    status: 'Statut',
    workspaceUtilization: 'Utilisation des espaces de travail',
    activeBookings: 'reservations actives',
    capacity: 'capacite',
    incidentTimeline: 'Chronologie des incidents',
    noIncidents: 'Aucun incident dans la periode en cours. Tous les systemes sont operationnels.',
    uptime: 'Disponibilite',
    slaTarget: 'Cible SLA',
    incidentsMtd: 'Incidents (mois en cours)',
    totalDocuments: 'Total des documents',
    totalChunks: 'Total des segments',
    activeWorkspaces: 'Espaces actifs',
  },
};

// ---------------------------------------------------------------------------
// Mock data (matches ops.py endpoints)
// ---------------------------------------------------------------------------

interface ServiceInfo {
  key: string;
  label: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_p99_ms: number;
  error_rate_pct: number;
  note?: string;
}

const SERVICES: ServiceInfo[] = [
  { key: 'api_gateway', label: 'API Gateway', status: 'healthy', latency_p99_ms: 45, error_rate_pct: 0.02 },
  { key: 'agent_orchestrator', label: 'Agent Orchestrator', status: 'healthy', latency_p99_ms: 1200, error_rate_pct: 0.1 },
  { key: 'ai_search', label: 'AI Search', status: 'healthy', latency_p99_ms: 180, error_rate_pct: 0.05 },
  { key: 'document_intelligence', label: 'Document Intelligence', status: 'healthy', latency_p99_ms: 3500, error_rate_pct: 0.08 },
  { key: 'azure_openai', label: 'Azure OpenAI', status: 'healthy', latency_p99_ms: 800, error_rate_pct: 0.1 },
  { key: 'cosmos_db', label: 'Cosmos DB', status: 'healthy', latency_p99_ms: 12, error_rate_pct: 0.0 },
  { key: 'redis_cache', label: 'Redis Cache', status: 'healthy', latency_p99_ms: 2, error_rate_pct: 0.0 },
  { key: 'service_bus', label: 'Service Bus', status: 'degraded', latency_p99_ms: 450, error_rate_pct: 0.3, note: 'Queue depth elevated' },
];

interface QueueRow {
  name: string;
  depth: number;
  maxDepth: number;
  avgProcessingMs: number;
  backlogAge: string;
  status: 'healthy' | 'degraded' | 'warning';
}

const QUEUES: QueueRow[] = [
  { name: 'document_ingestion', depth: 12, maxDepth: 1000, avgProcessingMs: 45000, backlogAge: '3m', status: 'healthy' },
  { name: 'embedding_generation', depth: 3, maxDepth: 500, avgProcessingMs: 8000, backlogAge: '24s', status: 'healthy' },
  { name: 'chat_requests', depth: 0, maxDepth: 100, avgProcessingMs: 2500, backlogAge: '-', status: 'healthy' },
];

interface WorkspaceCapacity {
  type: string;
  active: number;
  capacity: number;
}

const WORKSPACE_CAPACITY: WorkspaceCapacity[] = [
  { type: 'Legislation RAG', active: 1, capacity: 10 },
  { type: 'Jurisprudence RAG', active: 1, capacity: 5 },
  { type: 'General FAQ', active: 1, capacity: 20 },
  { type: 'Data Analytics', active: 0, capacity: 5 },
  { type: 'Custom RAG', active: 0, capacity: 10 },
];

interface Incident {
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  resolved: boolean;
}

const INCIDENTS: Incident[] = [
  {
    timestamp: '2026-04-14T11:42:00Z',
    severity: 'warning',
    title: 'Service Bus queue depth elevated',
    description: 'document_ingestion queue depth reached 12 messages. Auto-scaling engaged.',
    resolved: false,
  },
  {
    timestamp: '2026-04-12T08:15:00Z',
    severity: 'info',
    title: 'Scheduled maintenance completed',
    description: 'AI Search index optimization completed successfully. No downtime.',
    resolved: true,
  },
  {
    timestamp: '2026-04-07T14:30:00Z',
    severity: 'critical',
    title: 'Azure OpenAI throttling',
    description: 'Rate limit exceeded for gpt-5.1 deployment. Requests routed to gpt-5-mini fallback. Resolved in 8 minutes.',
    resolved: true,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LiveOpsHealth({ lang }: { lang: Lang }) {
  const t = T[lang];
  const checkedAt = '2026-04-14T12:00:00Z';
  const checkedDisplay = new Date(checkedAt).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6" role="region" aria-label={t.title}>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">{t.title}</h2>

      {/* KPI Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={t.uptime} value="99.95%" trend={{ direction: 'up', percentage: 0.02 }} color="#059669" />
        <MetricCard label={t.slaTarget} value="99.90%" color="#2563eb" />
        <MetricCard label={t.incidentsMtd} value={0} color="#059669" />
        <MetricCard label={t.activeWorkspaces} value="3 / 50" color="#7c3aed" />
      </div>

      {/* Service Health Grid */}
      <section className="mb-8" aria-label={t.serviceHealth}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.serviceHealth}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((svc) => (
            <div
              key={svc.key}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{svc.label}</span>
                <StatusBadge
                  status={svc.status}
                  pulse={svc.status !== 'healthy'}
                />
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>{t.latencyP99}</span>
                  <span className="font-medium text-gray-700">{svc.latency_p99_ms}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.errorRate}</span>
                  <span className={`font-medium ${svc.error_rate_pct > 0.1 ? 'text-amber-600' : 'text-gray-700'}`}>
                    {svc.error_rate_pct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t.lastChecked}</span>
                  <span className="text-gray-400">{checkedDisplay}</span>
                </div>
              </div>
              {svc.note && (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{svc.note}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Queue Monitoring */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.queueMonitoring}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.queueMonitoring}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.queueName}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.depth}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.processingRate}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.backlogAge}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {QUEUES.map((q) => (
                <tr key={q.name} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
                      {q.name}
                    </code>
                  </td>
                  <td className="py-2.5 text-right text-gray-700">
                    {q.depth} / {q.maxDepth}
                  </td>
                  <td className="py-2.5 text-right text-gray-700">
                    {q.avgProcessingMs >= 1000
                      ? `${(q.avgProcessingMs / 1000).toFixed(1)}s`
                      : `${q.avgProcessingMs}ms`}
                  </td>
                  <td className="py-2.5 text-right text-gray-600">{q.backlogAge}</td>
                  <td className="py-2.5 text-right">
                    <StatusBadge status={q.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Workspace Utilization */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.workspaceUtilization}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.workspaceUtilization}
        </h3>
        <div className="space-y-3">
          {WORKSPACE_CAPACITY.map((ws) => {
            const pct = ws.capacity > 0 ? (ws.active / ws.capacity) * 100 : 0;
            return (
              <div key={ws.type}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{ws.type}</span>
                  <span className="text-xs text-gray-500">
                    {ws.active} {t.activeBookings} / {ws.capacity} {t.capacity}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200" role="progressbar" aria-valuenow={ws.active} aria-valuemin={0} aria-valuemax={ws.capacity} aria-label={`${ws.type}: ${ws.active}/${ws.capacity}`}>
                  <div
                    className={`h-2 rounded-full transition-all ${
                      pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Incident Timeline */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.incidentTimeline}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.incidentTimeline}
        </h3>
        {INCIDENTS.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noIncidents}</p>
        ) : (
          <div className="relative space-y-4 pl-6">
            {/* Timeline line */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" aria-hidden="true" />

            {INCIDENTS.map((incident, idx) => {
              const severityColors: Record<string, string> = {
                info: 'bg-blue-500',
                warning: 'bg-amber-500',
                critical: 'bg-red-500',
              };
              return (
                <div key={idx} className="relative">
                  {/* Dot on timeline */}
                  <div
                    className={`absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-white ${severityColors[incident.severity]}`}
                    aria-hidden="true"
                  />
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400">
                        {new Date(incident.timestamp).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                      </span>
                      <StatusBadge
                        status={
                          incident.severity === 'critical'
                            ? 'down'
                            : incident.severity === 'warning'
                              ? 'warning'
                              : 'healthy'
                        }
                        label={incident.severity}
                      />
                      {incident.resolved && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{incident.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{incident.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
