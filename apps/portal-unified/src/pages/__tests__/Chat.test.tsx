import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import Chat from "@/pages/Chat";

describe("Chat: smoke", () => {
  // Full send-and-stream test moves to Phase E with MSW once NDJSON
  // fixtures are wired. This smoke test just asserts the empty-state
  // composer renders without throwing.
  it("renders the composer and empty-state without backend", async () => {
    renderWithProviders(<Chat />);

    const textarea = await screen.findByRole("textbox");
    expect((textarea as HTMLTextAreaElement).value).toBe("");

    const sendBtn = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-send"));
    expect(sendBtn).toBeTruthy();
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
