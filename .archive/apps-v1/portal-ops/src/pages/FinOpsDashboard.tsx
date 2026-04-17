// ---------------------------------------------------------------------------
// FinOps Command Center — cost attribution, budgets, chargeback
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
  Cell,
} from 'recharts';
import { MetricCard } from '../components/MetricCard';

type Lang = 'en' | 'fr';
type TimeRange = '7d' | '30d' | '90d';

const T = {
  en: {
    title: 'FinOps Command Center',
    totalCostMtd: 'Total Cost (MTD)',
    costTrend: 'Cost Trend vs Last Month',
    topClient: 'Top Spending Client',
    budgetUtil: 'Budget Utilization',
    costWaterfall: 'Cost Waterfall by Workspace',
    outcomeMetrics: 'Outcome Metrics per Dollar',
    budgetMgmt: 'Budget Management',
    chargebackTable: 'Chargeback Records',
    timeRange: 'Time Range',
    workspace: 'Workspace',
    cost: 'Cost (CAD)',
    queries: 'Queries',
    costPerQuery: 'Cost/Query',
    resolutionRate: 'Resolution Rate',
    timeToAnswer: 'Avg Time to Answer',
    citationAccuracy: 'Citation Accuracy/Dollar',
    client: 'Client',
    period: 'Period',
    department: 'Department',
    costCenter: 'Cost Center',
    threshold: 'Threshold',
    alertRule: 'Alert Rule',
    status: 'Status',
    active: 'Active',
    noAlerts: 'No budget alerts triggered',
  },
  fr: {
    title: 'Centre de commande FinOps',
    totalCostMtd: 'Cout total (mois en cours)',
    costTrend: 'Tendance des couts vs mois dernier',
    topClient: 'Client le plus depensier',
    budgetUtil: 'Utilisation du budget',
    costWaterfall: 'Cascade des couts par espace de travail',
    outcomeMetrics: 'Metriques de resultats par dollar',
    budgetMgmt: 'Gestion du budget',
    chargebackTable: 'Registres de refacturation',
    timeRange: 'Periode',
    workspace: 'Espace de travail',
    cost: 'Cout (CAD)',
    queries: 'Requetes',
    costPerQuery: 'Cout/Requete',
    resolutionRate: 'Taux de resolution',
    timeToAnswer: 'Temps moyen de reponse',
    citationAccuracy: 'Precision des citations/Dollar',
    client: 'Client',
    period: 'Periode',
    department: 'Direction',
    costCenter: 'Centre de couts',
    threshold: 'Seuil',
    alertRule: 'Regle d\'alerte',
    status: 'Statut',
    active: 'Actif',
    noAlerts: 'Aucune alerte budgetaire declenchee',
  },
};

// Mock data — realistic CAD figures
const WORKSPACE_COSTS = [
  { name: 'EI Jurisprudence', cost: 6800, queries: 8910, costPerQuery: 0.76, model: 'gpt-5.1' },
  { name: 'OAS Act', cost: 4200, queries: 3420, costPerQuery: 1.23, model: 'gpt-5.1' },
  { name: 'General FAQ', cost: 1450, queries: 2100, costPerQuery: 0.69, model: 'gpt-5-mini' },
];

const BAR_COLORS = ['#2563eb', '#7c3aed', '#059669'];

const OUTCOME_METRICS = [
  { metric: 'Resolution Rate', value: '87.3%', perDollar: '0.0070' },
  { metric: 'Avg Time to Answer', value: '2.1s', perDollar: 'N/A' },
  { metric: 'Citation Accuracy', value: '96.0%', perDollar: '0.0077' },
];

const CHARGEBACK_RECORDS = [
  { client: 'ESDC - EI Branch', workspace: 'EI Jurisprudence', period: '2026-04', cost: 6800, department: 'Benefits and Integrated Services', costCenter: 'CC-4420' },
  { client: 'ESDC - OAS Division', workspace: 'OAS Act', period: '2026-04', cost: 4200, department: 'Income Security Programs', costCenter: 'CC-3310' },
  { client: 'ESDC - Service Canada', workspace: 'General FAQ', period: '2026-04', cost: 1450, department: 'Citizen Services Branch', costCenter: 'CC-2200' },
];

