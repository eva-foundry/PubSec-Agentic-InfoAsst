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
        email: "alice@demo.gc.ca",
        name: "Alice Chen",
        role: "contributor",
        portal_access: ["self-service"],
        workspace_grants: ["ws-oas-act"],
        data_classification_level: "protected_b",
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

  it("shows an empty state when the endpoint errors", async () => {
    server.use(
      http.get("*/v1/eva/archetypes", () =>
        HttpResponse.json({ detail: "unavailable" }, { status: 503 }),
      ),
    );
    renderWithProviders(<Catalog />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load archetypes/i)).toBeInTheDocument(),
    );
  });
});
