import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type {
  AIOpsMetrics,
  AuditEntry,
  AuditFilters,
  CalibrationResponse,
  CorpusHealth,
  DeploymentRecord,
  DriftMetrics,
  DriftWindow,
  EvalArenaEntry,
  FeedbackSummary,
  FinOpsSummary,
  Incident,
  LiveOpsMetrics,
  OpsHealth,
} from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export const useOpsHealth = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.health(),
    queryFn: () => client.get<OpsHealth>("/v1/eva/ops/health"),
  });
};

export const useFinOpsMetrics = (days = 30) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.finops(days),
    queryFn: () => client.get<FinOpsSummary>("/v1/eva/ops/metrics/finops", { query: { days } }),
  });
};

export const useAIOpsMetrics = (days: number = 14) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.aiops(days),
    queryFn: () =>
      client.get<AIOpsMetrics>("/v1/eva/ops/metrics/aiops", { query: { days } }),
  });
};

export const useCalibrationSamples = (limit: number = 500) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.calibration(limit),
    queryFn: () =>
      client.get<CalibrationResponse>("/v1/eva/ops/metrics/calibration", {
        query: { limit },
      }),
  });
};

export const useLiveOpsMetrics = (
  granularity: "rollup" | "hour" = "rollup",
  hours: number = 24,
) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.liveops(granularity, hours),
    queryFn: () =>
      client.get<LiveOpsMetrics>("/v1/eva/ops/metrics/liveops", {
        query: granularity === "hour" ? { granularity, hours } : {},
      }),
  });
};

export const useIncidents = (status?: "ongoing" | "monitoring" | "resolved") => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.incidents(status),
    queryFn: () =>
      client.get<Incident[]>("/v1/eva/ops/incidents", {
        query: status ? { status } : {},
      }),
  });
};

export const useCorpusHealth = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.corpusHealth(),
    queryFn: () => client.get<CorpusHealth>("/v1/eva/ops/corpus-health"),
  });
};

export const useFeedbackAnalytics = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.feedbackAnalytics(),
    queryFn: () => client.get<FeedbackSummary>("/v1/eva/ops/feedback-analytics"),
  });
};

export const useEvalArena = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.evalArena(),
    queryFn: () => client.get<EvalArenaEntry[]>("/v1/eva/ops/evaluation-arena"),
  });
};

export const useDeployments = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.deployments(),
    queryFn: () => client.get<DeploymentRecord[]>("/v1/eva/ops/deployments"),
  });
};

export const useDriftMetrics = (
  workspaceId: string | null,
  window: DriftWindow = "30d",
) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.drift(workspaceId, window),
    queryFn: () =>
      client.get<DriftMetrics>("/v1/eva/ops/metrics/drift", {
        query: { workspace_id: workspaceId ?? undefined, window },
      }),
  });
};

export const useAuditLog = (filters: AuditFilters = {}) => {
  const client = useApiClient();
  return useQuery({
    queryKey: [...qk.ops.audit(), filters] as const,
    queryFn: () =>
      client.get<AuditEntry[]>("/v1/eva/ops/audit", {
        query: {
          actor: filters.actor,
          action: filters.action,
          decision: filters.decision,
          policy: filters.policy,
          start: filters.start,
          end: filters.end,
          limit: filters.limit,
        },
      }),
  });
};

export const useTraces = (conversationId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.ops.traces(conversationId ?? undefined),
    queryFn: () => client.get<Array<Record<string, unknown>>>(
      `/v1/eva/ops/traces/${conversationId}`,
    ),
    enabled: !!conversationId,
  });
};