const BUDGET_RULES = [
  { workspace: 'EI Jurisprudence', threshold: '$8,000 CAD', rule: '> 80% utilization', status: 'active' },
  { workspace: 'OAS Act', threshold: '$5,000 CAD', rule: '> 90% utilization', status: 'active' },
  { workspace: 'General FAQ', threshold: '$2,000 CAD', rule: '> 75% utilization', status: 'active' },
];

export default function FinOpsDashboard({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const totalCost = 12450;
  const budgetUtil = 83;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6" role="region" aria-label={t.title}>
      {/* Header + time range selector */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{t.title}</h2>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1" role="group" aria-label={t.timeRange}>
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-pressed={timeRange === range}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t.totalCostMtd}
          value={`$${totalCost.toLocaleString('en-CA')} CAD`}
          trend={{ direction: 'up', percentage: 12.3 }}
          upIsGood={false}
          color="#dc2626"
        />
        <MetricCard
          label={t.costTrend}
          value="+12.3%"
          trend={{ direction: 'up', percentage: 12.3 }}
          upIsGood={false}
          color="#f59e0b"
        />
        <MetricCard
          label={t.topClient}
          value="EI Jurisprudence"
          color="#7c3aed"
        />
        <MetricCard
          label={t.budgetUtil}
          value={`${budgetUtil}%`}
          trend={{ direction: 'up', percentage: 5.2 }}
          upIsGood={false}
          color="#2563eb"
        />
      </div>

      {/* Cost Waterfall Chart */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.costWaterfall}
        </h3>
        <div className="h-64" aria-label={`${t.costWaterfall}: ${WORKSPACE_COSTS.map((w) => `${w.name} $${w.cost}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WORKSPACE_COSTS} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()} CAD`, t.cost]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]} animationDuration={800}>
                {WORKSPACE_COSTS.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column: Outcome Metrics + Budget Management */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Outcome Metrics */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t.outcomeMetrics}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left font-medium text-gray-500">Metric</th>
                <th className="pb-2 text-right font-medium text-gray-500">Value</th>
                <th className="pb-2 text-right font-medium text-gray-500">Per $1 CAD</th>
              </tr>
            </thead>
            <tbody>
              {OUTCOME_METRICS.map((row) => (
                <tr key={row.metric} className="border-b border-gray-50">
                  <td className="py-2.5 text-gray-700">{row.metric}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{row.value}</td>
                  <td className="py-2.5 text-right text-gray-600">{row.perDollar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Budget Management */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t.budgetMgmt}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left font-medium text-gray-500">{t.workspace}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.threshold}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.alertRule}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_RULES.map((rule) => (
                <tr key={rule.workspace} className="border-b border-gray-50">
                  <td className="py-2.5 text-gray-700">{rule.workspace}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{rule.threshold}</td>
                  <td className="py-2.5 text-right text-gray-600">{rule.rule}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      {t.active}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-400">{t.noAlerts}</p>
        </div>
      </div>

      {/* Chargeback Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.chargebackTable}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.client}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.workspace}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.period}</th>
                <th className="pb-2 text-right font-medium text-gray-500">{t.cost}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.department}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.costCenter}</th>
              </tr>
            </thead>
            <tbody>
              {CHARGEBACK_RECORDS.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 text-gray-700">{row.client}</td>
                  <td className="py-2.5 text-gray-700">{row.workspace}</td>
                  <td className="py-2.5 text-gray-600">{row.period}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">
                    ${row.cost.toLocaleString('en-CA')}
                  </td>
                  <td className="py-2.5 text-gray-600">{row.department}</td>
                  <td className="py-2.5 text-gray-500">{row.costCenter}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={3} className="py-2.5 font-semibold text-gray-900">Total</td>
                <td className="py-2.5 text-right font-bold text-gray-900">
                  ${CHARGEBACK_RECORDS.reduce((s, r) => s + r.cost, 0).toLocaleString('en-CA')}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
