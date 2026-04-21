import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import MyWorkspace from "@/pages/MyWorkspace";
import { server } from "@/test/msw/server";

const primeAuth = () => {
  localStorage.setItem(
    "aia.auth.v1",
    JSON.stringify({
      user: {
        user_id: "demo-alice",
        email: "alice@example.org",
        name: "Alice Chen",
        role: "contributor",
        portal_access: ["self-service"],
        workspace_grants: ["ws-oas-act"],
        data_classification_level: "sensitive",
        language: "en",
      },
    }),
  );
};

describe("MyWorkspace: real backend wiring", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeAuth();
  });

  it("renders team members from /teams/{bookingId}/members", async () => {
    const u = userEvent.setup();
    renderWithProviders(<MyWorkspace />);

    await u.click(screen.getByRole("tab", { name: /^team/i }));

    await waitFor(() =>
      expect(screen.getByText("Alice Chen")).toBeInTheDocument(),
    );
    expect(screen.getByText("Bob Martinez")).toBeInTheDocument();
  });

  it("renders documents from /documents", async () => {
    const u = userEvent.setup();
    renderWithProviders(<MyWorkspace />);

    await u.click(screen.getByRole("tab", { name: /^documents/i }));

    await waitFor(() =>
      expect(screen.getByText("oas-s3-residency.pdf")).toBeInTheDocument(),
    );
    expect(screen.getByText("faq-general.txt")).toBeInTheDocument();
  });

  it("POSTs to /teams/{bookingId}/members when inviting", async () => {
    const posts: Array<Record<string, unknown>> = [];
    server.use(
      http.post("*/v1/aia/teams/:bookingId/members", async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          {
            id: "tm-new",
            workspace_id: "ws-oas-act",
            user_id: "u-new",
            email: (posts[0] as { email: string }).email,
            name: (posts[0] as { name: string }).name,
            role: (posts[0] as { role: string }).role,
            added_at: "2026-04-19T00:00:00Z",
            added_by: "demo-alice",
          },
          { status: 201 },
        );
      }),
    );

    const u = userEvent.setup();
    renderWithProviders(<MyWorkspace />);

    await u.click(screen.getByRole("tab", { name: /^team/i }));
    const input = await screen.findByLabelText(/invite a teammate/i);
    await u.type(input, "newhire@acme.com");
    await u.click(screen.getByRole("button", { name: /^invite$/i }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      email: "newhire@acme.com",
      role: "contributor",
    });
  });
});
