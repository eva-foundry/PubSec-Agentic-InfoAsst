// Static content — catalog templates, marketing copy, compliance frameworks,
// red-team category definitions. These are editorial assets, not API data.

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

export const FRAMEWORKS = [
  "NIST AI RMF",
  "ISO 42001",
  "OWASP LLM Top 10",
  "MITRE ATLAS",
  "WCAG 2.1 AA",
];

export const AGENTIC_STEPS = [
  { id: "plan", label: "Plan", desc: "Decompose query into sub-questions" },
  { id: "retrieve", label: "Retrieve", desc: "Hybrid BM25 + vector search across indexes" },
  { id: "reason", label: "Reason", desc: "Synthesize with chain-of-verification" },
  { id: "cite", label: "Cite", desc: "Anchor every claim to source passages" },
  { id: "verify", label: "Verify", desc: "Groundedness + safety guardrails" },
  { id: "respond", label: "Respond", desc: "Compose final answer" },
] as const;

export const TEST_SETS = [
  { id: "ts1", name: "OWASP LLM Top-10 Pack", items: 142, lastRun: "2025-04-15", pass: 0.93 },
  { id: "ts2", name: "Internal Red Team Q1", items: 86, lastRun: "2025-04-10", pass: 0.88 },
  { id: "ts3", name: "Vendor Risk Adversarial", items: 54, lastRun: "2025-04-08", pass: 0.79 },
  { id: "ts4", name: "Hallucination Probes v2", items: 220, lastRun: "2025-04-12", pass: 0.85 },
];

export const ATTACK_CATEGORIES = [
  { id: "injection", name: "Prompt Injection", desc: "Adversarial instructions hidden in user input or retrieved context.", baseline: 0.94, severity: "high" },
  { id: "jailbreak", name: "Jailbreak", desc: "Roleplay and obfuscation attempts to bypass policy.", baseline: 0.91, severity: "high" },
  { id: "pii", name: "PII Leak", desc: "Probes that try to surface personal data from the corpus.", baseline: 0.97, severity: "critical" },
  { id: "hallucination", name: "Hallucination", desc: "Out-of-corpus questions that should be refused or hedged.", baseline: 0.88, severity: "medium" },
  { id: "bias", name: "Bias & Fairness", desc: "Demographic-sensitive prompts checked for parity.", baseline: 0.83, severity: "medium" },
  { id: "exfil", name: "Data Exfiltration", desc: "Indirect channels (URLs, markdown) used to leak context.", baseline: 0.96, severity: "critical" },
];
