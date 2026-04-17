// Mock data for AIA — Agentic Information Assistant

export const WORKSPACES = [
  { id: "hr", name: "Internal HR Handbook", archetype: "Knowledge Base", assurance: "Advisory", docs: 248, lastVerified: "2025-04-12" },
  { id: "eng", name: "Engineering Runbooks", archetype: "Policy Library", assurance: "Decision-informing", docs: 1142, lastVerified: "2025-04-15" },
  { id: "legal", name: "Legal Contract Archive", archetype: "Case Archive", assurance: "Decision-informing", docs: 8421, lastVerified: "2025-04-10" },
  { id: "bi", name: "Sales BI Dashboard", archetype: "BI Copilot", assurance: "Advisory", docs: 64, lastVerified: "2025-04-16" },
  { id: "vendor", name: "Vendor Risk Decisions", archetype: "Decision Support", assurance: "Decision-informing", docs: 312, lastVerified: "2025-04-14" },
];

export const ARCHETYPES = [
  { id: "kb", name: "Knowledge Base", desc: "FAQ-style retrieval over a curated corpus.", cost: "$49–$120/mo", assurance: "Advisory", samples: ["What is the parental leave policy?", "How do I request a new laptop?"] },
  { id: "policy", name: "Policy Library", desc: "Hierarchical document retrieval with section-level citations.", cost: "$120–$340/mo", assurance: "Decision-informing", samples: ["Which runbook applies to a Postgres failover?", "Show me incident severity definitions."] },
  { id: "case", name: "Case Archive", desc: "Citation graphs + precedent ranking across long-form documents.", cost: "$340–$1.2K/mo", assurance: "Decision-informing", samples: ["Find precedents for force-majeure clauses in SaaS contracts.", "Summarize prior rulings on data-residency."] },
  { id: "bi", name: "BI Copilot", desc: "Dashboard interpretation, metric explanations, anomaly drill-downs.", cost: "$220–$680/mo", assurance: "Advisory", samples: ["Why did Q1 ARR dip in EMEA?", "Explain the churn cohort chart."] },
  { id: "decision", name: "Decision Support", desc: "Rule-engine-backed answers with mandatory HITL gates.", cost: "$480–$2.4K/mo", assurance: "Decision-informing", samples: ["Should we onboard vendor X under SOC2 type-1 only?", "Approve cross-border data transfer for EU customer?"] },
];

export const PRICING = [
  {
    name: "Solo",
    price: "$49",
    period: "/mo",
    blurb: "For individuals exploring agentic RAG.",
    features: ["1 workspace", "3 indexes", "Advisory mode only", "Community support", "Single user"],
    cta: "Start solo",
    featured: false,
  },
  {
    name: "Team",
    price: "$299",
    period: "/mo",
    blurb: "For teams operating governed knowledge.",
    features: ["10 workspaces", "Unlimited indexes", "HITL gates", "Model registry", "Prompt versioning", "Email support"],
    cta: "Start team trial",
    featured: true,
  },
  {
    name: "Scale",
    price: "$1.5K–$6K",
    period: "/mo",
    blurb: "For regulated organizations.",
    features: ["SSO + SCIM", "Custom archetypes", "Dedicated ops dashboards", "Evaluation arena", "Audit export", "24/7 SLA"],
    cta: "Talk to us",
    featured: false,
  },
];

export const AGENTIC_STEPS = [
  { id: "plan", label: "Plan", desc: "Decompose query into sub-questions" },
  { id: "retrieve", label: "Retrieve", desc: "Hybrid BM25 + vector search across indexes" },
  { id: "reason", label: "Reason", desc: "Synthesize with chain-of-verification" },
  { id: "cite", label: "Cite", desc: "Anchor every claim to source passages" },
  { id: "verify", label: "Verify", desc: "Groundedness + safety guardrails" },
  { id: "respond", label: "Respond", desc: "Compose final answer" },
];

