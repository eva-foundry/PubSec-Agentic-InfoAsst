import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeCustomizerProvider } from "@/contexts/ThemeCustomizer";
import { AuthProvider } from "@/contexts/AuthContext";
import { ApiProvider } from "@/contexts/ApiProvider";
import { CommandPaletteProvider } from "@/components/CommandPalette";
import { ShortcutsOverlayProvider } from "@/components/ShortcutsOverlay";
import { CoachmarkTourProvider } from "@/components/CoachmarkTour";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/AppShell";
import { PublicLayout } from "@/components/PublicLayout";
import { RequireAuth } from "@/components/RequireAuth";
import NotFound from "./pages/NotFound.tsx";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Login from "./pages/Login";
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
import type { PortalKey } from "@/lib/api/types";

const queryClient = new QueryClient();

const gated = (el: JSX.Element, portal?: PortalKey) => (
  <RequireAuth portal={portal}>
    <AppShell>{el}</AppShell>
  </RequireAuth>
);
const withPublic = (el: JSX.Element) => <PublicLayout>{el}</PublicLayout>;

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeCustomizerProvider>
        <AuthProvider>
          <ApiProvider>
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
                        <Route path="/login" element={<Login />} />

                        {/* Workspace portal (self-service) */}
                        <Route path="/chat" element={gated(<Chat />, "self-service")} />
                        <Route path="/catalog" element={gated(<Catalog />, "self-service")} />
                        <Route path="/my-workspace" element={gated(<MyWorkspace />, "self-service")} />

                        {/* Admin portal */}
                        <Route path="/onboarding" element={gated(<Onboarding />, "admin")} />
                        <Route path="/models" element={gated(<Models />, "admin")} />
                        <Route path="/compliance" element={gated(<Compliance />, "admin")} />
                        <Route path="/red-team" element={gated(<RedTeam />, "admin")} />

                        {/* Ops portal */}
                        <Route path="/cost" element={gated(<Cost />, "ops")} />
                        <Route path="/aiops" element={gated(<AIOps />, "ops")} />
                        <Route path="/drift" element={gated(<Drift />, "ops")} />
                        <Route path="/liveops" element={gated(<LiveOps />, "ops")} />
                        <Route path="/devops" element={gated(<DevOps />, "ops")} />

                        <Route path="*" element={withPublic(<NotFound />)} />
                      </Routes>
                    </CommandPaletteProvider>
                  </CoachmarkTourProvider>
                </ShortcutsOverlayProvider>
              </BrowserRouter>
            </TooltipProvider>
          </ApiProvider>
        </AuthProvider>
      </ThemeCustomizerProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
