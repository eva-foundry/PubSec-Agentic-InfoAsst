import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import Login from "@/pages/Login";
import { server } from "@/test/msw/server";

describe("Login", () => {
  beforeEach(() => {
    // Each test must start unauthenticated — otherwise Login redirects to /chat
    // and assertions about the persona list never resolve.
    localStorage.removeItem("aia.auth.v1");
  });

  it("lists demo personas from /auth/demo/users", async () => {
    renderWithProviders(<Login />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Alice Chen/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Carol Martinez/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dave Thompson/i })).toBeInTheDocument();
  });

  it("persists the selected persona to localStorage under aia.auth.v1", async () => {
    const u = userEvent.setup();
    renderWithProviders(<Login />);
    const aliceBtn = await screen.findByRole("button", { name: /Alice Chen/i });
    await u.click(aliceBtn);

    await waitFor(() => {
      const raw = localStorage.getItem("aia.auth.v1");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.user.email).toBe("alice@demo.gc.ca");
    });
  });

  it("shows a connection-error alert when /auth/demo/users is unreachable", async () => {
    server.use(
      http.get("*/v1/eva/auth/demo/users", () => HttpResponse.error()),
    );
    renderWithProviders(<Login />);
    await waitFor(() =>
      expect(screen.getByText(/Could not reach the assistant/i)).toBeInTheDocument(),
    );
  });
});
