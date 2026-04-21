import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import LiveOps from "@/pages/LiveOps";
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

describe("LiveOps incidents + latency", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeOps();
  });

  it("renders incident rows from /ops/incidents", async () => {
    renderWithProviders(<LiveOps />);
    await waitFor(() =>
      expect(
        screen.getByText(/Elevated p99 latency on orchestrator/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Vector search degraded/i),
    ).toBeInTheDocument();
  });

  it("uses granularity=hour for the latency card", async () => {
    const hits: string[] = [];
    server.use(
      http.get("*/v1/aia/ops/metrics/liveops", ({ request }) => {
        const granularity = new URL(request.url).searchParams.get("granularity");
        hits.push(granularity ?? "(none)");
        if (granularity === "hour") {
          return HttpResponse.json({
            uptime_percent: 99.9,
            incident_count: 1,
            sla_breach_count: 0,
            latency_24h: [
              { hour: "2026-04-18T09:00:00Z", p50_ms: 190, p99_ms: 540 },
            ],
          });
        }
        return HttpResponse.json({
          uptime_percent: 99.9,
          incident_count: 1,
          sla_breach_count: 0,
        });
      }),
    );
    renderWithProviders(<LiveOps />);
    await waitFor(() => expect(hits).toContain("hour"));
  });

  it("shows an empty-state when the incidents endpoint errors", async () => {
    server.use(
      http.get("*/v1/aia/ops/incidents", () =>
        HttpResponse.json({ detail: "unavailable" }, { status: 503 }),
      ),
    );
    renderWithProviders(<LiveOps />);
    await waitFor(() =>
      expect(screen.getByText(/Incidents unavailable/i)).toBeInTheDocument(),
    );
  });
});