export const CHAT_THREADS = [
  { id: "t1", workspace: "Internal HR Handbook", title: "Parental leave eligibility", updated: "2h ago" },
  { id: "t2", workspace: "Engineering Runbooks", title: "Postgres failover steps", updated: "Yesterday" },
  { id: "t3", workspace: "Legal Contract Archive", title: "Force majeure precedents", updated: "2d ago" },
  { id: "t4", workspace: "Sales BI Dashboard", title: "Q1 EMEA dip explanation", updated: "3d ago" },
  { id: "t5", workspace: "Vendor Risk Decisions", title: "Vendor X SOC2 review", updated: "1w ago" },
];

export interface ScriptedQA {
  question: string;
  answer: string;
  confidence: number;
  sources: { id: string; title: string; page: number; snippet: string }[];
  negativeEvidence: string;
  fingerprint: { model: string; promptVersion: string; corpusSnapshot: string };
}

export const SCRIPTED_QA_BY_WORKSPACE: Record<string, ScriptedQA> = {
  hr: {
    question: "What is our parental leave policy for non-birthing parents?",
    answer:
      "Non-birthing parents are entitled to **12 weeks** of fully paid parental leave, which can be taken any time within the first **12 months** following the birth or adoption of a child. Leave must be requested at least 30 days in advance via the People Operations portal. Intermittent leave is permitted in 1-week minimum blocks.",
    confidence: 0.92,
    sources: [
      { id: "s1", title: "HR Handbook v4.2 — §6.3 Parental Leave", page: 47, snippet: "Non-birthing parents are entitled to twelve (12) weeks of fully paid parental leave..." },
      { id: "s2", title: "Benefits Summary 2025", page: 12, snippet: "Parental leave benefits apply equally to birth, adoption, and surrogacy events..." },
      { id: "s3", title: "People Ops FAQ", page: 3, snippet: "Requests must be submitted no fewer than 30 calendar days prior to the planned start date..." },
    ],
    negativeEvidence: "No sources found discussing parental leave for contractors or interns.",
    fingerprint: { model: "gpt-5.1", promptVersion: "rag-answer@v3.4.1", corpusSnapshot: "2025-04-12T08:00Z" },
  },
  eng: {
    question: "Walk me through the Postgres primary failover runbook.",
    answer:
      "The standard failover sequence is: **(1)** confirm primary unreachable via 3 health probes, **(2)** promote the warm standby in `us-east-1b` using `pg_ctl promote`, **(3)** flip the PgBouncer service record (TTL 30s), **(4)** verify replication lag on remaining replicas, and **(5)** page the on-call DBA. Total expected RTO is **under 4 minutes**.",
    confidence: 0.88,
    sources: [
      { id: "s1", title: "Postgres Failover Runbook v2.1 — §3", page: 8, snippet: "Promote the warm standby using pg_ctl promote on the chosen replica node..." },
      { id: "s2", title: "SRE Playbook — Database Incidents", page: 22, snippet: "PgBouncer service record must be updated within 60 seconds of promotion..." },
      { id: "s3", title: "Q1 Failover Drill Report", page: 4, snippet: "Measured RTO across 3 drills was 3m 41s, 3m 58s, and 4m 12s respectively..." },
    ],
    negativeEvidence: "No sources cover failover for the new us-west-2 region (deployment pending).",
    fingerprint: { model: "gpt-5.1", promptVersion: "rag-answer@v3.4.1", corpusSnapshot: "2025-04-15T08:00Z" },
  },
  legal: {
    question: "Find precedents for force-majeure clauses in our SaaS contracts.",
    answer:
      "Across **47 active SaaS agreements**, force-majeure clauses fall into three patterns: **broad** (pandemics + government action explicitly named, ~62%), **narrow** (acts of god only, ~24%), and **hybrid** with a 30-day cure period (~14%). The MSA-Acme-2024 agreement is the strongest precedent for the broad pattern and was successfully invoked twice in 2023.",
    confidence: 0.81,
    sources: [
      { id: "s1", title: "MSA-Acme-2024 — §14.2 Force Majeure", page: 31, snippet: "Neither party shall be liable for any failure attributable to pandemic, epidemic, or governmental action..." },
      { id: "s2", title: "Contract Pattern Analysis 2024-Q4", page: 9, snippet: "Of 47 reviewed agreements, 29 included explicit pandemic language..." },
      { id: "s3", title: "Force Majeure Invocation Log", page: 2, snippet: "MSA-Acme-2024 invoked successfully on 2023-03-14 and 2023-09-02..." },
    ],
    negativeEvidence: "No precedents found for cyber-incident-triggered force majeure (a growing industry pattern).",
    fingerprint: { model: "claude-opus-4.7", promptVersion: "rag-answer@v3.4.1", corpusSnapshot: "2025-04-10T08:00Z" },
  },
  bi: {
    question: "Why did Q1 ARR dip in EMEA?",
    answer:
      "EMEA Q1 ARR declined **6.2%** QoQ, driven primarily by **(1)** delayed renewals from 4 enterprise accounts in DACH (~$1.8M), **(2)** an FX headwind of ~2.1% on EUR-denominated contracts, and **(3)** an unusual concentration of churn in the financial-services segment. The dip is largely **timing-related** — 3 of 4 delayed deals closed in early Q2.",
    confidence: 0.76,
    sources: [
      { id: "s1", title: "Q1 EMEA Pipeline Snapshot", page: 1, snippet: "Four DACH enterprise renewals slipped from March into April-May..." },
      { id: "s2", title: "FX Impact Memo — Finance", page: 3, snippet: "EUR weakened ~2.1% against USD over the quarter..." },
      { id: "s3", title: "Churn Cohort Analysis Q1", page: 7, snippet: "Financial services accounted for 41% of EMEA churn vs. 22% baseline..." },
    ],
    negativeEvidence: "Sales BI Dashboard does not contain qualitative win/loss notes for the slipped deals.",
    fingerprint: { model: "gpt-5.1", promptVersion: "rag-answer@v3.4.1", corpusSnapshot: "2025-04-16T08:00Z" },
  },
  vendor: {
    question: "Should we onboard Vendor X with only a SOC2 Type-1 attestation?",
    answer:
      "**Recommendation: HITL required — do not auto-approve.** Vendor X presents medium risk: SOC2 Type-1 covers control *design* but not *operating effectiveness*. Of 14 comparable vendors onboarded in the past 18 months, 12 carried Type-2. Recommend conditional approval pending **(1)** completed Type-2 audit within 6 months and **(2)** restricted scope to non-PII workloads in the interim.",
    confidence: 0.69,
    sources: [
      { id: "s1", title: "Vendor X SOC2 Type-1 Report", page: 5, snippet: "Auditor opined on the design of controls as of 2024-11-30..." },
      { id: "s2", title: "Vendor Risk Policy v3.0", page: 12, snippet: "Type-1 attestations require compensating controls and a 6-month Type-2 commitment..." },
      { id: "s3", title: "Comparable Vendor Onboarding Log", page: 18, snippet: "12 of 14 onboarded vendors held Type-2 attestations at time of approval..." },
    ],
    negativeEvidence: "No evidence of penetration test results or SBOM disclosure from Vendor X.",
    fingerprint: { model: "claude-opus-4.7", promptVersion: "decision-support-gate@v1.2.0", corpusSnapshot: "2025-04-14T08:00Z" },
  },
};

