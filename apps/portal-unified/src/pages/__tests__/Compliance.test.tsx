import { beforeEach, describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import Compliance from "@/pages/Compliance";

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

describe("Compliance audit log", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeOps();
  });

  it("renders audit rows from /ops/audit with action, target, decision, policy", async () => {
    renderWithProviders(<Compliance />);

    // Both fixture rows render.
    await waitFor(() =>
      expect(screen.getByText("model.toggle")).toBeInTheDocument(),
    );
    expect(screen.getByText("guardrail.decision")).toBeInTheDocument();
    expect(screen.getByText("m-gpt-51")).toBeInTheDocument();
    expect(screen.getByText("conv-abc123")).toBeInTheDocument();
    expect(screen.getByText("prompt-injection-defense-v1")).toBeInTheDocument();
  });

  it("refetches with decision=deny when the filter changes", async () => {
    const u = userEvent.setup();
    renderWithProviders(<Compliance />);

    await waitFor(() =>
      expect(screen.getByText("model.toggle")).toBeInTheDocument(),
    );

    await u.click(screen.getByRole("combobox", { name: /filter by decision/i }));
    await u.click(screen.getByRole("option", { name: /^Deny$/ }));

    // `model.toggle` (decision=allow) disappears; guardrail.decision (deny) stays.
    await waitFor(() =>
      expect(screen.queryByText("model.toggle")).toBeNull(),
    );
    expect(screen.getByText("guardrail.decision")).toBeInTheDocument();
  });
});
