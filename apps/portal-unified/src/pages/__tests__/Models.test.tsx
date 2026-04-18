import { beforeEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import Models from "@/pages/Models";
import { server } from "@/test/msw/server";
import { ADMIN_MODELS_FIXTURE } from "@/test/msw/fixtures";

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

describe("Models toggle", () => {
  beforeEach(() => {
    localStorage.removeItem("aia.auth.v1");
    primeAdmin();
  });

  it("passes is_active=true in the query string when enabling a model", async () => {
    const calls: Array<{ id: string; isActive: string | null }> = [];
    server.use(
      http.post("*/v1/eva/admin/models/:id/toggle", ({ params, request }) => {
        const id = params.id as string;
        const isActive = new URL(request.url).searchParams.get("is_active");
        calls.push({ id, isActive });
        const model = ADMIN_MODELS_FIXTURE.find((m) => m.id === id)!;
        return HttpResponse.json({ ...model, is_active: isActive === "true" });
      }),
    );

    const u = userEvent.setup();
    renderWithProviders(<Models />);

    // gpt-5.1 starts inactive in the fixture — its switch sits at checked=false.
    await waitFor(() =>
      expect(screen.getByLabelText(/Enable gpt-5\.1/i)).toBeInTheDocument(),
    );
    await u.click(screen.getByLabelText(/Enable gpt-5\.1/i));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ id: "m-gpt-51", isActive: "true" });
  });
});
