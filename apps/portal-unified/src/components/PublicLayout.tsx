import { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sun, Moon, ArrowRight, Github } from "lucide-react";
import { useCustomizer } from "@/contexts/ThemeCustomizer";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

const NAV = [
  { to: "/", labelKey: "nav.home" },
  { to: "/pricing", labelKey: "nav.pricing" },
  { to: "/about", labelKey: "nav.about" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useCustomizer();
  const loc = useLocation();
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-product focus:text-product-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-elegant"
      >
        {t("common.skipToContent")}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-[1200px] flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0"><Logo /></Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )
                }
              >
                {t(n.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={t("topbar.toggleTheme")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild size="sm" className="bg-gradient-accent shadow-elegant">
              <Link to="/chat">
                {t("publicLayout.openApp")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
            className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-10 sm:py-14"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2">
            <Logo />
            <p className="mt-3 text-muted-foreground max-w-sm">
              {t("publicLayout.footerTagline")}
            </p>
          </div>
          <div>
            <div className="font-semibold mb-2">{t("publicLayout.product")}</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/chat" className="hover:text-foreground">{t("nav.chat")}</Link></li>
              <li><Link to="/catalog" className="hover:text-foreground">{t("nav.catalog")}</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground">{t("nav.pricing")}</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">{t("publicLayout.company")}</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground">{t("nav.about")}</Link></li>
              <li><a href="#" className="hover:text-foreground inline-flex items-center gap-1.5"><Github className="h-3.5 w-3.5" />GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("publicLayout.copyright", { year: new Date().getFullYear() })}</span>
            <span>Forensic-grade RAG · Compliance as code</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
