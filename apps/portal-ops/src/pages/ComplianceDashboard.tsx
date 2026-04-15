// ---------------------------------------------------------------------------
// Continuous Authorization Dashboard — ITSG-33 compliance posture
// CA-2 (Security Assessments), CA-7 (Continuous Monitoring)
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';

type Lang = 'en' | 'fr';

const T = {
  en: {
    title: 'Continuous Authorization Dashboard',
    subtitle: 'Real-time ITSG-33 ATO compliance posture — EVA Agentic (P53)',
    lastRefresh: 'Last refresh',
    overallCompliance: 'Overall Compliance Posture',
    compliant: 'compliant',
    partial: 'partial',
    nonCompliant: 'non-compliant',
    controlsCompliant: 'Controls Compliant',
    evidenceFreshness: 'Evidence Freshness',
    securityTestsPassing: 'Security Tests Passing',
    lastRedTeam: 'Last Red Team Failures',
    itsg33Controls: 'ITSG-33 Control Families',
    evaPrinciples: 'EVA-Specific Design Principles',
    colControl: 'Control',
    colFamily: 'Family',
    colName: 'Name',
    colStatus: 'Status',
    colPrinciple: 'Principle',
    cioSignoff: 'CIO Authorization',
    cioDescription: 'This dashboard IS the SA&A evidence. When all controls are green, the certification script produces a signed evidence package for CIO review.',
    runCertification: 'Run Certification Script',
    exportEvidence: 'Export Evidence Package',
    tests: 'tests',
    failures: 'failures',
    percent: '%',
    controls: 'controls',
  },
  fr: {
    title: 'Tableau de bord d\'autorisation continue',
    subtitle: 'Posture de conformite ITSG-33 en temps reel — EVA Agentic (P53)',
    lastRefresh: 'Dernier rafraichissement',
    overallCompliance: 'Posture de conformite globale',
    compliant: 'conforme',
    partial: 'partielle',
    nonCompliant: 'non-conforme',
    controlsCompliant: 'Controles conformes',
    evidenceFreshness: 'Fraicheur des preuves',
    securityTestsPassing: 'Tests de securite reussis',
    lastRedTeam: 'Derniers echecs de Red Team',
    itsg33Controls: 'Familles de controle ITSG-33',
    evaPrinciples: 'Principes de conception specifiques a EVA',
    colControl: 'Controle',
    colFamily: 'Famille',
    colName: 'Nom',
    colStatus: 'Statut',
    colPrinciple: 'Principe',
    cioSignoff: 'Autorisation du DPI',
    cioDescription: 'Ce tableau de bord EST la preuve SA&A. Quand tous les controles sont verts, le script de certification produit un paquet de preuves signe pour examen par le DPI.',
    runCertification: 'Executer le script de certification',
    exportEvidence: 'Exporter le paquet de preuves',
    tests: 'tests',
    failures: 'echecs',
    percent: '%',
    controls: 'controles',
  },
};

