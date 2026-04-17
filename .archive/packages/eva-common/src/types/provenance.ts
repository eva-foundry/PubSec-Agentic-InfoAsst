// ---------------------------------------------------------------------------
// Provenance & Audit Data Models
// TypeScript equivalents of services/api-gateway/app/provenance/models.py
// ---------------------------------------------------------------------------

export interface ConfidenceFactors {
  /** Relevance of retrieved documents to the query (0-1). */
  retrieval_relevance: number;
  /** How well the sources cover the question scope (0-1). */
  source_coverage: number;
  /** Degree to which the answer is grounded in sources (0-1). */
  grounding_quality: number;
}

export interface FreshnessInfo {
  /** ISO date of the oldest source consulted. */
  oldest_source: string | null;
  /** ISO date of the newest source consulted. */
  newest_source: string | null;
  /** True if any cited source may be outdated. */
  staleness_warning: boolean;
}

/** Point-in-time snapshot of the model config active when a query was served. */
export interface ModelSnapshot {
  deployment_name: string;
  model_name: string;
  model_version: string;
  provider: string;
  endpoint: string;
  sku: string;
  cost_model: string;
  parameter_overrides: Record<string, unknown>;
  /** Number of changes to this model config at query time. */
  config_version: number;
  /** Who last modified this model config. */
  last_changed_by: string;
  /** When the model config was last modified (ISO). */
  last_changed_at: string;
}

export interface BehavioralFingerprint {
  /** Model identifier, e.g. "gpt-5-mini". */
  model: string;
  /** Full model config snapshot at query time — who enabled it, what params, what version. */
  model_snapshot: ModelSnapshot | null;
  /** Prompt template version, e.g. "rag-system:v1 + ws-oas-act:v1". */
  prompt_version: string;
  /** ISO date of the corpus snapshot used for retrieval. */
  corpus_snapshot: string;
  /** Guardrail / policy rules version, e.g. "v1.4". */
  policy_rules_version: string;
}

export interface Citation {
  /** Blob path or document identifier. */
  file: string;
  /** Page number within the document. */
  page: number | null;
  /** Section heading or identifier. */
  section: string | null;
  /** SAS-signed URL for source retrieval. */
  sas_url: string;
  /** ISO date when the source was last verified current. */
  last_verified: string | null;
  /** Quality score of the source (0-1). */
  source_quality_score: number | null;
}

export interface ProvenanceRecord {
  /** UUID linking all operations for this request. */
  correlation_id: string;
  /** Agent that produced the answer, e.g. "eva-rag-agent". */
  agent_id: string;
  /** Ordered list of agents/tools invoked. */
  delegation_chain: string[];
  /** Total sources retrieved before filtering. */
  sources_consulted: number;
  /** Sources actually cited in the answer. */
  sources_cited: number;
  /** Sources retrieved but excluded. */
  sources_excluded: number;
  /** Why each excluded source was dropped. */
  exclusion_reasons: string[];
  /** Guardrail policies enforced. */
  policies_applied: string[];
  /** Overall confidence score (0-1). */
  confidence: number;
  /** Breakdown of confidence computation. */
  confidence_factors: ConfidenceFactors;
  /** Escalation classification. */
  escalation_tier: 'auto-resolve' | 'flagged-for-review' | 'requires-human-decision';
  /** Temporal validity metadata. */
  freshness: FreshnessInfo;
  /** Software version snapshot that produced this answer. */
  behavioral_fingerprint: BehavioralFingerprint;
  /** OpenTelemetry trace ID. */
  trace_id: string;
}

export interface ExplainabilityRecord {
  /** e.g. "5 sources retrieved; 3 selected; 1 excluded (superseded)". */
  retrieval_summary: string;
  /** Structured reasoning explanation (not raw chain-of-thought). */
  reasoning_summary: string;
  /** What the system looked for but did not find. */
  negative_evidence: string[];
  /** Cross-language handling, e.g. "Query in French; sources in English; translated". */
  cross_language: string | null;
}

export interface AgentStep {
  /** Sequential step identifier within this request. */
  id: number;
  /** Tool invoked: "search", "cite", "answer", "translate", etc. */
  tool: string;
  /** Step status. */
  status: 'running' | 'complete' | 'error';
  /** Human-readable step label in English. */
  label_en: string;
  /** Human-readable step label in French. */
  label_fr: string;
  /** Execution time in milliseconds. */
  duration_ms: number | null;
  /** Tool-specific data. */
  metadata: Record<string, unknown> | null;
}
