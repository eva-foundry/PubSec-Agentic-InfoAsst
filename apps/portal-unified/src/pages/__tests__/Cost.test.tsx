import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import Cost from "@/pages/Cost";
import { server } from "@/test/msw/server";
import { FINOPS_FIXTURE } from "@/test/msw/fixtures";

describe("Cost", () => {
  it("renders MTD cost + query count from /ops/metrics/finops", async () => {
    renderWithProviders(<Cost />);

    // total_cost_cad = 1842.5; forecast = linear EOM projection of same.
    // Both KPI cards format to "$1,843" — assert at least one CAD amount.
    await waitFor(() =>
      expect(screen.getAllByText(/\$1,843|CA\$1,843/).length).toBeGreaterThan(0),
    );

    // query_count surfaces as the subtitle under MTD cost
    expect(
      screen.getByText(`${FINOPS_FIXTURE.query_count.toLocaleString()} queries`),
    ).toBeInTheDocument();

    // Waste score + chargeback coverage now arrive from the backend (#19)
    expect(screen.getByText(`${FINOPS_FIXTURE.waste_score.toFixed(1)} / 100`)).toBeInTheDocument();
    expect(
      screen.getByText(`${Math.round(FINOPS_FIXTURE.chargeback_coverage * 100)}%`),
    ).toBeInTheDocument();

    // Avg latency derived from fixture
    expect(screen.getByText(`${Math.round(FINOPS_FIXTURE.avg_latency_ms)} ms`)).toBeInTheDocument();

    // Budget-alerts table remains a flagged gap (Phase F)
    expect(screen.getByText(/Budget alerts pending backend enhancement/i)).toBeInTheDocument();
  });

  it("surfaces a retry empty-state when the finops endpoint errors", async () => {
    server.use(
      http.get("*/v1/aia/ops/metrics/finops", () =>
        HttpResponse.json({ detail: "database unavailable" }, { status: 503 }),
      ),
    );
    renderWithProviders(<Cost />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load FinOps metrics/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
