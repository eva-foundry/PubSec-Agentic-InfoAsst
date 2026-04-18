import type { ChatRequest, ChatEvent, EvalStreamEvent } from "./types";
import { streamNdjson } from "./stream";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type HeaderContext = {
  appId?: string;
  userGroup?: string;
  classification?: string;
  assuranceLevel?: string;
};

export type ApiClientOptions = {
  baseUrl: string;
  getAuthHeaders?: () => Record<string, string>;
  getHeaderContext?: () => HeaderContext;
};

export type ApiErrorEnvelope = {
  detail?: string | { code?: string; message?: string; [k: string]: unknown };
  [k: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly correlationId: string;
  readonly code?: string;
  readonly envelope?: ApiErrorEnvelope;

  constructor(status: number, correlationId: string, envelope: ApiErrorEnvelope | undefined, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.correlationId = correlationId;
    this.envelope = envelope;
    this.code = code;
  }
}

export type ApiClient = {
  get: <T>(path: string, init?: RequestOverrides) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: RequestOverrides) => Promise<T>;
  patch: <T>(path: string, body?: unknown, init?: RequestOverrides) => Promise<T>;
  put: <T>(path: string, body?: unknown, init?: RequestOverrides) => Promise<T>;
  del: <T>(path: string, init?: RequestOverrides) => Promise<T>;
  streamChat: (body: ChatRequest, init?: { signal?: AbortSignal }) => AsyncIterable<ChatEvent>;
  streamEvalResults: (runId: string, init?: { signal?: AbortSignal }) => AsyncIterable<EvalStreamEvent>;
  baseUrl: string;
};

export type RequestOverrides = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
};

const randomUuid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const buildUrl = (baseUrl: string, path: string, query?: RequestOverrides["query"]): string => {
  const origin = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(origin + suffix);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.append(k, String(v));
    }
  }
  return url.toString();
};

const applyContextHeaders = (headers: Headers, opts: ApiClientOptions): string => {
  const correlationId = randomUuid();
  headers.set("x-correlation-id", correlationId);

  const authHeaders = opts.getAuthHeaders?.() ?? {};
  for (const [k, v] of Object.entries(authHeaders)) {
    if (v) headers.set(k, v);
  }

  const ctx = opts.getHeaderContext?.();
  if (ctx?.appId) headers.set("x-app-id", ctx.appId);
  if (ctx?.userGroup) headers.set("x-user-group", ctx.userGroup);
  if (ctx?.classification) headers.set("x-classification", ctx.classification);
  if (ctx?.assuranceLevel) headers.set("x-assurance-level", ctx.assuranceLevel);

  return correlationId;
};

const parseError = async (res: Response, correlationId: string): Promise<ApiError> => {
  let envelope: ApiErrorEnvelope | undefined;
  try {
    envelope = (await res.json()) as ApiErrorEnvelope;
  } catch {
    envelope = undefined;
  }
  const detail = envelope?.detail;
  let message = res.statusText || `HTTP ${res.status}`;
  let code: string | undefined;
  if (typeof detail === "string") {
    message = detail;
  } else if (detail && typeof detail === "object") {
    if (typeof detail.message === "string") message = detail.message;
    if (typeof detail.code === "string") code = detail.code;
  }
  return new ApiError(res.status, correlationId, envelope, message, code);
};

const request = async <T>(
  opts: ApiClientOptions,
  method: HttpMethod,
  path: string,
  body?: unknown,
  overrides?: RequestOverrides,
): Promise<T> => {
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  for (const [k, v] of Object.entries(overrides?.headers ?? {})) headers.set(k, v);
  const correlationId = applyContextHeaders(headers, opts);

  const init: RequestInit = {
    method,
    headers,
    signal: overrides?.signal,
    credentials: "include",
  };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(buildUrl(opts.baseUrl, path, overrides?.query), init);
  if (!res.ok) throw await parseError(res, correlationId);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
};

export const createApiClient = (opts: ApiClientOptions): ApiClient => {
  const client: ApiClient = {
    baseUrl: opts.baseUrl,
    get: (p, o) => request(opts, "GET", p, undefined, o),
    post: (p, b, o) => request(opts, "POST", p, b, o),
    patch: (p, b, o) => request(opts, "PATCH", p, b, o),
    put: (p, b, o) => request(opts, "PUT", p, b, o),
    del: (p, o) => request(opts, "DELETE", p, undefined, o),
    streamChat: (body, init) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/x-ndjson",
      };
      const h = new Headers(headers);
      applyContextHeaders(h, opts);
      const plain: Record<string, string> = {};
      h.forEach((v, k) => {
        plain[k] = v;
      });
      return streamNdjson<ChatEvent>(buildUrl(opts.baseUrl, "/v1/eva/chat"), {
        method: "POST",
        headers: plain,
        body: JSON.stringify(body),
        signal: init?.signal,
        credentials: "include",
      });
    },
    streamEvalResults: (runId, init) => {
      const h = new Headers({ accept: "application/x-ndjson" });
      applyContextHeaders(h, opts);
      const plain: Record<string, string> = {};
      h.forEach((v, k) => {
        plain[k] = v;
      });
      const qs = `?run_id=${encodeURIComponent(runId)}`;
      return streamNdjson<EvalStreamEvent>(
        buildUrl(opts.baseUrl, `/v1/eva/ops/eval/results${qs}`),
        {
          method: "GET",
          headers: plain,
          signal: init?.signal,
          credentials: "include",
        },
      );
    },
  };
  return client;
};

export const resolveBaseUrl = (): string => {
  const fromEnv = import.meta.env?.VITE_API_BASE_URL;
  return (typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : "http://localhost:8000").replace(/\/+$/, "");
};
