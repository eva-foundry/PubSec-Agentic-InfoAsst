import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import Chat from "@/pages/Chat";

describe("Chat: send", () => {
  it("sends a prompt, runs the agentic loop, and shows the answer with sources", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Chat />);

    const textarea = await screen.findByRole("textbox");
    expect((textarea as HTMLTextAreaElement).value.length).toBeGreaterThan(0);

    // Locate the send button (no accessible name; identified by lucide-send icon)
    const sendBtn = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-send"));
    expect(sendBtn).toBeTruthy();
    await user.click(sendBtn!);

    // Loop is ~6 * 650ms + 400ms ≈ 4.3s; allow 8s
    await waitFor(
      () => {
        expect(screen.getByText(/^Confidence$/i)).toBeInTheDocument();
        expect(screen.getByText(/^Sources$/i)).toBeInTheDocument();
      },
      { timeout: 8000, interval: 100 },
    );
  }, 15000);
});
