import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import { ThemeCustomizerButton } from "@/components/ThemeCustomizerButton";

describe("ThemeCustomizer", () => {
  it("opens the popover and lets the user change accent + radius", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizerButton />);

    const trigger = screen.getByRole("button", { name: /theme|customizer|palette|open/i });
    await user.click(trigger);

    // Accent swatches expose aria-labels like "Accent indigo"
    const emerald = await screen.findByRole("button", { name: /accent emerald/i });
    await user.click(emerald);
    await waitFor(() => expect(emerald).toHaveAttribute("aria-pressed", "true"));

    // Radius "Sharp" toggle
    const sharp = screen.getAllByRole("button", { name: /sharp/i })[0];
    await user.click(sharp);
    expect(sharp).toHaveAttribute("aria-pressed", "true");

    // Reset restores defaults (indigo accent)
    const reset = screen.getByRole("button", { name: /reset/i });
    await user.click(reset);
    await waitFor(() => {
      const indigo = screen.getByRole("button", { name: /accent indigo/i });
      expect(indigo).toHaveAttribute("aria-pressed", "true");
    });
  });
});
