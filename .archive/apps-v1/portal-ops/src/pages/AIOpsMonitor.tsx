// ---------------------------------------------------------------------------
// AIOps Command Center — RAG quality, agent traces, evaluation arena,
// confidence calibration, source quality, corpus health, feedback analytics
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';

type Lang = 'en' | 'fr';

const T = {
  en: {
    title: 'AIOps Command Center',
    ragQuality: 'RAG Quality Metrics',
    groundedness: 'Groundedness',
    relevance: 'Relevance',
    coherence: 'Coherence',
    citationAccuracy: 'Citation Accuracy',
    agentTraces: 'Agent Trace Explorer',
    searchPlaceholder: 'Search by conversation ID...',
    traceId: 'Trace ID',
    model: 'Model',
    duration: 'Duration',
    step: 'Step',
    tool: 'Tool',
    status: 'Status',
    durationMs: 'Duration (ms)',
    evaluationArena: 'Evaluation Arena — Model Elo Leaderboard',
    elo: 'Elo Rating',
    winRate: 'Win Rate',
    avgGroundedness: 'Avg Groundedness',
    archetype: 'Archetype',
    matchesPlayed: 'Matches',
    confidenceCalibration: 'Confidence Calibration Heatmap',
    predicted: 'Predicted Confidence',
    actualAccuracy: 'Actual Accuracy',
    sourceQuality: 'Source Quality',
    corpus: 'Corpus',
    acceptanceRate: 'Acceptance Rate',
    correctionRate: 'Correction Rate',
    qualityScore: 'Quality Score',
    sampleSize: 'Sample Size',
    corpusHealth: 'Corpus Health',
    indexName: 'Index',
    docCount: 'Documents',
    chunkCount: 'Chunks',
    lastRefreshed: 'Last Refreshed',
    staleness: 'Staleness',
    feedbackAnalytics: 'Feedback Analytics',
    correctionPatterns: 'Correction Patterns',
    contentGaps: 'Content Gaps',
    pattern: 'Pattern',
    count: 'Count',
    topic: 'Topic',
    queryCount: 'Query Count',
    avgConfidence: 'Avg Confidence',
    noTraceSelected: 'Enter a conversation ID above to explore agent traces.',
    totalComparisons: 'Total Comparisons',
    fresh: 'Fresh',
    aging: 'Aging',
    stale: 'Stale',
  },
  fr: {
    title: 'Centre de commande AIOps',
    ragQuality: 'Metriques de qualite RAG',
    groundedness: 'Ancrage',
    relevance: 'Pertinence',
    coherence: 'Coherence',
    citationAccuracy: 'Precision des citations',
    agentTraces: 'Explorateur de traces d\'agent',
    searchPlaceholder: 'Rechercher par ID de conversation...',
    traceId: 'ID de trace',
    model: 'Modele',
    duration: 'Duree',
    step: 'Etape',
    tool: 'Outil',
    status: 'Statut',
    durationMs: 'Duree (ms)',
    evaluationArena: 'Arene d\'evaluation — Classement Elo des modeles',
    elo: 'Classement Elo',
    winRate: 'Taux de victoire',
    avgGroundedness: 'Ancrage moyen',
    archetype: 'Archetype',
    matchesPlayed: 'Matchs',
    confidenceCalibration: 'Carte thermique de calibration de confiance',
    predicted: 'Confiance predite',
    actualAccuracy: 'Precision reelle',
    sourceQuality: 'Qualite des sources',
    corpus: 'Corpus',
    acceptanceRate: 'Taux d\'acceptation',
    correctionRate: 'Taux de correction',
    qualityScore: 'Score de qualite',
    sampleSize: 'Taille d\'echantillon',
    corpusHealth: 'Sante du corpus',
    indexName: 'Index',
    docCount: 'Documents',
    chunkCount: 'Segments',
    lastRefreshed: 'Dernier rafraichissement',
    staleness: 'Fraicheur',
    feedbackAnalytics: 'Analytique des retours',
    correctionPatterns: 'Modeles de correction',
    contentGaps: 'Lacunes de contenu',
    pattern: 'Modele',
    count: 'Nombre',
    topic: 'Sujet',
    queryCount: 'Nombre de requetes',
    avgConfidence: 'Confiance moyenne',
    noTraceSelected: 'Entrez un ID de conversation ci-dessus pour explorer les traces d\'agent.',
    totalComparisons: 'Comparaisons totales',
    fresh: 'Frais',
    aging: 'Vieillissant',
    stale: 'Perime',
  },
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_TRACE = {
  conversation_id: 'conv-20260414-001',
  trace_id: 'otel-abc123def456',
  steps: [
    { id: 1, tool: 'planner', status: 'complete', duration_ms: 120, input_hash: 'a1b2', output_hash: 'c3d4' },
    { id: 2, tool: 'search', status: 'complete', duration_ms: 320, input_hash: 'e5f6', output_hash: 'g7h8', metadata: { sources_found: 5 } },
    { id: 3, tool: 'reranker', status: 'complete', duration_ms: 85, input_hash: 'i9j0', output_hash: 'k1l2', metadata: { sources_kept: 3 } },
    { id: 4, tool: 'answer', status: 'complete', duration_ms: 780, input_hash: 'm3n4', output_hash: 'o5p6' },
  ],
  total_duration_ms: 1305,
  model_used: 'gpt-5.1-2026-04',
};

const ELO_RANKINGS = [
  { model: 'gpt-5.1', archetype: 'Full reasoning', elo: 1285, win_rate_pct: 72.3, avg_groundedness: 0.93, matches_played: 340 },
  { model: 'gpt-5-mini', archetype: 'Fast response', elo: 1180, win_rate_pct: 58.1, avg_groundedness: 0.89, matches_played: 180 },
];

// Confidence calibration: rows = predicted bucket, columns = model
const CALIBRATION_DATA = [
  { bucket: '0.0-0.2', actual: 0.15 },
  { bucket: '0.2-0.4', actual: 0.31 },
  { bucket: '0.4-0.6', actual: 0.52 },
  { bucket: '0.6-0.8', actual: 0.71 },
  { bucket: '0.8-1.0', actual: 0.89 },
];

const SOURCE_QUALITY = [
  { corpus: 'EI Jurisprudence', acceptance_rate_pct: 94.2, correction_rate_pct: 3.1, quality_score: 0.91, sample_size: 1420 },
  { corpus: 'OAS Act', acceptance_rate_pct: 89.7, correction_rate_pct: 5.8, quality_score: 0.84, sample_size: 680 },
  { corpus: 'General FAQ', acceptance_rate_pct: 96.1, correction_rate_pct: 1.2, quality_score: 0.95, sample_size: 350 },
];

const CORPUS_HEALTH = [
  { name: 'ws-ei-juris', document_count: 1423, chunk_count: 38200, last_indexed_at: '2026-04-12T09:45:00Z', freshness_score: 0.99, stale_documents: 0 },
  { name: 'ws-oas-act', document_count: 87, chunk_count: 2450, last_indexed_at: '2026-04-10T14:35:00Z', freshness_score: 0.94, stale_documents: 2 },
  { name: 'ws-general-faq', document_count: 45, chunk_count: 1650, last_indexed_at: '2026-04-08T11:20:00Z', freshness_score: 0.82, stale_documents: 5 },
];

const CORRECTION_PATTERNS = [
  { pattern: 'Incorrect section reference', count: 12 },
  { pattern: 'Outdated regulation cited', count: 8 },
  { pattern: 'Missing bilingual equivalent', count: 5 },
  { pattern: 'Incomplete citation chain', count: 3 },
];

const CONTENT_GAPS = [
  { topic: 'CPP disability appeal process', query_count: 47, avg_confidence: 0.32 },
  { topic: 'EI parental sharing benefit 2026', query_count: 31, avg_confidence: 0.41 },
  { topic: 'OAS GIS calculation examples', query_count: 22, avg_confidence: 0.38 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFreshnessStatus(score: number): 'healthy' | 'degraded' | 'down' {
  if (score >= 0.95) return 'healthy';
  if (score >= 0.80) return 'degraded';
  return 'down';
}

function getFreshnessLabel(score: number, lang: Lang): string {
  const t = T[lang];
  if (score >= 0.95) return t.fresh;
  if (score >= 0.80) return t.aging;
  return t.stale;
}

function getCalibrationColor(predicted: string, actual: number): string {
  // Color based on calibration error (how close actual is to bucket midpoint)
  const mid = parseBucketMidpoint(predicted);
  const error = Math.abs(actual - mid);
  if (error < 0.05) return 'bg-green-500 text-white';
  if (error < 0.10) return 'bg-green-300';
  if (error < 0.15) return 'bg-amber-300';
  return 'bg-red-300';
}

function parseBucketMidpoint(bucket: string): number {
  const parts = bucket.split('-').map(Number);
  return (parts[0] + parts[1]) / 2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIOpsMonitor({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [showTrace, setShowTrace] = useState(false);

  const handleSearch = () => {
    if (searchQuery.trim()) setShowTrace(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6" role="region" aria-label={t.title}>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">{t.title}</h2>

      {/* RAG Quality KPI Cards */}
      <section className="mb-8" aria-label={t.ragQuality}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.ragQuality}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t.groundedness}
            value="91%"
            trend={{ direction: 'up', percentage: 2.1 }}
            color="#059669"
          />
          <MetricCard
            label={t.relevance}
            value="88%"
            trend={{ direction: 'down', percentage: 1.3 }}
            color="#2563eb"
          />
          <MetricCard
            label={t.coherence}
            value="94%"
            trend={{ direction: 'up', percentage: 0.8 }}
            color="#7c3aed"
          />
          <MetricCard
            label={t.citationAccuracy}
            value="96%"
            trend={{ direction: 'flat', percentage: 0.2 }}
            color="#0891b2"
          />
        </div>
      </section>

      {/* Agent Trace Explorer */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.agentTraces}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.agentTraces}
        </h3>
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t.searchPlaceholder}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label={t.searchPlaceholder}
          />
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Search
          </button>
        </div>

        {showTrace ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span><strong>{t.traceId}:</strong> {MOCK_TRACE.trace_id}</span>
              <span><strong>{t.model}:</strong> {MOCK_TRACE.model_used}</span>
              <span><strong>{t.duration}:</strong> {MOCK_TRACE.total_duration_ms}ms</span>
            </div>

            {/* OTEL-style nested timeline */}
            <div className="space-y-1">
              {MOCK_TRACE.steps.map((step) => {
                const widthPct = (step.duration_ms / MOCK_TRACE.total_duration_ms) * 100;
                const offsetPct =
                  (MOCK_TRACE.steps
                    .slice(0, step.id - 1)
                    .reduce((sum, s) => sum + s.duration_ms, 0) /
                    MOCK_TRACE.total_duration_ms) *
                  100;

                return (
                  <div key={step.id} className="group rounded border border-gray-100 bg-gray-50 p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">
                        {t.step} {step.id}: <code className="rounded bg-gray-200 px-1">{step.tool}</code>
                      </span>
                      <span className="text-gray-500">{step.duration_ms}ms</span>
                    </div>
                    {/* Timeline bar */}
                    <div className="mt-1 h-3 w-full rounded bg-gray-200">
                      <div
                        className="h-3 rounded bg-blue-500 transition-all"
                        style={{ width: `${widthPct}%`, marginLeft: `${offsetPct}%` }}
                        aria-label={`${step.tool}: ${step.duration_ms}ms`}
                      />
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-gray-400">
                      <span>in: {step.input_hash}</span>
                      <span>out: {step.output_hash}</span>
                      {step.metadata && Object.entries(step.metadata as Record<string, unknown>).map(([k, v]) => (
                        <span key={k}>{k}: {String(v)}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t.noTraceSelected}</p>
        )}
      </section>

      {/* Two-column: Evaluation Arena + Confidence Calibration */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Evaluation Arena */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.evaluationArena}>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t.evaluationArena}
          </h3>
          <p className="mb-4 text-xs text-gray-400">{t.totalComparisons}: 520</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left font-medium text-gray-500">{t.model}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.archetype}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.elo}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.winRate}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.matchesPlayed}</th>
              </tr>
            </thead>
            <tbody>
              {ELO_RANKINGS.map((r) => (
                <tr key={r.model} className="border-b border-gray-50">
                  <td className="py-2.5 font-medium text-gray-900">{r.model}</td>
                  <td className="py-2.5 text-gray-600">{r.archetype}</td>
                  <td className="py-2.5 text-right font-bold text-blue-700">{r.elo}</td>
                  <td className="py-2.5 text-right text-gray-700">{r.win_rate_pct}%</td>
                  <td className="py-2.5 text-right text-gray-500">{r.matches_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Confidence Calibration Heatmap */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.confidenceCalibration}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t.confidenceCalibration}
          </h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500">
              <span>{t.predicted}</span>
              <span className="text-center">{t.actualAccuracy}</span>
              <span className="text-right">Error</span>
            </div>
            {CALIBRATION_DATA.map((row) => {
              const mid = parseBucketMidpoint(row.bucket);
              const error = Math.abs(row.actual - mid);
              const colorClass = getCalibrationColor(row.bucket, row.actual);
              return (
                <div
                  key={row.bucket}
                  className="grid grid-cols-3 gap-2 items-center"
                  aria-label={`${t.predicted} ${row.bucket}: ${t.actualAccuracy} ${(row.actual * 100).toFixed(0)}%`}
                >
                  <span className="text-sm font-medium text-gray-700">{row.bucket}</span>
                  <div className={`rounded px-3 py-2 text-center text-sm font-bold ${colorClass}`}>
                    {(row.actual * 100).toFixed(0)}%
                  </div>
                  <span className="text-right text-sm text-gray-500">
                    {(error * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Green = well-calibrated, Amber = slight miscalibration, Red = significant miscalibration
          </p>
        </section>
      </div>

      {/* Source Quality Table */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label={t.sourceQuality}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.sourceQuality}
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left font-medium text-gray-500">{t.corpus}</th>
              <th className="pb-2 text-right font-medium text-gray-500">{t.acceptanceRate}</th>
              <th className="pb-2 text-right font-medium text-gray-500">{t.correctionRate}</th>
              <th className="pb-2 text-right font-medium text-gray-500">{t.qualityScore}</th>
              <th className="pb-2 text-right font-medium text-gray-500">{t.sampleSize}</th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_QUALITY.map((row) => (
              <tr key={row.corpus} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5 font-medium text-gray-700">{row.corpus}</td>
                <td className="py-2.5 text-right text-gray-700">{row.acceptance_rate_pct}%</td>
                <td className="py-2.5 text-right text-gray-700">{row.correction_rate_pct}%</td>
                <td className="py-2.5 text-right">
                  <span className={`font-bold ${row.quality_score >= 0.9 ? 'text-green-700' : row.quality_score >= 0.8 ? 'text-amber-700' : 'text-red-700'}`}>
                    {row.quality_score.toFixed(2)}
                  </span>
                </td>
                <td className="py-2.5 text-right text-gray-500">{row.sample_size.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Corpus Health */}
      <section className="mb-8" aria-label={t.corpusHealth}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.corpusHealth}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORPUS_HEALTH.map((idx) => (
            <div key={idx.name} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{idx.name}</span>
                <StatusBadge
                  status={getFreshnessStatus(idx.freshness_score)}
                  label={getFreshnessLabel(idx.freshness_score, lang)}
                  pulse={getFreshnessStatus(idx.freshness_score) === 'degraded'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>{t.docCount}: <strong className="text-gray-700">{idx.document_count.toLocaleString()}</strong></span>
                <span>{t.chunkCount}: <strong className="text-gray-700">{idx.chunk_count.toLocaleString()}</strong></span>
                <span className="col-span-2">
                  {t.lastRefreshed}: <strong className="text-gray-700">{new Date(idx.last_indexed_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</strong>
                </span>
              </div>
              {idx.stale_documents > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  {idx.stale_documents} stale document{idx.stale_documents > 1 ? 's' : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Feedback Analytics */}
      <section aria-label={t.feedbackAnalytics}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.feedbackAnalytics}
        </h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Correction Patterns */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-3 text-sm font-medium text-gray-700">{t.correctionPatterns}</h4>
            <div className="h-48" aria-label={`${t.correctionPatterns}: ${CORRECTION_PATTERNS.map((p) => `${p.pattern} (${p.count})`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CORRECTION_PATTERNS} layout="vertical" margin={{ left: 140, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="pattern" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Content Gaps */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-3 text-sm font-medium text-gray-700">{t.contentGaps}</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-gray-500">{t.topic}</th>
                  <th className="pb-2 text-right font-medium text-gray-500">{t.queryCount}</th>
                  <th className="pb-2 text-right font-medium text-gray-500">{t.avgConfidence}</th>
                </tr>
              </thead>
              <tbody>
                {CONTENT_GAPS.map((gap) => (
                  <tr key={gap.topic} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-700">{gap.topic}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">{gap.query_count}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-medium ${gap.avg_confidence < 0.4 ? 'text-red-600' : 'text-amber-600'}`}>
                        {(gap.avg_confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
