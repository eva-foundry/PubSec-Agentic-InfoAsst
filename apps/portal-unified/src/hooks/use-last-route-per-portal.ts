import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCustomizer, PortalMode } from "@/contexts/ThemeCustomizer";
import { NAV } from "@/lib/nav-config";

const STORAGE_KEY = "aia.lastRoutePerPortal.v1";

/** Fallback landing route when no last-route is stored for a portal. */
const PORTAL_DEFAULT: Record<PortalMode, string> = {
  workspace: "/chat",
  admin: "/onboarding",
  ops: "/cost",
};

/** Routes that "belong" to each portal, derived from the sidebar nav config. */
const PORTAL_ROUTES: Record<PortalMode, Set<string>> = {
  workspace: new Set(NAV.workspace.map((n) => n.to)),
  admin: new Set(NAV.admin.map((n) => n.to)),
  ops: new Set(NAV.ops.map((n) => n.to)),
};

function readMap(): Partial<Record<PortalMode, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Partial<Record<PortalMode, string>>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/**
 * Tracks the last app route the user visited for each portal mode and restores
 * it when they switch portals. Mounted once inside the AppShell.
 *
 * - On portal change → navigate to the stored route for that portal (or the
 *   portal's default landing page).
 * - On route change within an in-portal route → persist as the new "last route"
 *   for the current portal.
 *
 * Routes outside the portal set (e.g. landing, pricing) are intentionally
 * ignored so they don't overwrite the user's working location.
 */
export function useLastRoutePerPortal() {
  const { portal } = useCustomizer();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prevPortalRef = useRef<PortalMode>(portal);

  // Persist the current pathname under the active portal whenever it changes,
  // but only for routes that belong to that portal.
  useEffect(() => {
    if (PORTAL_ROUTES[portal].has(pathname)) {
      const map = readMap();
      if (map[portal] !== pathname) {
        writeMap({ ...map, [portal]: pathname });
      }
    }
  }, [pathname, portal]);

  // When the portal changes, restore that portal's last route.
  useEffect(() => {
    if (prevPortalRef.current === portal) return;
    prevPortalRef.current = portal;
    const map = readMap();
    const target = map[portal] ?? PORTAL_DEFAULT[portal];
    if (target && target !== pathname) {
      navigate(target);
    }
    // We intentionally exclude `pathname` from deps: we only want this to fire
    // on real portal changes, not on every navigation within the portal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, navigate]);
}
