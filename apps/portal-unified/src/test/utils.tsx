import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeCustomizerProvider } from "@/contexts/ThemeCustomizer";
import { CommandPaletteProvider } from "@/components/CommandPalette";
import { ShortcutsOverlayProvider } from "@/components/ShortcutsOverlay";
import { CoachmarkTourProvider } from "@/components/CoachmarkTour";

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, opts: Options = {}) {
  const { route = "/", ...rest } = opts;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ThemeCustomizerProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={[route]}>
            <ShortcutsOverlayProvider>
              <CoachmarkTourProvider>
                <CommandPaletteProvider>{children}</CommandPaletteProvider>
              </CoachmarkTourProvider>
            </ShortcutsOverlayProvider>
          </MemoryRouter>
        </TooltipProvider>
      </ThemeCustomizerProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...rest });
}

export * from "@testing-library/react";
