import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import Onboarding from "@/pages/Onboarding";
import { server } from "@/test/msw/server";

const primeAdmin = () => {
  localStorage.setItem(
    "aia.auth.v1",
    JSON.stringify({
      user: {
        user_id: "demo-carol",
        email: "carol@demo.gc.ca",
        name: "Carol Admin",
        role: "admin",
        portal_access: ["self-service", "admin"],
        workspace_grants: ["all"],
        data_classification_level: "protected_b",
        language: "en",
      },
    }),
  );
};

describe("Onboarding wizard", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    localStorage.removeItem("aia-onboarding-progress");
    primeAdmin();
  });

  it("POSTs to /admin/tenants/init when Finish is clicked", async () => {
    const posts: Array<Record<string, unknown>> = [];
    server.use(
      http.post("*/v1/eva/admin/tenants/init", async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { client_id: "cl-abc", interview_id: "iv-xyz", status: "initialized" },
          { status: 201 },
        );
      }),
    );

    // Pre-complete all 6 steps so the Finish button shows up.
    localStorage.setItem(
      "aia-onboarding-progress",
      JSON.stringify(["org", "class", "assurance", "templates", "roles", "kickoff"]),
    );

    const u = userEvent.setup();
    renderWithProviders(<Onboarding />);

    await u.click(screen.getByRole("button", { name: /finish onboarding/i }));
    await u.type(screen.getByLabelText(/organization name/i), "Acme Public");
    await u.type(screen.getByLabelText(/primary admin email/i), "admin@acme.gc.ca");
    await u.click(screen.getByRole("button", { name: /initialize tenant/i }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      org_name: "Acme Public",
      primary_admin_email: "admin@acme.gc.ca",
      default_classification: "protected_a",
      default_mode: "Advisory",
      preferred_archetype: "kb",
    });
  });

  it("blocks submit when required fields are empty", async () => {
    const posts: Array<Record<string, unknown>> = [];
    server.use(
      http.post("*/v1/eva/admin/tenants/init", async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ client_id: "cl-test", interview_id: "iv-test", status: "initialized" }, { status: 201 });
      }),
    );

    localStorage.setItem(
      "aia-onboarding-progress",
      JSON.stringify(["org", "class", "assurance", "templates", "roles", "kickoff"]),
    );

    const u = userEvent.setup();
    renderWithProviders(<Onboarding />);

    await u.click(screen.getByRole("button", { name: /finish onboarding/i }));
    // No org/email typed — click Initialize.
    await u.click(screen.getByRole("button", { name: /initialize tenant/i }));

    // Give any in-flight request a tick. The client-side validation should have blocked it.
    await new Promise((r) => setTimeout(r, 50));
    expect(posts).toHaveLength(0);
  });
});
