// Static content — marketing copy, compliance frameworks, red-team category
// definitions. These are editorial assets, not API data.
//
// ARCHETYPES used to live here; they are now served by /v1/aia/archetypes so
// ops can publish/retire archetypes without a UI release. See useArchetypes().

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
