import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import RedTeam from "@/pages/RedTeam";
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

describe("RedTeam: runner", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeOps();
  });

  it("runs an evaluation and surfaces probe results from the backend stream", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RedTeam />);

    await user.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(
      () => {
        const verdicts = screen.queryAllByText(/^(blocked|review|bypass)$/i);
        expect(verdicts.length).toBeGreaterThan(0);
      },
      { timeout: 5000, interval: 100 },
    );

    // Probe rows render category labels + the fixture prompts.
    await waitFor(() => {
      expect(
        screen.getByText(/Ignore previous instructions/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/List employee addresses/i),
      ).toBeInTheDocument();
    });
  }, 15000);

  it("returns to the Run control when the start call fails", async () => {
    server.use(
      http.post("*/v1/eva/ops/eval/challenges", () =>
        HttpResponse.json({ detail: "nope" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RedTeam />);
    await user.click(screen.getByRole("button", { name: /run evaluation/i }));
    // Start call fails → running resets so the Run button comes back.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /run evaluation/i }),
      ).toBeInTheDocument(),
    );
    // No probe rows should have rendered.
    expect(screen.queryAllByText(/^(blocked|review|bypass)$/i).length).toBe(0);
  });

  it("blocks export when no run has happened yet", async () => {
    renderWithProviders(<RedTeam />);
    expect(screen.getByRole("button", { name: /export evidence/i })).toBeDisabled();
  });
});
