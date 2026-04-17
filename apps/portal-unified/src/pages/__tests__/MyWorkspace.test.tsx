import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor, within } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import MyWorkspace from "@/pages/MyWorkspace";

describe("MyWorkspace: invite", () => {
  it("adds a new teammate to the table after submitting the invite form", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyWorkspace />);

    await user.click(screen.getByRole("tab", { name: /team/i }));

    const emailInput = await screen.findByLabelText(/invite a teammate/i);
    await user.type(emailInput, "newhire@acme.com");
    await user.click(screen.getByRole("button", { name: /^invite$/i }));

    await waitFor(() => {
      expect(screen.getByText("newhire@acme.com")).toBeInTheDocument();
    });
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyWorkspace />);

    await user.click(screen.getByRole("tab", { name: /team/i }));
    const emailInput = await screen.findByLabelText(/invite a teammate/i);
    await user.type(emailInput, "not-an-email");
    await user.click(screen.getByRole("button", { name: /^invite$/i }));

    // The bad string should not have been added to the table
    expect(screen.queryByText("not-an-email")).not.toBeInTheDocument();
  });
});
