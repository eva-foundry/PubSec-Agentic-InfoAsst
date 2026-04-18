import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  CHAT_FIXTURE_EVENTS,
  CONVERSATIONS_FIXTURE,
  DEMO_USERS_FIXTURE,
  WORKSPACES_FIXTURE,
} from "./chat-fixtures";
import type { ChatEvent } from "@/lib/api/types";

// Wildcard `*` origin so handlers match any VITE_API_BASE_URL the client
// resolves in tests (dev-machine .env.local may override it).
const API = "*";

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
  http.post(`${API}/v1/eva/chat`, () =>
    new HttpResponse(ndjsonStream(CHAT_FIXTURE_EVENTS), {
      headers: { "content-type": "application/x-ndjson" },
    }),
  ),
  http.get(`${API}/v1/eva/workspaces`, () => HttpResponse.json(WORKSPACES_FIXTURE)),
  http.get(`${API}/v1/eva/conversations`, () => HttpResponse.json(CONVERSATIONS_FIXTURE)),
  http.get(`${API}/v1/eva/auth/demo/users`, () => HttpResponse.json(DEMO_USERS_FIXTURE)),
];

export const server = setupServer(...chatHandlers);
