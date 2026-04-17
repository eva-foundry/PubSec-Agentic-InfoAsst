import { ReactNode, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Topbar } from "@/components/Topbar";
import { AccentStrip } from "@/components/AccentStrip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PortalSwitcher } from "@/components/PortalSwitcher";
import { SidebarNav, SidebarFooter } from "@/components/SidebarNav";
import { Logo } from "@/components/Logo";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLastRoutePerPortal } from "@/hooks/use-last-route-per-portal";

function SkipLink() {
  const { t } = useTranslation();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-product focus:text-product-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-elegant"
    >
      {t("common.skipToContent")}
    </a>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const reduceMotion = useReducedMotion();
  useLastRoutePerPortal();

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Skip to content for keyboard users */}
      <SkipLink />



      <AppSidebar />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar flex flex-col">
          <div className="px-4 py-4 border-b border-sidebar-border">
            <Logo />
            <div className="mt-3"><PortalSwitcher /></div>
          </div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <AccentStrip />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-hidden focus:outline-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
              className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-6 sm:py-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
