export const qk = {
  auth: {
    all: ["auth"] as const,
    me: () => [...qk.auth.all, "me"] as const,
    demoUsers: () => [...qk.auth.all, "demo-users"] as const,
  },
  system: {
    all: ["system"] as const,
    info: () => [...qk.system.all, "info"] as const,
    provenance: (correlationId: string) => [...qk.system.all, "provenance", correlationId] as const,
  },
  workspaces: {
    all: ["workspaces"] as const,
    list: () => [...qk.workspaces.all, "list"] as const,
    detail: (id: string) => [...qk.workspaces.all, "detail", id] as const,
    archetypes: () => [...qk.workspaces.all, "archetypes"] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: () => [...qk.bookings.all, "list"] as const,
    detail: (id: string) => [...qk.bookings.all, "detail", id] as const,
  },
  teams: {
    all: ["teams"] as const,
    members: (bookingId: string) => [...qk.teams.all, "members", bookingId] as const,
  },
  documents: {
    all: ["documents"] as const,
    status: (workspaceId: string) => [...qk.documents.all, "status", workspaceId] as const,
    content: (documentId: string) => [...qk.documents.all, "content", documentId] as const,
    list: (workspaceId: string | null, q: string, kind: string) =>
      [...qk.documents.all, "list", workspaceId ?? "all", q, kind] as const,
  },
  surveys: {
    all: ["surveys"] as const,
  },
  citations: {
    all: ["citations"] as const,
    detail: (id: string) => [...qk.citations.all, "detail", id] as const,
  },
  chat: {
    all: ["chat"] as const,
    conversations: () => [...qk.chat.all, "conversations"] as const,
    conversation: (id: string) => [...qk.chat.all, "conversation", id] as const,
    sessionCost: () => [...qk.chat.all, "session-cost"] as const,
  },
  admin: {
    all: ["admin"] as const,
    clients: () => [...qk.admin.all, "clients"] as const,
    client: (id: string) => [...qk.admin.all, "client", id] as const,
    interviews: (clientId: string) => [...qk.admin.all, "interviews", clientId] as const,
    workspaces: () => [...qk.admin.all, "workspaces"] as const,
    bookings: () => [...qk.admin.all, "bookings"] as const,
    models: () => [...qk.admin.all, "models"] as const,
    modelHistory: (modelId: string) => [...qk.admin.all, "model-history", modelId] as const,
    prompts: () => [...qk.admin.all, "prompts"] as const,
    promptVersions: (promptId: string) => [...qk.admin.all, "prompt-versions", promptId] as const,
    workspacePrompt: (workspaceId: string) => [...qk.admin.all, "workspace-prompt", workspaceId] as const,
    workspaceValves: (workspaceId: string) => [...qk.admin.all, "workspace-valves", workspaceId] as const,
  },
  ops: {
    all: ["ops"] as const,
    health: () => [...qk.ops.all, "health"] as const,
    finops: (days: number) => [...qk.ops.all, "finops", days] as const,
    aiops: (days: number = 14) => [...qk.ops.all, "aiops", days] as const,
    calibration: (limit: number = 500) =>
      [...qk.ops.all, "calibration", limit] as const,
    liveops: (granularity: string = "rollup", hours: number = 24) =>
      [...qk.ops.all, "liveops", granularity, hours] as const,
    incidents: (status?: string) =>
      [...qk.ops.all, "incidents", status ?? "all"] as const,
    corpusHealth: () => [...qk.ops.all, "corpus-health"] as const,
    feedbackAnalytics: () => [...qk.ops.all, "feedback-analytics"] as const,
    evalArena: () => [...qk.ops.all, "eval-arena"] as const,
    deployments: () => [...qk.ops.all, "deployments"] as const,
    traces: (conversationId?: string) => [...qk.ops.all, "traces", conversationId ?? "all"] as const,
    audit: () => [...qk.ops.all, "audit"] as const,
    drift: (workspaceId: string | null, window: string) =>
      [...qk.ops.all, "drift", workspaceId ?? "all", window] as const,
  },
} as const;
