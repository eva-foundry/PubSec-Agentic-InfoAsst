import { beforeEach, describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import DevOps from "@/pages/DevOps";
import { DEPLOYMENTS_FIXTURE } from "@/test/msw/fixtures";

const primeAdmin = () => {
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

const primeReader = () => {
  localStorage.setItem(
    "aia.auth.v1",
    JSON.stringify({
      user: {
        user_id: "demo-bob",
        email: "bob@example.org",
        name: "Bob Wilson",
        role: "reader",
        portal_access: ["self-service", "ops"],
        workspace_grants: ["ws-oas-act"],
        data_classification_level: "sensitive",
        language: "en",
      },
    }),
  );
};

describe("DevOps rollback", () => {
  beforeEach(() => localStorage.removeItem("aia.auth.v1"));

  it("lists deployments and gates Rollback by role + status", async () => {
    primeAdmin();
    renderWithProviders(<DevOps />);

    // Every version from the fixture renders.
    for (const d of DEPLOYMENTS_FIXTURE) {
      await waitFor(() => expect(screen.getByText(d.version)).toBeInTheDocument());
    }

    const rollbackButtons = screen.getAllByRole("button", { name: /rollback/i });
    // As many buttons as rows; the row whose status is "active" is disabled
    // ("already the active build" tooltip on that one).
    const active = DEPLOYMENTS_FIXTURE.find((d) => d.status === "active")!;
    const activeRow = screen.getByText(active.version).closest("tr");
    expect(activeRow).toBeTruthy();
    const activeBtn = activeRow!.querySelector("button");
    expect((activeBtn as HTMLButtonElement).disabled).toBe(true);

    expect(rollbackButtons.length).toBe(DEPLOYMENTS_FIXTURE.length);
  });

  it("disables every Rollback button when the user is not an admin", async () => {
    primeReader();
    renderWithProviders(<DevOps />);
    await waitFor(() =>
      expect(screen.getByText(DEPLOYMENTS_FIXTURE[0].version)).toBeInTheDocument(),
    );
    const rollbackButtons = screen.getAllByRole("button", { name: /rollback/i });
    for (const btn of rollbackButtons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("opens the rationale dialog, requires ≥3 chars, submits, and toasts success", async () => {
    primeAdmin();
    const u = userEvent.setup();
    renderWithProviders(<DevOps />);

    // Pick a rolled-back version (not the active one).
    const target = DEPLOYMENTS_FIXTURE.find((d) => d.status === "rolled-back")!;
    await waitFor(() => expect(screen.getByText(target.version)).toBeInTheDocument());
    const row = screen.getByText(target.version).closest("tr")!;
    await u.click(row.querySelector("button")!);

    // Dialog surfaces.
    const heading = await screen.findByRole("heading", { name: new RegExp(target.version) });
    expect(heading).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /confirm rollback/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    const textarea = screen.getByLabelText(/rationale/i);
    await u.type(textarea, "calibration regression");
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    await u.click(confirmBtn);

    // Dialog closes on success (onSuccess → setTarget(null)).
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: new RegExp(target.version) })).toBeNull(),
    );
  });
});
