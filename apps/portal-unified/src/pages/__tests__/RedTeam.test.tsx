import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import RedTeam from "@/pages/RedTeam";

describe("RedTeam: runner", () => {
  it("runs an evaluation and surfaces probe results + stop control", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RedTeam />);

    await user.click(screen.getByRole("button", { name: /run evaluation/i }));
    expect(await screen.findByRole("button", { name: /stop/i })).toBeInTheDocument();

    // Each probe is ~220-400ms; wait for at least one verdict badge
    await waitFor(
      () => {
        const verdicts = screen.queryAllByText(/^(blocked|review|bypass)$/i);
        expect(verdicts.length).toBeGreaterThan(0);
      },
      { timeout: 5000, interval: 100 },
    );

    await user.click(screen.getByRole("button", { name: /stop/i }));
  }, 15000);

  it("blocks export when no run has happened yet", async () => {
    renderWithProviders(<RedTeam />);
    expect(screen.getByRole("button", { name: /export evidence/i })).toBeDisabled();
  });
});
