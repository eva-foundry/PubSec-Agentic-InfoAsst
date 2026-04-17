import { useCustomizer, ACCENT_SWATCHES, PRODUCT_SWATCHES, AccentKey, ProductKey, CardStyle, Radius, Spacing, Density } from "@/contexts/ThemeCustomizer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Palette, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function Swatch({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "h-7 w-7 rounded-full border-2 transition-all",
        active ? "border-foreground scale-110" : "border-transparent hover:scale-105"
      )}
      style={{ background: color }}
    />
  );
}

function Toggle3<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/60 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "rounded px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >{o.label}</button>
      ))}
    </div>
  );
}

function Toggle2<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/60 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "rounded px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >{o.label}</button>
      ))}
    </div>
  );
}

export function ThemeCustomizerButton() {
  const c = useCustomizer();
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("themeCustomizer.open")}>
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4 space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("themeCustomizer.portalAccent")}</div>
          <div className="flex items-center gap-2">
            {(Object.keys(ACCENT_SWATCHES) as AccentKey[]).map((k) => (
              <Swatch key={k} label={`Accent ${k}`} color={ACCENT_SWATCHES[k].hex} active={c.accent === k} onClick={() => c.setAccent(k)} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product color</div>
          <div className="flex items-center gap-2">
            {(Object.keys(PRODUCT_SWATCHES) as ProductKey[]).map((k) => (
              <Swatch key={k} label={`Product ${k}`} color={PRODUCT_SWATCHES[k].hex} active={c.product === k} onClick={() => c.setProduct(k)} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card style</div>
          <Toggle3<CardStyle>
            value={c.cardStyle}
            onChange={c.setCardStyle}
            options={[{ id: "glass", label: "Glass" }, { id: "solid", label: "Solid" }, { id: "bordered", label: "Bordered" }]}
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("themeCustomizer.radius")}</div>
          <Toggle3<Radius>
            value={c.radius}
            onChange={c.setRadius}
            options={[{ id: "sharp", label: t("themeCustomizer.sharp") }, { id: "default", label: t("themeCustomizer.default") }, { id: "rounded", label: t("themeCustomizer.rounded") }]}
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("themeCustomizer.spacing")}</div>
          <Toggle3<Spacing>
            value={c.spacing}
            onChange={c.setSpacing}
            options={[{ id: "compact", label: t("themeCustomizer.compact") }, { id: "default", label: t("themeCustomizer.default") }, { id: "spacious", label: t("themeCustomizer.spacious") }]}
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("themeCustomizer.density")}</div>
          <Toggle2<Density>
            value={c.density}
            onChange={c.setDensity}
            options={[{ id: "reader", label: t("themeCustomizer.reader") }, { id: "analyst", label: t("themeCustomizer.analyst") }]}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => { c.reset(); toast.success(t("themeCustomizer.resetToast")); }}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> {t("themeCustomizer.resetToDefaults")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