// Backward-compat default
export const SCRIPTED_QA = SCRIPTED_QA_BY_WORKSPACE.hr;

export const DOCUMENTS = [
  { id: "d1", workspaceId: "hr", title: "HR Handbook v4.2", kind: "Policy", updated: "2025-04-12", pages: 184 },
  { id: "d2", workspaceId: "hr", title: "Benefits Summary 2025", kind: "Reference", updated: "2025-03-30", pages: 32 },
  { id: "d3", workspaceId: "hr", title: "People Ops FAQ", kind: "FAQ", updated: "2025-04-08", pages: 18 },
  { id: "d4", workspaceId: "eng", title: "Postgres Failover Runbook v2.1", kind: "Runbook", updated: "2025-04-15", pages: 24 },
  { id: "d5", workspaceId: "eng", title: "SRE Playbook — Database Incidents", kind: "Playbook", updated: "2025-04-02", pages: 96 },
  { id: "d6", workspaceId: "eng", title: "Q1 Failover Drill Report", kind: "Report", updated: "2025-04-01", pages: 12 },
  { id: "d7", workspaceId: "legal", title: "MSA-Acme-2024", kind: "Contract", updated: "2025-04-10", pages: 64 },
  { id: "d8", workspaceId: "legal", title: "Contract Pattern Analysis 2024-Q4", kind: "Analysis", updated: "2025-01-22", pages: 28 },
  { id: "d9", workspaceId: "legal", title: "Force Majeure Invocation Log", kind: "Log", updated: "2025-04-05", pages: 6 },
  { id: "d10", workspaceId: "bi", title: "Q1 EMEA Pipeline Snapshot", kind: "Dashboard", updated: "2025-04-16", pages: 4 },
  { id: "d11", workspaceId: "bi", title: "FX Impact Memo — Finance", kind: "Memo", updated: "2025-04-11", pages: 8 },
  { id: "d12", workspaceId: "bi", title: "Churn Cohort Analysis Q1", kind: "Analysis", updated: "2025-04-14", pages: 22 },
  { id: "d13", workspaceId: "vendor", title: "Vendor X SOC2 Type-1 Report", kind: "Attestation", updated: "2024-11-30", pages: 48 },
  { id: "d14", workspaceId: "vendor", title: "Vendor Risk Policy v3.0", kind: "Policy", updated: "2025-02-18", pages: 36 },
  { id: "d15", workspaceId: "vendor", title: "Comparable Vendor Onboarding Log", kind: "Log", updated: "2025-04-09", pages: 14 },
];

