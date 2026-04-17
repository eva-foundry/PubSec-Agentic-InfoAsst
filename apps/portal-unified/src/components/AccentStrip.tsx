import { useCustomizer, PortalMode } from "@/contexts/ThemeCustomizer";

const STRIPS: Record<PortalMode, string> = {
  // Workspace: indigo → violet (calm, end-user)
  workspace: "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--product)))",
  // Admin: amber → product (authority)
  admin: "linear-gradient(90deg, hsl(var(--warning)), hsl(var(--product)) 60%, hsl(var(--accent)))",
  // Ops: triple-stop pulsing operational vibe
  ops: "linear-gradient(90deg, hsl(var(--success)), hsl(var(--accent)) 50%, hsl(var(--product)))",
};

export function AccentStrip() {
  const { portal } = useCustomizer();
  return <div aria-hidden className="h-[2px] w-full transition-[background] duration-500" style={{ background: STRIPS[portal] }} />;
}
