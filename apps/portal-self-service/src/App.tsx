// ---------------------------------------------------------------------------
// App — Portal Self-Service shell with tab navigation
// ---------------------------------------------------------------------------

import { lazy, Suspense, useState, useMemo } from "react";
import { useAuth, SkipLink } from "@eva/ui-kit";
import DemoLogin from "./pages/DemoLogin";
import DocumentsPage from "./pages/DocumentsPage";
import WorkspaceCatalog from "./pages/WorkspaceCatalog";
import MyBookings from "./pages/MyBookings";

const ChatPage = lazy(() => import("./pages/ChatPage"));

type Lang = "en" | "fr";
type Page = "chat" | "documents" | "workspaces" | "bookings" | "login";

const NAV_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    chat: "Chat",
    documents: "Documents",
    workspaces: "Workspaces",
    bookings: "My Bookings",
    login: "Login",
    signedInAs: "Signed in as",
    signOut: "Sign Out",
    title: "EVA Self-Service Portal",
    language: "Langue",
  },
  fr: {
    chat: "Clavardage",
    documents: "Documents",
    workspaces: "Espaces de travail",
    bookings: "Mes reservations",
    login: "Connexion",
    signedInAs: "Connecte(e) en tant que",
    signOut: "Se deconnecter",
    title: "Portail libre-service EVA",
    language: "Language",
  },
};

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const [lang, setLang] = useState<Lang>("en");
  const [activePage, setActivePage] = useState<Page>("chat");
  const t = NAV_LABELS[lang];
  const toggleLang = () => setLang((p) => (p === "en" ? "fr" : "en"));

  // Available pages based on auth
  const pages = useMemo<Page[]>(() => {
    if (!isAuthenticated) return ["login"];
    return ["chat", "documents", "workspaces", "bookings"];
  }, [isAuthenticated]);

  // If not authenticated, show login
  if (!isAuthenticated) {
    return <DemoLogin />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLink targetId="main-content" language={lang} />
      {/* Top navigation bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">{t.title}</h1>
            <nav className="flex gap-1" role="navigation" aria-label="Main">
              {pages.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setActivePage(page)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                    ${activePage === page
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  aria-current={activePage === page ? "page" : undefined}
                >
                  {t[page]}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleLang}
              className="text-sm font-medium text-blue-700 underline hover:text-blue-900"
              aria-label={t.language}
            >
              {lang === "en" ? "Francais" : "English"}
            </button>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {t.signedInAs} <strong>{user.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t.signOut}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main id="main-content">
        {activePage === "chat" && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-500">Loading chat...</p>
              </div>
            }
          >
            <ChatPage />
          </Suspense>
        )}
        {activePage === "documents" && <DocumentsPage />}
        {activePage === "workspaces" && <WorkspaceCatalog lang={lang} />}
        {activePage === "bookings" && <MyBookings lang={lang} />}
      </main>
    </div>
  );
}

export default App;
