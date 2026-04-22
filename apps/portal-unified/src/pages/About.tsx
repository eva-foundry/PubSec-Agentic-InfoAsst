import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Github } from "lucide-react";

const PRINCIPLES = [
  "Forensic-grade audit trails",
  "Compliance as code",
  "Confidence disclosure on every answer",
  "Explainability built into the UI",
  "Graceful degradation under failure",
  "Multi-agent conflict resolution",
  "Continuous feedback loops",
  "Versioned models, prompts, and corpora",
  "Sandbox testing before production",
];

const LAYERS = [
  { n: "01", name: "Experience", desc: "UI, accessibility, three operator modes" },
  { n: "02", name: "Gateway", desc: "AuthN/Z, rate limits, request shaping" },
  { n: "03", name: "Orchestrator", desc: "Plan / retrieve / reason / verify graph" },
  { n: "04", name: "Guardrails", desc: "Safety, prompt injection, jailbreak, PII" },
  { n: "05", name: "Models", desc: "LLM registry, embeddings, rerankers" },
  { n: "06", name: "Knowledge", desc: "Indexes, document store, citation graph" },
];

export default function About() {
  const { t } = useTranslation();
  return (
    <div className="space-y-16 max-w-3xl mx-auto">
      <section>
        <h1 className="text-4xl font-extrabold">{t("about.title")}</h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{t("about.intro")}</p>
      </section>

      <section>
        <h2 className="text-2xl font-extrabold mb-4">{t("about.architectureTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LAYERS.map((l) => (
            <div key={l.n} className="ui-card rounded-lg p-4">
              <div className="text-[10px] font-mono text-muted-foreground">{t("about.layerLabel")} {l.n}</div>
              <div className="mt-1 font-bold">{l.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{l.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-extrabold mb-4">{t("about.principlesTitle")}</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRINCIPLES.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-product shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-extrabold mb-4">{t("about.methodologyTitle")}</h2>
        <p className="text-muted-foreground leading-relaxed">{t("about.methodology")}</p>
      </section>

      <section className="ui-card rounded-lg p-6">
        <h2 className="text-2xl font-extrabold mb-4">{t("about.contactTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
          <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-product" /> hello@aia.example</div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-product" /> Remote — global</div>
          <div className="flex items-center gap-2"><Github className="h-4 w-4 text-product" /> github.com/aia</div>
        </div>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); alert(t("about.messageSent")); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label htmlFor="name">{t("about.name")}</Label><Input id="name" required /></div>
            <div><Label htmlFor="email">{t("about.email")}</Label><Input id="email" type="email" required /></div>
          </div>
          <div><Label htmlFor="msg">{t("about.message")}</Label><Textarea id="msg" rows={4} required /></div>
          <Button type="submit" className="bg-gradient-accent">{t("about.sendMessage")}</Button>
        </form>
      </section>
    </div>
  );
}
