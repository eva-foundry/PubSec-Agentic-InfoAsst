import { beforeEach, describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import Drift from "@/pages/Drift";
import { server } from "@/test/msw/server";

const primeOps = () => {
  localStorage.setItem(
    "aia.auth.v1",
    JSON.stringify({
      user: {
        user_id: "demo-dave",
        email: "dave@example.org",
        name: "Dave Thompson",
        role: "admin",
        portal_access: ["self-service", "admin", "ops"],
        workspace_grants: ["all"],
        data_classification_level: "sensitive",
        language: "en",
      },
    }),
  );
};

describe("Drift monitor", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeOps();
  });

  it("renders open alerts from /ops/metrics/drift", async () => {
    renderWithProviders(<Drift />);

    await waitFor(() =>
      expect(
        screen.getByText(/Embedding PSI 0.32 above threshold/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/18% of documents past freshness threshold/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 open alerts/i)).toBeInTheDocument();
  });

  it("refetches when the window toggle changes", async () => {
    const u = userEvent.setup();
    const windows: string[] = [];
    server.use(
      http.get("*/v1/aia/ops/metrics/drift", ({ request }) => {
        const window = new URL(request.url).searchParams.get("window") ?? "30d";
        windows.push(window);
        return HttpResponse.json({
          workspace_id: null,
          window,
          model: [],
          prompt: [],
          corpus: [],
          alerts: [],
        });
      }),
    );

    renderWithProviders(<Drift />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "30d" })).toBeInTheDocument(),
    );

    await u.click(screen.getByRole("button", { name: "7d" }));

    await waitFor(() => expect(windows).toContain("7d"));
  });

  it("shows an error empty-state when the endpoint fails", async () => {
    server.use(
      http.get("*/v1/aia/ops/metrics/drift", () =>
        HttpResponse.json({ detail: "unavailable" }, { status: 503 }),
      ),
    );
    renderWithProviders(<Drift />);
    await waitFor(() =>
      expect(screen.getAllByText(/Could not load drift/i).length).toBeGreaterThan(0),
    );
  });
});
