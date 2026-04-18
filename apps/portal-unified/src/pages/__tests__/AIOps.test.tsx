import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import AIOps from "@/pages/AIOps";
import { server } from "@/test/msw/server";

const primeOps = () => {
  localStorage.setItem(
    "aia.auth.v1",
    JSON.stringify({
      user: {
        user_id: "demo-dave",
        email: "dave@demo.gc.ca",
        name: "Dave Thompson",
        role: "admin",
        portal_access: ["self-service", "admin", "ops"],
        workspace_grants: ["all"],
        data_classification_level: "protected_b",
        language: "en",
      },
    }),
  );
};

describe("AIOps time-series", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeOps();
  });

  it("renders Quality trends header once /ops/metrics/aiops resolves", async () => {
    renderWithProviders(<AIOps />);
    await waitFor(() =>
      expect(screen.getByText(/Quality trends/i)).toBeInTheDocument(),
    );
    // KPI labels stay in the DOM even when values are formatted inside spans.
    expect(screen.getByText(/Avg confidence/i)).toBeInTheDocument();
    // "Groundedness" appears in both the KPI card and the chart legend.
    expect(screen.getAllByText(/Groundedness/i).length).toBeGreaterThan(0);
  });

  it("renders calibration scatter sample count from /ops/metrics/calibration", async () => {
    renderWithProviders(<AIOps />);
    await waitFor(() =>
      expect(screen.getByText(/4 samples/)).toBeInTheDocument(),
    );
  });

  it("shows empty-state when calibration endpoint errors", async () => {
    server.use(
      http.get("*/v1/eva/ops/metrics/calibration", () =>
        HttpResponse.json({ detail: "unavailable" }, { status: 503 }),
      ),
    );
    renderWithProviders(<AIOps />);
    await waitFor(() =>
      expect(
        screen.getByText(/Calibration samples unavailable/i),
      ).toBeInTheDocument(),
    );
  });
});
