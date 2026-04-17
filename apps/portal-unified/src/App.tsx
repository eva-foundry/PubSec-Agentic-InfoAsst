import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeCustomizerProvider } from "@/contexts/ThemeCustomizer";
import { CommandPaletteProvider } from "@/components/CommandPalette";
import { ShortcutsOverlayProvider } from "@/components/ShortcutsOverlay";
import { CoachmarkTourProvider } from "@/components/CoachmarkTour";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/AppShell";
import { PublicLayout } from "@/components/PublicLayout";
import NotFound from "./pages/NotFound.tsx";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Chat from "./pages/Chat";
import Catalog from "./pages/Catalog";
import MyWorkspace from "./pages/MyWorkspace";
import Onboarding from "./pages/Onboarding";
import Models from "./pages/Models";
import Cost from "./pages/Cost";
import AIOps from "./pages/AIOps";
import LiveOps from "./pages/LiveOps";
import DevOps from "./pages/DevOps";
import Compliance from "./pages/Compliance";
import RedTeam from "./pages/RedTeam";
import Drift from "./pages/Drift";

const queryClient = new QueryClient();

const withShell = (el: JSX.Element) => <AppShell>{el}</AppShell>;
const withPublic = (el: JSX.Element) => <PublicLayout>{el}</PublicLayout>;

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeCustomizerProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ShortcutsOverlayProvider>
              <CoachmarkTourProvider>
                <CommandPaletteProvider>
                  <Routes>
                    {/* Marketing — public layout with top nav + footer */}
                    <Route path="/" element={withPublic(<Landing />)} />
                    <Route path="/pricing" element={withPublic(<Pricing />)} />
                    <Route path="/about" element={withPublic(<About />)} />

                    {/* App — sidebar shell */}
                    <Route path="/chat" element={withShell(<Chat />)} />
                    <Route path="/catalog" element={withShell(<Catalog />)} />
                    <Route path="/my-workspace" element={withShell(<MyWorkspace />)} />
                    <Route path="/onboarding" element={withShell(<Onboarding />)} />
                    <Route path="/models" element={withShell(<Models />)} />
                    <Route path="/cost" element={withShell(<Cost />)} />
                    <Route path="/aiops" element={withShell(<AIOps />)} />
                    <Route path="/drift" element={withShell(<Drift />)} />
                    <Route path="/liveops" element={withShell(<LiveOps />)} />
                    <Route path="/devops" element={withShell(<DevOps />)} />
                    <Route path="/compliance" element={withShell(<Compliance />)} />
                    <Route path="/red-team" element={withShell(<RedTeam />)} />

                    <Route path="*" element={withPublic(<NotFound />)} />
                  </Routes>
                </CommandPaletteProvider>
              </CoachmarkTourProvider>
            </ShortcutsOverlayProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeCustomizerProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
