import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FRAMEWORKS } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { HowItWorksDemo } from "@/components/HowItWorksDemo";

export default function Landing() {
  const { t } = useTranslation();
  const modes = [
    { name: t("landing.modeWorkspace"), color: "from-accent to-product", desc: t("landing.modeWorkspaceDesc") },
    { name: t("landing.modeAdmin"), color: "from-product to-accent", desc: t("landing.modeAdminDesc") },
    { name: t("landing.modeOps"), color: "from-accent via-product to-accent", desc: t("landing.modeOpsDesc") },
  ];

  return (
    <div className="space-y-24">
      {/* Hero */}
      <section className="relative pt-8 pb-12 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[420px] bg-gradient-glow pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="outline" className="mb-6 border-product/40 bg-product/10 text-product hover:bg-product/15">
              <Sparkles className="mr-1.5 h-3 w-3" /> {t("landing.heroBadge")}
            </Badge>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
              {t("landing.heroTitleA")}<br />
              <span className="gradient-text">{t("landing.heroTitleB")}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="bg-gradient-accent hover:opacity-95 shadow-elegant">
                <Link to="/chat">{t("landing.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">{t("landing.ctaSecondary")}</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {FRAMEWORKS.map((f) => (
                <Badge key={f} variant="secondary" className="font-normal text-xs">{f}</Badge>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works — live demo */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold">{t("landing.howItWorks")}</h2>
          <p className="mt-2 text-muted-foreground">{t("landing.howSubtitle")}</p>
        </div>
        <HowItWorksDemo />
      </section>

      {/* Three modes */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold">{t("landing.modesTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("landing.modesSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modes.map((m) => (
            <div key={m.name} className="ui-card rounded-lg p-6">
              <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${m.color} mb-4`} />
              <div className="text-lg font-bold">{m.name}</div>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="ui-card rounded-lg p-10 text-center bg-gradient-to-br from-card to-product/5">
        <h2 className="text-3xl font-extrabold">{t("landing.ctaTitle")}</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          {t("landing.ctaSubtitle")}
        </p>
        <Button asChild size="lg" className="mt-6 bg-gradient-accent shadow-elegant">
          <Link to="/chat">{t("landing.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>
    </div>
  );
}
