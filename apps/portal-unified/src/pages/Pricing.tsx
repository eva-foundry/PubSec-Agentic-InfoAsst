import { PRICING } from "@/lib/mock-data";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPARE = [
  { feature: "Workspaces", solo: "1", team: "10", scale: "Unlimited" },
  { feature: "Indexes", solo: "3", team: "Unlimited", scale: "Unlimited" },
  { feature: "Mode", solo: "Advisory only", team: "Advisory + HITL", scale: "All + custom" },
  { feature: "Model registry", solo: false, team: true, scale: true },
  { feature: "Prompt versioning", solo: false, team: true, scale: true },
  { feature: "Evaluation arena", solo: false, team: false, scale: true },
  { feature: "SSO + SCIM", solo: false, team: false, scale: true },
  { feature: "Custom archetypes", solo: false, team: false, scale: true },
  { feature: "Audit export", solo: false, team: "CSV", scale: "CSV + evidence bundle" },
  { feature: "Dedicated ops dashboards", solo: false, team: false, scale: true },
  { feature: "Support", solo: "Community", team: "Email", scale: "24/7 SLA" },
];

function Cell({ v, includedLabel, notIncludedLabel }: { v: string | boolean; includedLabel: string; notIncludedLabel: string }) {
  if (v === true) return <Check className="h-4 w-4 text-success mx-auto" aria-label={includedLabel} />;
  if (v === false) return <Minus className="h-4 w-4 text-muted-foreground/50 mx-auto" aria-label={notIncludedLabel} />;
  return <span className="text-sm">{v}</span>;
}

export default function Pricing() {
  const { t } = useTranslation();
  return (
    <div className="space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold">{t("pricing.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRICING.map((p) => (
          <div
            key={p.name}
            className={cn(
              "ui-card rounded-lg p-6 relative flex flex-col",
              p.featured && "ring-2 ring-product shadow-elegant"
            )}
          >
            {p.featured && <Badge className="absolute -top-3 left-6 bg-product text-product-foreground">{t("pricing.featured")}</Badge>}
            <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{p.name}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.blurb}</p>
            <ul className="mt-6 space-y-2 text-sm flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /><span>{f}</span>
                </li>
              ))}
            </ul>
            <Button className={cn("mt-6", p.featured && "bg-gradient-accent")} variant={p.featured ? "default" : "outline"}>
              {p.cta}
            </Button>
          </div>
        ))}
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-bold">{t("pricing.compare")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium">{t("pricing.feature")}</th>
                <th className="p-3 font-medium">Solo</th>
                <th className="p-3 font-medium">Team</th>
                <th className="p-3 font-medium">Scale</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{row.feature}</td>
                  <td className="p-3 text-center"><Cell v={row.solo} includedLabel={t("pricing.included")} notIncludedLabel={t("pricing.notIncluded")} /></td>
                  <td className="p-3 text-center"><Cell v={row.team} includedLabel={t("pricing.included")} notIncludedLabel={t("pricing.notIncluded")} /></td>
                  <td className="p-3 text-center"><Cell v={row.scale} includedLabel={t("pricing.included")} notIncludedLabel={t("pricing.notIncluded")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