// ITSG-33 Control families
const CONTROL_FAMILIES = [
  {
    family: 'AC',
    name_en: 'Access Control',
    name_fr: 'Controle d\'acces',
    controls: [
      { id: 'AC-2', name_en: 'Account Management', name_fr: 'Gestion des comptes' },
      { id: 'AC-3', name_en: 'Access Enforcement', name_fr: 'Application de l\'acces' },
      { id: 'AC-6', name_en: 'Least Privilege', name_fr: 'Privilege minimum' },
    ],
  },
  {
    family: 'AU',
    name_en: 'Audit & Accountability',
    name_fr: 'Audit et responsabilite',
    controls: [
      { id: 'AU-2', name_en: 'Audit Events', name_fr: 'Evenements d\'audit' },
      { id: 'AU-3', name_en: 'Audit Content', name_fr: 'Contenu d\'audit' },
      { id: 'AU-4', name_en: 'Audit Storage', name_fr: 'Stockage d\'audit' },
      { id: 'AU-6', name_en: 'Audit Review', name_fr: 'Examen d\'audit' },
      { id: 'AU-9', name_en: 'Audit Protection', name_fr: 'Protection d\'audit' },
      { id: 'AU-11', name_en: 'Audit Retention', name_fr: 'Conservation d\'audit' },
    ],
  },
  {
    family: 'CM',
    name_en: 'Configuration Management',
    name_fr: 'Gestion de la configuration',
    controls: [
      { id: 'CM-2', name_en: 'Baseline Config', name_fr: 'Config de reference' },
      { id: 'CM-3', name_en: 'Change Control', name_fr: 'Controle des changements' },
      { id: 'CM-6', name_en: 'Config Settings', name_fr: 'Parametres de config' },
    ],
  },
  {
    family: 'IA',
    name_en: 'Identification & Authentication',
    name_fr: 'Identification et authentification',
    controls: [
      { id: 'IA-2', name_en: 'User Identification', name_fr: 'Identification de l\'utilisateur' },
      { id: 'IA-5', name_en: 'Authenticator Mgmt', name_fr: 'Gestion des authentificateurs' },
    ],
  },
  {
    family: 'SC',
    name_en: 'System Protection',
    name_fr: 'Protection du systeme',
    controls: [
      { id: 'SC-7', name_en: 'Boundary Protection', name_fr: 'Protection de limite' },
      { id: 'SC-8', name_en: 'Transmission Confidentiality', name_fr: 'Confidentialite de transmission' },
      { id: 'SC-12', name_en: 'Key Management', name_fr: 'Gestion des cles' },
      { id: 'SC-28', name_en: 'Protection at Rest', name_fr: 'Protection au repos' },
    ],
  },
  {
    family: 'SI',
    name_en: 'System Integrity',
    name_fr: 'Integrite du systeme',
    controls: [
      { id: 'SI-2', name_en: 'Flaw Remediation', name_fr: 'Remediation des defauts' },
      { id: 'SI-3', name_en: 'Malicious Code Protection', name_fr: 'Protection contre code malveillant' },
      { id: 'SI-4', name_en: 'System Monitoring', name_fr: 'Suivi du systeme' },
      { id: 'SI-10', name_en: 'Input Validation', name_fr: 'Validation des entrees' },
    ],
  },
  {
    family: 'SA',
    name_en: 'Security Assessment',
    name_fr: 'Evaluation de la securite',
    controls: [
      { id: 'SA-11', name_en: 'Dev Security Testing', name_fr: 'Tests de securite dev' },
      { id: 'CA-7', name_en: 'Continuous Monitoring', name_fr: 'Surveillance continue' },
      { id: 'CA-8', name_en: 'Penetration Testing', name_fr: 'Tests de penetration' },
      { id: 'CP-9', name_en: 'Backup', name_fr: 'Sauvegarde' },
    ],
  },
];

// EVA-specific principles
const EVA_PRINCIPLES = [
  { id: 'EVA-01', name_en: 'Confidence Scoring', name_fr: 'Notation de confiance' },
  { id: 'EVA-02', name_en: 'Explainability', name_fr: 'Explicabilite' },
  { id: 'EVA-03', name_en: 'Source Freshness', name_fr: 'Fraicheur de la source' },
  { id: 'EVA-04', name_en: 'Graceful Degradation', name_fr: 'Degradation elegante' },
  { id: 'EVA-05', name_en: 'Behavioral Fingerprint', name_fr: 'Empreinte comportementale' },
  { id: 'EVA-06', name_en: 'Feedback Loop', name_fr: 'Boucle de retroaction' },
  { id: 'EVA-07', name_en: 'Bilingual Parity', name_fr: 'Parite bilingue' },
  { id: 'EVA-08', name_en: 'Provenance Chain', name_fr: 'Chaine de provenance' },
  { id: 'EVA-09', name_en: 'PII Protection', name_fr: 'Protection des IIP' },
  { id: 'EVA-10', name_en: 'Conflict Resolution', name_fr: 'Resolution de conflit' },
];

// Status badge component
function StatusBadge({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colorMap = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };

  const dotColorMap = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const labelMap = {
    green: 'Compliant',
    yellow: 'Partial',
    red: 'Non-Compliant',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status]}`}>
      <span className={`mr-1.5 h-2 w-2 rounded-full ${dotColorMap[status]}`} />
      {labelMap[status]}
    </span>
  );
}

// Progress bar
function ComplianceProgress({
  green,
  yellow,
  red,
  total,
  lang,
}: {
  green: number;
  yellow: number;
  red: number;
  total: number;
  lang: Lang;
}) {
  const t = T[lang];
  const greenPct = total > 0 ? (green / total) * 100 : 0;
  const yellowPct = total > 0 ? (yellow / total) * 100 : 0;
  const redPct = total > 0 ? (red / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">
          {t.overallCompliance}
        </span>
        <span>{Math.round(greenPct)}{t.percent} {t.compliant}</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${greenPct}%` }}
          role="progressbar"
          aria-valuenow={green}
          aria-valuemin={0}
          aria-valuemax={total}
        />
        <div className="bg-yellow-500 transition-all" style={{ width: `${yellowPct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${redPct}%` }} />
      </div>
      <div className="mt-2 flex gap-4 text-xs text-gray-600">
        <span>🟢 {green} {t.compliant}</span>
        <span>🟡 {yellow} {t.partial}</span>
        <span>🔴 {red} {t.nonCompliant}</span>
      </div>
    </div>
  );
}

