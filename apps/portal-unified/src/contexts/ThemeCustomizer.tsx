import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AccentKey = "indigo" | "blue" | "violet" | "emerald" | "rose" | "cyan";
export type ProductKey = "violet" | "indigo" | "blue" | "teal" | "fuchsia";
export type CardStyle = "glass" | "solid" | "bordered";
export type Radius = "sharp" | "default" | "rounded";
export type Spacing = "compact" | "default" | "spacious";
export type Density = "reader" | "analyst";
export type PortalMode = "workspace" | "admin" | "ops";
export type Lang = "en" | "fr" | "es";
export type ThemeMode = "dark" | "light";

const ACCENTS: Record<AccentKey, { hsl: string; hex: string }> = {
  indigo:  { hsl: "239 84% 67%", hex: "#6366F1" },
  blue:    { hsl: "217 91% 60%", hex: "#3B82F6" },
  violet:  { hsl: "258 90% 66%", hex: "#8B5CF6" },
  emerald: { hsl: "160 84% 39%", hex: "#10B981" },
  rose:    { hsl: "350 89% 60%", hex: "#F43F5E" },
  cyan:    { hsl: "189 94% 43%", hex: "#06B6D4" },
};
const PRODUCTS: Record<ProductKey, { hsl: string; hex: string }> = {
  violet:   { hsl: "258 90% 66%", hex: "#8B5CF6" },
  indigo:   { hsl: "239 84% 67%", hex: "#6366F1" },
  blue:     { hsl: "217 91% 60%", hex: "#3B82F6" },
  teal:     { hsl: "172 76% 40%", hex: "#14B8A6" },
  fuchsia:  { hsl: "292 84% 61%", hex: "#D946EF" },
};

interface CustomizerState {
  accent: AccentKey;
  product: ProductKey;
  cardStyle: CardStyle;
  radius: Radius;
  spacing: Spacing;
  density: Density;
  portal: PortalMode;
  lang: Lang;
  theme: ThemeMode;
  assurance: "Advisory" | "Decision-informing";
  setAccent: (a: AccentKey) => void;
  setProduct: (p: ProductKey) => void;
  setCardStyle: (c: CardStyle) => void;
  setRadius: (r: Radius) => void;
  setSpacing: (s: Spacing) => void;
  setDensity: (d: Density) => void;
  setPortal: (p: PortalMode) => void;
  setLang: (l: Lang) => void;
  setTheme: (t: ThemeMode) => void;
  setAssurance: (a: "Advisory" | "Decision-informing") => void;
  reset: () => void;
}

const Ctx = createContext<CustomizerState | null>(null);
const KEY = "aia.customizer.v1";

interface CustomizerData {
  accent: AccentKey;
  product: ProductKey;
  cardStyle: CardStyle;
  radius: Radius;
  spacing: Spacing;
  density: Density;
  portal: PortalMode;
  lang: Lang;
  theme: ThemeMode;
  assurance: "Advisory" | "Decision-informing";
}

const DEFAULTS: CustomizerData = {
  accent: "indigo",
  product: "violet",
  cardStyle: "glass",
  radius: "default",
  spacing: "default",
  density: "reader",
  portal: "workspace",
  lang: "en",
  theme: "dark",
  assurance: "Advisory",
};

export function ThemeCustomizerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
    const root = document.documentElement;
    // theme
    root.classList.toggle("dark", state.theme === "dark");
    // accent + product
    root.style.setProperty("--accent", ACCENTS[state.accent].hsl);
    root.style.setProperty("--ring", ACCENTS[state.accent].hsl);
    root.style.setProperty("--primary", ACCENTS[state.accent].hsl);
    root.style.setProperty("--sidebar-ring", ACCENTS[state.accent].hsl);
    root.style.setProperty("--product", PRODUCTS[state.product].hsl);
    root.style.setProperty("--sidebar-primary", PRODUCTS[state.product].hsl);
    // radius
    const r = state.radius === "sharp" ? "0.25rem" : state.radius === "rounded" ? "1rem" : "0.625rem";
    root.style.setProperty("--radius", r);
    // spacing
    const sc = state.spacing === "compact" ? "0.85" : state.spacing === "spacious" ? "1.15" : "1";
    root.style.setProperty("--spacing-scale", sc);
    // card style + density attrs
    root.setAttribute("data-card-style", state.cardStyle);
    root.setAttribute("data-density", state.density);
    root.setAttribute("data-spacing", state.spacing);
    root.setAttribute("data-lang", state.lang);
  }, [state]);

  const value: CustomizerState = {
    ...state,
    setAccent: (accent) => setState((s: CustomizerData) => ({ ...s, accent })),
    setProduct: (product) => setState((s: CustomizerData) => ({ ...s, product })),
    setCardStyle: (cardStyle) => setState((s: CustomizerData) => ({ ...s, cardStyle })),
    setRadius: (radius) => setState((s: CustomizerData) => ({ ...s, radius })),
    setSpacing: (spacing) => setState((s: CustomizerData) => ({ ...s, spacing })),
    setDensity: (density) => setState((s: CustomizerData) => ({ ...s, density })),
    setPortal: (portal) => setState((s: CustomizerData) => ({ ...s, portal })),
    setLang: (lang) => setState((s: CustomizerData) => ({ ...s, lang })),
    setTheme: (theme) => setState((s: CustomizerData) => ({ ...s, theme })),
    setAssurance: (assurance) => setState((s: CustomizerData) => ({ ...s, assurance })),
    reset: () => setState(DEFAULTS),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomizer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomizer must be inside ThemeCustomizerProvider");
  return ctx;
}

export const ACCENT_SWATCHES = ACCENTS;
export const PRODUCT_SWATCHES = PRODUCTS;