export const COST_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: `Apr ${i + 1}`,
  HR: 40 + Math.random() * 30,
  Engineering: 80 + Math.random() * 60,
  Legal: 120 + Math.random() * 80,
  BI: 30 + Math.random() * 25,
  Vendor: 50 + Math.random() * 40,
}));

export const QUALITY_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `D-${14 - i}`,
  groundedness: 0.82 + Math.random() * 0.12,
  relevance: 0.78 + Math.random() * 0.15,
  coherence: 0.85 + Math.random() * 0.1,
}));

export const CALIBRATION_DATA = Array.from({ length: 10 }, (_, i) => ({
  predicted: i * 0.1 + 0.05,
  actual: i * 0.1 + 0.05 + (Math.random() - 0.5) * 0.08,
}));

// 14-day token economics: input vs output tokens (millions) + cache hit %
export const TOKEN_DATA = Array.from({ length: 14 }, (_, i) => {
  const base = 1.2 + Math.sin(i / 2) * 0.25 + Math.random() * 0.15;
  return {
    day: `D-${14 - i}`,
    input: +(base * 1).toFixed(2),
    output: +(base * 0.27 + Math.random() * 0.05).toFixed(2),
    cached: +(0.55 + Math.random() * 0.15).toFixed(2),
  };
});

// 24-hour gateway latency percentiles (ms)
export const LATENCY_24H = Array.from({ length: 24 }, (_, i) => {
  const peak = i >= 13 && i <= 17 ? 1.4 : 1; // afternoon spike
  return {
    hour: `${String(i).padStart(2, "0")}:00`,
    p50: Math.round((180 + Math.random() * 30) * peak),
    p95: Math.round((420 + Math.random() * 60) * peak),
    p99: Math.round((680 + Math.random() * 120) * peak),
  };
});

// 14-day HITL gate activity (auto-resolve vs flagged vs human-required)
export const HITL_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `D-${14 - i}`,
  autoResolve: Math.round(140 + Math.random() * 40),
  flagged: Math.round(18 + Math.random() * 12),
  humanRequired: Math.round(6 + Math.random() * 6),
}));

export const SERVICES = [
  { name: "Gateway", status: "ok", uptime: 99.99, latency: 42 },
  { name: "Orchestrator", status: "ok", uptime: 99.97, latency: 180 },
  { name: "Vector Search", status: "degraded", uptime: 99.82, latency: 320 },
  { name: "Object Store", status: "ok", uptime: 99.99, latency: 28 },
  { name: "Content Safety", status: "ok", uptime: 99.95, latency: 95 },
  { name: "Document Extraction", status: "ok", uptime: 99.91, latency: 1200 },
];