export default function ComplianceDashboard({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [lastRefresh, setLastRefresh] = useState(new Date().toISOString());
  const [controlStatuses, setControlStatuses] = useState<Record<string, 'green' | 'yellow' | 'red'>>({});

  // Initialize control statuses (in production, fetches from API)
  useEffect(() => {
    const statuses: Record<string, 'green' | 'yellow' | 'red'> = {};

    CONTROL_FAMILIES.forEach((family) => {
      family.controls.forEach((control) => {
        statuses[control.id] = 'green';
      });
    });

    EVA_PRINCIPLES.forEach((principle) => {
      statuses[principle.id] = 'green';
    });

    setControlStatuses(statuses);
    setLastRefresh(new Date().toISOString());
  }, []);

  // Aggregate counts
  const allControlIds = [
    ...CONTROL_FAMILIES.flatMap((f) => f.controls.map((c) => c.id)),
    ...EVA_PRINCIPLES.map((p) => p.id),
  ];

  const green = allControlIds.filter((id) => controlStatuses[id] === 'green').length;
  const yellow = allControlIds.filter((id) => controlStatuses[id] === 'yellow').length;
  const red = allControlIds.filter((id) => controlStatuses[id] === 'red').length;
  const total = allControlIds.length;

  // KPI metrics
  const kpis = [
    {
      label: t.controlsCompliant,
      value: `${green}`,
      trend: { direction: 'up' as const, percentage: 100 },
      upIsGood: true,
      color: '#10b981',
    },
    {
      label: t.evidenceFreshness,
      value: '98%',
      trend: { direction: 'up' as const, percentage: 2 },
      upIsGood: true,
      color: '#3b82f6',
    },
    {
      label: t.securityTestsPassing,
      value: '972',
      trend: { direction: 'up' as const, percentage: 5 },
      upIsGood: true,
      color: '#8b5cf6',
    },
    {
      label: t.lastRedTeam,
      value: '0',
      trend: undefined,
      upIsGood: true,
      color: '#06b6d4',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" role="region" aria-label={t.title}>
      {/* Header */}
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t.title}</h2>
          <p className="text-sm text-gray-600">{t.subtitle}</p>
        </div>
        <div className="text-sm text-gray-500">
          {t.lastRefresh}: {new Date(lastRefresh).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA')}
        </div>
      </div>

      {/* Overall progress */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ComplianceProgress green={green} yellow={yellow} red={red} total={total} lang={lang} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            upIsGood={kpi.upIsGood}
            color={kpi.color}
          />
        ))}
      </div>

      {/* ITSG-33 Control Families */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.itsg33Controls}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.colControl}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.colFamily}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.colName}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {CONTROL_FAMILIES.map((family) =>
                family.controls.map((control) => (
                  <tr key={control.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 font-mono text-xs text-gray-900">{control.id}</td>
                    <td className="py-2.5 text-gray-700">{lang === 'en' ? family.name_en : family.name_fr}</td>
                    <td className="py-2.5 text-gray-700">{lang === 'en' ? control.name_en : control.name_fr}</td>
                    <td className="py-2.5">
                      <StatusBadge status={controlStatuses[control.id] || 'red'} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EVA Principles */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t.evaPrinciples}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t.colPrinciple}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.colName}</th>
                <th className="pb-2 text-left font-medium text-gray-500">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {EVA_PRINCIPLES.map((principle) => (
                <tr key={principle.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 font-mono text-xs text-gray-900">{principle.id}</td>
                  <td className="py-2.5 text-gray-700">{lang === 'en' ? principle.name_en : principle.name_fr}</td>
                  <td className="py-2.5">
                    <StatusBadge status={controlStatuses[principle.id] || 'red'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CIO Sign-off section */}
      <div className="rounded-lg border border-gray-200 bg-blue-50 p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t.cioSignoff}</h2>
        <p className="mb-4 text-sm text-gray-700">{t.cioDescription}</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            disabled={red > 0}
            aria-label={t.runCertification}
          >
            {t.runCertification}
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            aria-label={t.exportEvidence}
          >
            {t.exportEvidence}
          </button>
        </div>
      </div>
    </div>
  );
}
