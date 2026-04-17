// ---------------------------------------------------------------------------
// DevOps Command Center — deployments, CI/CD, drift, container health
// ---------------------------------------------------------------------------

import { StatusBadge } from '../components/StatusBadge';

type Lang = 'en' | 'fr';

const T = {
  en: {
    title: 'DevOps Command Center',
    deploymentHistory: 'Deployment History',
    component: 'Component',
    version: 'Version',
    status: 'Status',
    deployedBy: 'Deployed By',
    timestamp: 'Timestamp',
    environment: 'Environment',
    cicdPipelines: 'CI/CD Pipeline Status',
    branch: 'Branch',
    buildId: 'Build',
    tests: 'Tests',
    lint: 'Lint',
    result: 'Result',
    duration: 'Duration',
    driftAlerts: 'Infrastructure Drift Alerts',
    noDrift: 'No drift detected. All infrastructure matches declared state.',
    containerHealth: 'Container Health',
    revision: 'Revision',
    image: 'Image',
    replicas: 'Replicas',
    cpu: 'CPU',
    memory: 'Memory',
    currentVersions: 'Current Versions',
    lastDeployed: 'Last Deployed',
    production: 'Production',
  },
  fr: {
    title: 'Centre de commande DevOps',
    deploymentHistory: 'Historique des deploiements',
    component: 'Composant',
    version: 'Version',
    status: 'Statut',
    deployedBy: 'Deploye par',
    timestamp: 'Horodatage',
    environment: 'Environnement',
    cicdPipelines: 'Statut des pipelines CI/CD',
    branch: 'Branche',
    buildId: 'Build',
    tests: 'Tests',
    lint: 'Lint',
    result: 'Resultat',
    duration: 'Duree',
    driftAlerts: 'Alertes de derive d\'infrastructure',
    noDrift: 'Aucune derive detectee. Toute l\'infrastructure correspond a l\'etat declare.',
    containerHealth: 'Sante des conteneurs',
    revision: 'Revision',
    image: 'Image',
    replicas: 'Repliques',
    cpu: 'CPU',
    memory: 'Memoire',
    currentVersions: 'Versions actuelles',
    lastDeployed: 'Dernier deploiement',
    production: 'Production',
  },
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Deployment {
  component: string;
  version: string;
  environment: string;
  status: 'success' | 'failed' | 'rolled-back';
  deployed_by: string;
  deployed_at: string;
}

const DEPLOYMENTS: Deployment[] = [
  { component: 'api-gateway', version: '0.1.0', environment: 'Production', status: 'success', deployed_by: 'ci-pipeline', deployed_at: '2026-04-14T08:00:00Z' },
  { component: 'prompt-version', version: 'v3.2', environment: 'Production', status: 'success', deployed_by: 'demo-dave', deployed_at: '2026-04-01T10:00:00Z' },
  { component: 'guardrail-rules', version: 'v1.4', environment: 'Production', status: 'success', deployed_by: 'ci-pipeline', deployed_at: '2026-03-28T14:30:00Z' },
  { component: 'agent-orchestrator', version: '0.1.0', environment: 'Production', status: 'success', deployed_by: 'ci-pipeline', deployed_at: '2026-03-25T09:15:00Z' },
  { component: 'ingestion-pipeline', version: '0.1.0', environment: 'Staging', status: 'failed', deployed_by: 'ci-pipeline', deployed_at: '2026-03-24T16:45:00Z' },
  { component: 'ingestion-pipeline', version: '0.0.9', environment: 'Production', status: 'rolled-back', deployed_by: 'ops-sarah', deployed_at: '2026-03-22T11:00:00Z' },
];

interface PipelineRun {
  buildId: string;
  branch: string;
  tests: { passed: number; failed: number; skipped: number };
  lint: 'pass' | 'fail';
  result: 'success' | 'failed';
  duration: string;
  timestamp: string;
}

const PIPELINE_RUNS: PipelineRun[] = [
  { buildId: '#247', branch: 'main', tests: { passed: 142, failed: 0, skipped: 3 }, lint: 'pass', result: 'success', duration: '4m 12s', timestamp: '2026-04-14T07:55:00Z' },
  { buildId: '#246', branch: 'feat/prompt-v3.2', tests: { passed: 140, failed: 0, skipped: 3 }, lint: 'pass', result: 'success', duration: '4m 08s', timestamp: '2026-04-13T16:30:00Z' },
  { buildId: '#245', branch: 'main', tests: { passed: 139, failed: 0, skipped: 3 }, lint: 'pass', result: 'success', duration: '3m 58s', timestamp: '2026-04-12T08:10:00Z' },
  { buildId: '#244', branch: 'fix/search-timeout', tests: { passed: 138, failed: 1, skipped: 3 }, lint: 'pass', result: 'failed', duration: '4m 22s', timestamp: '2026-04-11T14:20:00Z' },
  { buildId: '#243', branch: 'main', tests: { passed: 138, failed: 0, skipped: 3 }, lint: 'pass', result: 'success', duration: '3m 45s', timestamp: '2026-04-10T09:00:00Z' },
  { buildId: '#242', branch: 'feat/corpus-health', tests: { passed: 137, failed: 0, skipped: 4 }, lint: 'pass', result: 'success', duration: '3m 52s', timestamp: '2026-04-09T11:15:00Z' },
  { buildId: '#241', branch: 'main', tests: { passed: 136, failed: 0, skipped: 4 }, lint: 'pass', result: 'success', duration: '3m 40s', timestamp: '2026-04-08T08:05:00Z' },
  { buildId: '#240', branch: 'chore/deps-update', tests: { passed: 136, failed: 0, skipped: 4 }, lint: 'fail', result: 'failed', duration: '2m 15s', timestamp: '2026-04-07T15:30:00Z' },
  { buildId: '#239', branch: 'main', tests: { passed: 135, failed: 0, skipped: 4 }, lint: 'pass', result: 'success', duration: '3m 38s', timestamp: '2026-04-06T09:00:00Z' },
  { buildId: '#238', branch: 'feat/finops-headers', tests: { passed: 134, failed: 0, skipped: 4 }, lint: 'pass', result: 'success', duration: '3m 50s', timestamp: '2026-04-05T13:45:00Z' },
];

interface ContainerRevision {
  component: string;
  revision: string;
  image: string;
  replicas: string;
  cpu: string;
  memory: string;
  status: 'healthy' | 'degraded' | 'down';
}

const CONTAINER_REVISIONS: ContainerRevision[] = [
  { component: 'api-gateway', revision: 'rev-3', image: 'eva-api:0.1.0', replicas: '2/2', cpu: '12%', memory: '256 MB', status: 'healthy' },
  { component: 'agent-orchestrator', revision: 'rev-2', image: 'eva-agent:0.1.0', replicas: '3/3', cpu: '34%', memory: '512 MB', status: 'healthy' },
  { component: 'ingestion-pipeline', revision: 'rev-4', image: 'eva-ingest:0.1.0', replicas: '1/1', cpu: '8%', memory: '384 MB', status: 'healthy' },
];

const CURRENT_VERSIONS: Array<{ component: string; version: string }> = [
  { component: 'api-gateway', version: '0.1.0' },
  { component: 'agent-orchestrator', version: '0.1.0' },
  { component: 'ingestion-pipeline', version: '0.1.0' },
  { component: 'prompt-version', version: 'v3.2' },
  { component: 'guardrail-rules', version: 'v1.4' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DevOpsPipelines({ lang }: { lang: Lang }) {
  const t = T[lang];
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6" role="region" aria-label={t.title}>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">{t.title}</h2>

      {/* Current Versions summary */}
      <section className="mb-8" aria-label={t.currentVersions}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.currentVersions} ({t.production})
        </h3>
        <div className="flex flex-wrap gap-3">
          {CURRENT_VERSIONS.map((cv) => (
            <div key={cv.component} className="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
              <span className="text-xs text-gray-500">{cv.component}</span>
              <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {cv.version}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Deployment History */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.deploymentHistory}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.deploymentHistory}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.environment}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.component}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.version}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.status}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.deployedBy}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.timestamp}</th>
              </tr>
            </thead>
            <tbody>
              {DEPLOYMENTS.map((d, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 text-gray-700">{d.environment}</td>
                  <td className="py-2.5">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">{d.component}</code>
                  </td>
                  <td className="py-2.5 font-medium text-gray-900">{d.version}</td>
                  <td className="py-2.5">
                    <StatusBadge
                      status={d.status === 'rolled-back' ? 'warning' : d.status}
                      label={d.status}
                    />
                  </td>
                  <td className="py-2.5 text-gray-600">{d.deployed_by}</td>
                  <td className="py-2.5 text-xs text-gray-500">
                    {new Date(d.deployed_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CI/CD Pipeline Status */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.cicdPipelines}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.cicdPipelines}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.buildId}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.branch}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.tests}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.lint}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.result}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.duration}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.timestamp}</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE_RUNS.map((run) => (
                <tr key={run.buildId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-blue-700">{run.buildId}</td>
                  <td className="py-2.5">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">{run.branch}</code>
                  </td>
                  <td className="py-2.5 text-xs">
                    <span className="text-green-700">{run.tests.passed} passed</span>
                    {run.tests.failed > 0 && (
                      <span className="ml-1 text-red-600">{run.tests.failed} failed</span>
                    )}
                    {run.tests.skipped > 0 && (
                      <span className="ml-1 text-gray-400">{run.tests.skipped} skipped</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <StatusBadge
                      status={run.lint === 'pass' ? 'success' : 'failed'}
                      label={run.lint}
                    />
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={run.result} label={run.result} />
                  </td>
                  <td className="py-2.5 text-gray-600">{run.duration}</td>
                  <td className="py-2.5 text-xs text-gray-500">
                    {new Date(run.timestamp).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Infrastructure Drift */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.driftAlerts}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.driftAlerts}
        </h3>
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <StatusBadge status="healthy" label="OK" />
          <p className="text-sm text-green-800">{t.noDrift}</p>
        </div>
      </section>

      {/* Container Health */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.containerHealth}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.containerHealth}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.component}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.revision}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.image}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.replicas}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.cpu}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.memory}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {CONTAINER_REVISIONS.map((c) => (
                <tr key={c.component} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-900">{c.component}</td>
                  <td className="py-2.5 text-gray-600">{c.revision}</td>
                  <td className="py-2.5">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">{c.image}</code>
                  </td>
                  <td className="py-2.5 text-right text-gray-700">{c.replicas}</td>
                  <td className="py-2.5 text-right text-gray-700">{c.cpu}</td>
                  <td className="py-2.5 text-right text-gray-700">{c.memory}</td>
                  <td className="py-2.5 text-right">
                    <StatusBadge status={c.status} pulse={c.status !== 'healthy'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
