import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  CHAT_FIXTURE_EVENTS,
  CONVERSATIONS_FIXTURE,
  DEMO_USERS_FIXTURE,
  WORKSPACES_FIXTURE,
} from "./chat-fixtures";
import {
  ADMIN_MODELS_FIXTURE,
  ADMIN_PROMPTS_FIXTURE,
  AIOPS_FIXTURE,
  AUDIT_ENTRIES_FIXTURE,
  CORPUS_HEALTH_FIXTURE,
  DEPLOYMENTS_FIXTURE,
  EVAL_ARENA_FIXTURE,
  FINOPS_FIXTURE,
  LIVEOPS_FIXTURE,
  OPS_HEALTH_FIXTURE,
  SYSTEM_INFO_FIXTURE,
} from "./fixtures";
import type { ChatEvent } from "@/lib/api/types";

// Use wildcard `*` origin so handlers match any VITE_API_BASE_URL
// the client resolves in test mode (.env.local can override to a
// non-localhost host; MSW should still intercept).
const ndjsonStream = (events: ChatEvent[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      }
      controller.close();
    },
  });
};

export const chatHandlers = [
  http.post(`*/v1/eva/chat`, () =>
    new HttpResponse(ndjsonStream(CHAT_FIXTURE_EVENTS), {
      headers: { "content-type": "application/x-ndjson" },
    }),
  ),
  http.get(`*/v1/eva/workspaces`, () => HttpResponse.json(WORKSPACES_FIXTURE)),
  http.get(`*/v1/eva/conversations`, () => HttpResponse.json(CONVERSATIONS_FIXTURE)),
  http.get(`*/v1/eva/auth/demo/users`, () => HttpResponse.json(DEMO_USERS_FIXTURE)),
  http.post(`*/v1/eva/auth/demo/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    const user = DEMO_USERS_FIXTURE.find((u) => u.email === body?.email);
    if (!user) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(user);
  }),
];

export const opsHandlers = [
  http.get(`*/v1/eva/ops/health`, () => HttpResponse.json(OPS_HEALTH_FIXTURE)),
  http.get(`*/v1/eva/ops/metrics/finops`, () => HttpResponse.json(FINOPS_FIXTURE)),
  http.get(`*/v1/eva/ops/metrics/aiops`, () => HttpResponse.json(AIOPS_FIXTURE)),
  http.get(`*/v1/eva/ops/metrics/liveops`, () => HttpResponse.json(LIVEOPS_FIXTURE)),
  http.get(`*/v1/eva/ops/corpus-health`, () => HttpResponse.json(CORPUS_HEALTH_FIXTURE)),
  http.get(`*/v1/eva/ops/evaluation-arena`, () => HttpResponse.json(EVAL_ARENA_FIXTURE)),
  http.get(`*/v1/eva/ops/deployments`, () => HttpResponse.json(DEPLOYMENTS_FIXTURE)),
  http.get(`*/v1/eva/ops/audit`, ({ request }) => {
    const url = new URL(request.url);
    const decision = url.searchParams.get("decision");
    const data = decision
      ? AUDIT_ENTRIES_FIXTURE.filter((e) => e.decision === decision)
      : AUDIT_ENTRIES_FIXTURE;
    return HttpResponse.json(data);
  }),
];

export const adminHandlers = [
  http.get(`*/v1/eva/admin/models`, () => HttpResponse.json(ADMIN_MODELS_FIXTURE)),
  http.get(`*/v1/eva/admin/prompts`, () => HttpResponse.json(ADMIN_PROMPTS_FIXTURE)),
  http.post(`*/v1/eva/admin/models/:id/toggle`, async ({ params }) => {
    const id = params.id as string;
    const model = ADMIN_MODELS_FIXTURE.find((m) => m.id === id);
    if (!model) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ ...model, is_active: !model.is_active });
  }),
  http.post(`*/v1/eva/admin/deployments/:version/rollback`, async ({ params, request }) => {
    const body = (await request.json()) as { rationale?: string };
    if (!body?.rationale || body.rationale.length < 3) {
      return HttpResponse.json({ detail: "rationale too short" }, { status: 422 });
    }
    return HttpResponse.json({
      version: params.version as string,
      deployed_at: "2026-04-12T08:00:00Z",
      deployed_by: "ci-pipeline",
      status: "active",
      notes: `rolled back by test: ${body.rationale}`,
    });
  }),
];

export const systemHandlers = [
  http.get(`*/v1/eva/system/info`, () => HttpResponse.json(SYSTEM_INFO_FIXTURE)),
];

export const defaultHandlers = [
  ...chatHandlers,
  ...opsHandlers,
  ...adminHandlers,
  ...systemHandlers,
];

export const server = setupServer(...defaultHandlers);
