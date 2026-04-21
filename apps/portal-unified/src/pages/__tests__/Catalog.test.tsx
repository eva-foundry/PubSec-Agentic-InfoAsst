import { beforeEach, describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import Catalog from "@/pages/Catalog";
import { server } from "@/test/msw/server";

const primeAnon = () => {
  localStorage.setItem(
    "aia.auth.v1",
    JSON.stringify({
      user: {
        user_id: "demo-alice",
        email: "alice@example.org",
        name: "Alice Chen",
        role: "contributor",
        portal_access: ["self-service"],
        workspace_grants: ["ws-oas-act"],
        data_classification_level: "sensitive",
        language: "en",
      },
    }),
  );
};

describe("Catalog archetypes", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeAnon();
  });

  it("renders archetype cards from /archetypes", async () => {
    renderWithProviders(<Catalog />);

    await waitFor(() =>
      expect(screen.getByText("Knowledge Base")).toBeInTheDocument(),
    );
    expect(screen.getByText("Decision Support")).toBeInTheDocument();
    expect(
      screen.getByText("FAQ-style retrieval over a curated corpus."),
    ).toBeInTheDocument();
    expect(screen.getByText("$49-$120/mo")).toBeInTheDocument();
    expect(screen.getByText("25 docs")).toBeInTheDocument();
  });

  it("filters by assurance level", async () => {
    const u = userEvent.setup();
    renderWithProviders(<Catalog />);

    await waitFor(() =>
      expect(screen.getByText("Knowledge Base")).toBeInTheDocument(),
    );

    await u.click(screen.getByRole("button", { name: /^Decision-informing$/ }));

    await waitFor(() =>
      expect(screen.queryByText("Knowledge Base")).toBeNull(),
    );
    expect(screen.getByText("Decision Support")).toBeInTheDocument();
  });

  it("wizard POSTs name + archetype + classification to /workspaces", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post("*/v1/aia/workspaces", async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          {
            id: "ws-new",
            name: (bodies[0] as { name: string }).name,
            archetype: (bodies[0] as { archetype: string }).archetype,
            data_classification: "restricted",
            status: "draft",
            owner_id: "demo-alice",
            type: "kb",
            name_fr: "",
            description: "",
            description_fr: "",
            document_capacity: 25,
            document_count: 0,
            monthly_cost: 0,
            cost_centre: "",
            created_at: "2026-04-19T00:00:00Z",
            updated_at: "2026-04-19T00:00:00Z",
            infrastructure: {},
            business_prompt: "",
            business_prompt_version: 1,
            business_prompt_history: [],
          },
          { status: 201 },
        );
      }),
    );

    const u = userEvent.setup();
    renderWithProviders(<Catalog />);

    await waitFor(() =>
      expect(screen.getByText("Knowledge Base")).toBeInTheDocument(),
    );

    // Open the wizard via "Use template" on the Knowledge Base card.
    const useBtns = screen.getAllByRole("button", { name: /^Use template$/ });
    await u.click(useBtns[0]);

    // Step through Archetype → Data sources → Team → Policies → Confirm → Create.
    for (let i = 0; i < 4; i++) {
      await u.click(screen.getByRole("button", { name: /^Next$/ }));
    }
    await u.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      name: "Knowledge Base",
      archetype: "kb",
      data_classification: "restricted",
    });
  });

  it("shows an empty state when the endpoint errors", async () => {
    server.use(
      http.get("*/v1/aia/archetypes", () =>
        HttpResponse.json({ detail: "unavailable" }, { status: 503 }),
      ),
    );
    renderWithProviders(<Catalog />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load archetypes/i)).toBeInTheDocument(),
    );
  });
});
