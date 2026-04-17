import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import i18n from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

describe("LanguageSwitcher", () => {
  it("changes the active i18n language", async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage("en");
    renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: /language/i }));
    await user.click(await screen.findByRole("menuitem", { name: /français/i }));

    await waitFor(() => expect(i18n.language.startsWith("fr")).toBe(true));
  });
});