export const AUDIT_LOG = [
  { id: "a1", time: "2025-04-16 14:22:01", actor: "alice@acme.com", subject: "doc:hr-handbook-v4.2", purpose: "answer-query", decision: "allow", policy: "rbac-reader" },
  { id: "a2", time: "2025-04-16 14:21:58", actor: "system:orchestrator", subject: "model:gpt-5.1", purpose: "inference", decision: "allow", policy: "model-registry" },
  { id: "a3", time: "2025-04-16 14:21:40", actor: "bob@acme.com", subject: "ws:vendor-risk", purpose: "decision-request", decision: "hitl-required", policy: "decision-support-gate" },
  { id: "a4", time: "2025-04-16 14:20:12", actor: "carol@acme.com", subject: "doc:contract-MSA-2024", purpose: "answer-query", decision: "allow", policy: "rbac-contributor" },
  { id: "a5", time: "2025-04-16 14:19:55", actor: "system:guardrail", subject: "prompt:user-injection", purpose: "safety-check", decision: "deny", policy: "owasp-llm-01" },
];

export const MODELS = [
  { id: "gpt-5-mini", name: "gpt-5-mini", vendor: "OpenAI", enabled: true, temp: 0.2, contextK: 128 },
  { id: "gpt-5.1", name: "gpt-5.1", vendor: "OpenAI", enabled: true, temp: 0.3, contextK: 256 },
  { id: "claude-opus-4.7", name: "claude-opus-4.7", vendor: "Anthropic", enabled: true, temp: 0.2, contextK: 200 },
  { id: "embedding-3-large", name: "embedding-3-large", vendor: "OpenAI", enabled: true, temp: 0, contextK: 8 },
];

export const PROMPTS = [
  { id: "p1", name: "rag-answer-default", version: "v3.4.1", status: "active", updated: "2025-04-12" },
  { id: "p2", name: "rag-answer-default", version: "v3.4.0", status: "archived", updated: "2025-03-28" },
  { id: "p3", name: "decision-support-gate", version: "v1.2.0", status: "ab-test", updated: "2025-04-09" },
];

export const FRAMEWORKS = ["NIST AI RMF", "ISO 42001", "OWASP LLM Top 10", "MITRE ATLAS", "WCAG 2.1 AA"];

export const ATTACK_CATEGORIES = [
  { id: "injection", name: "Prompt Injection", desc: "Adversarial instructions hidden in user input or retrieved context.", baseline: 0.94, severity: "high" },
  { id: "jailbreak", name: "Jailbreak", desc: "Roleplay and obfuscation attempts to bypass policy.", baseline: 0.91, severity: "high" },
  { id: "pii", name: "PII Leak", desc: "Probes that try to surface personal data from the corpus.", baseline: 0.97, severity: "critical" },
  { id: "hallucination", name: "Hallucination", desc: "Out-of-corpus questions that should be refused or hedged.", baseline: 0.88, severity: "medium" },
  { id: "bias", name: "Bias & Fairness", desc: "Demographic-sensitive prompts checked for parity.", baseline: 0.83, severity: "medium" },
  { id: "exfil", name: "Data Exfiltration", desc: "Indirect channels (URLs, markdown) used to leak context.", baseline: 0.96, severity: "critical" },
];

export const TEST_SETS = [
  { id: "ts1", name: "OWASP LLM Top-10 Pack", items: 142, lastRun: "2025-04-15", pass: 0.93 },
  { id: "ts2", name: "Internal Red Team Q1", items: 86, lastRun: "2025-04-10", pass: 0.88 },
  { id: "ts3", name: "Vendor Risk Adversarial", items: 54, lastRun: "2025-04-08", pass: 0.79 },
  { id: "ts4", name: "Hallucination Probes v2", items: 220, lastRun: "2025-04-12", pass: 0.85 },
];
