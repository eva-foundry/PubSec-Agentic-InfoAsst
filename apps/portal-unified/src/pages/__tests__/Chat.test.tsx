import { afterAll, afterEach, beforeAll, describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import Chat from "@/pages/Chat";
import { server } from "@/test/msw/server";
import { http, HttpResponse } from "msw";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const primeAuth = () => {
  const user = {
    user_id: "demo-alice",
    email: "alice@demo.gc.ca",
    name: "Alice Chen",
    role: "contributor",
    portal_access: ["self-service"],
    workspace_grants: ["ws-oas-act"],
    data_classification_level: "protected_b",
    language: "en",
  };
  localStorage.setItem("aia.auth.v1", JSON.stringify({ user }));
};

describe("Chat: NDJSON streaming", () => {
  it("streams agent_step / content / citations / provenance_complete and renders a grounded answer", async () => {
    primeAuth();
    const u = userEvent.setup();
    renderWithProviders(<Chat />);

    const textarea = await screen.findByRole("textbox");
    await waitFor(() => expect(screen.queryAllByText(/OAS Act/i).length).toBeGreaterThan(0));

    await u.type(textarea, "What are OAS benefits?");

    const sendBtn = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-send"));
    expect(sendBtn).toBeTruthy();
    await u.click(sendBtn!);

    // Content deltas concatenate in the answer bubble.
    await waitFor(
      () => expect(screen.getByText(/Old Age Security benefits are paid monthly/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );

    // provenance_complete surfaces the Confidence label + Sources header + citation chips.
    await waitFor(() => expect(screen.getByText(/^Confidence$/)).toBeInTheDocument());
    expect(screen.getByText(/Sources \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/oas-act\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/regulations-2023\.pdf/)).toBeInTheDocument();

    // Agent-step pills carry real backend labels.
    expect(screen.getByText(/Searching sources/)).toBeInTheDocument();
    expect(screen.getByText(/Generating answer/)).toBeInTheDocument();
  });

  it("surfaces the degradation banner when the stream emits a nested degradation event", async () => {
    primeAuth();
    server.use(
      http.post("http://localhost:8000/v1/eva/chat", () => {
        const events = [
          {
            type: "provenance",
            correlation_id: "c1",
            trace_id: "t1",
            conversation_id: "conv1",
            message_id: "msg1",
          },
          {
            type: "degradation",
            degradation: {
              status: "partial",
              service: "search",
              notice_en: "Document search temporarily unavailable. Answering from general knowledge.",
              notice_fr: "Recherche de documents temporairement indisponible.",
            },
          },
          { type: "content", delta: "Falling back to general knowledge." },
          {
            type: "provenance_complete",
            provenance: {
              correlation_id: "c1",
              agent_id: "eva-rag-agent",
              delegation_chain: [],
              sources_consulted: 0,
              sources_cited: 0,
              sources_excluded: 0,
              exclusion_reasons: [],
              policies_applied: [],
              confidence: 0.4,
              confidence_factors: { retrieval_relevance: 0, source_coverage: 0, grounding_quality: 0 },
              escalation_tier: "flagged-for-review",
              freshness: { oldest_source: null, newest_source: null, staleness_warning: false },
              behavioral_fingerprint: {
                model: "gpt-5-mini",
                model_snapshot: null,
                prompt_version: "ungrounded:v1",
                corpus_snapshot: "",
                policy_rules_version: "v1.4",
              },
              trace_id: "t1",
            },
          },
        ];
        const body = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
        return new HttpResponse(body, {
          headers: { "content-type": "application/x-ndjson" },
        });
      }),
    );

    const u = userEvent.setup();
    renderWithProviders(<Chat />);
    const textarea = await screen.findByRole("textbox");
    await waitFor(() => expect(screen.queryAllByText(/OAS Act/i).length).toBeGreaterThan(0));
    await u.type(textarea, "Hello");
    const sendBtn = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-send"));
    await u.click(sendBtn!);

    await waitFor(() =>
      expect(screen.getByText(/Document search temporarily unavailable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/service: search/)).toBeInTheDocument();
  });
});
