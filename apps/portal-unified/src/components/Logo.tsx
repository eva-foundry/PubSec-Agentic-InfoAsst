export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="AIA logo">
        <defs>
          <linearGradient id="aia-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--product))" />
          </linearGradient>
        </defs>
        <circle cx="8" cy="8" r="3" fill="url(#aia-g)" />
        <circle cx="24" cy="8" r="3" fill="url(#aia-g)" opacity="0.85" />
        <circle cx="16" cy="20" r="4" fill="url(#aia-g)" />
        <circle cx="6" cy="26" r="2.5" fill="url(#aia-g)" opacity="0.7" />
        <circle cx="26" cy="26" r="2.5" fill="url(#aia-g)" opacity="0.7" />
        <line x1="8" y1="8" x2="16" y2="20" stroke="url(#aia-g)" strokeWidth="1.2" />
        <line x1="24" y1="8" x2="16" y2="20" stroke="url(#aia-g)" strokeWidth="1.2" />
        <line x1="16" y1="20" x2="6" y2="26" stroke="url(#aia-g)" strokeWidth="1.2" />
        <line x1="16" y1="20" x2="26" y2="26" stroke="url(#aia-g)" strokeWidth="1.2" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight">AIA</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">Agentic IA</div>
      </div>
    </div>
  );
}
