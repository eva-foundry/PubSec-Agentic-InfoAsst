// ---------------------------------------------------------------------------
// App — Portal 2 Business Admin shell with GC identity and tab navigation
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useAuth, SkipLink } from '@eva/ui-kit';
import { motion, AnimatePresence } from 'framer-motion';

import AdminDashboard from './pages/AdminDashboard';
import ClientOnboarding from './pages/ClientOnboarding';
import WorkspaceManagement from './pages/WorkspaceManagement';
import ModelRegistry from './pages/ModelRegistry';
import PromptVersioning from './pages/PromptVersioning';

type Lang = 'en' | 'fr';
type Page = 'dashboard' | 'clients' | 'workspaces' | 'models' | 'prompts';

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

const NAV_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    title: 'EVA Business Admin',
    dashboard: 'Dashboard',
    clients: 'Clients',
    workspaces: 'Workspaces',
    models: 'Models',
    prompts: 'Prompts',
    signedInAs: 'Signed in as',
    signOut: 'Sign Out',
    signIn: 'Sign In',
    language: 'Langue',
    accessDenied: 'Access Denied',
    accessDeniedMsg: 'You must have the admin role to access this portal.',
    currentRole: 'Your current role',
    selectUser: 'Select a demo user',
    loading: 'Loading users...',
    gcHeader: 'Government of Canada',
    gcFooter: 'Government of Canada',
  },
  fr: {
    title: 'EVA Administration',
    dashboard: 'Tableau de bord',
    clients: 'Clients',
    workspaces: 'Espaces de travail',
    models: 'Modeles',
    prompts: 'Prompts',
    signedInAs: 'Connecte(e) en tant que',
    signOut: 'Se deconnecter',
    signIn: 'Se connecter',
    language: 'Language',
    accessDenied: 'Acces refuse',
    accessDeniedMsg: 'Vous devez avoir le role administrateur pour acceder a ce portail.',
    currentRole: 'Votre role actuel',
    selectUser: 'Selectionnez un utilisateur',
    loading: 'Chargement des utilisateurs...',
    gcHeader: 'Gouvernement du Canada',
    gcFooter: 'Gouvernement du Canada',
  },
};

const PAGES: Page[] = ['dashboard', 'clients', 'workspaces', 'models', 'prompts'];

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

// ---------------------------------------------------------------------------
// Demo login (inline, lightweight)
// ---------------------------------------------------------------------------

function DemoLoginInline({ lang, onLogin }: { lang: Lang; onLogin: (email: string) => void }) {
  const t = NAV_LABELS[lang];
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState<Array<{ email: string; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/v1/eva/auth/demo/users')
      .then((r) => r.json())
      .then((data) => {
        setUsers(data);
        if (data.length > 0) setEmail(data[0].email);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">{t.title}</h1>
        <label htmlFor="admin-login-select" className="mb-2 block text-sm font-medium text-gray-700">
          {t.selectUser}
        </label>
        <select
          id="admin-login-select"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {users.map((u) => (
            <option key={u.email} value={u.email}>
              {u.name} ({u.email}) - {u.role}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onLogin(email)}
          className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {t.signIn}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access Denied
// ---------------------------------------------------------------------------

function AccessDenied({ lang, role, onLogout }: { lang: Lang; role: string; onLogout: () => void }) {
  const t = NAV_LABELS[lang];
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <div className="mb-4 text-4xl text-red-400" aria-hidden="true">&#9888;</div>
        <h1 className="mb-2 text-xl font-semibold text-red-800">{t.accessDenied}</h1>
        <p className="mb-4 text-sm text-red-600">{t.accessDeniedMsg}</p>
        <p className="mb-6 text-sm text-red-500">
          {t.currentRole}: <strong>{role}</strong>
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          {t.signOut}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [lang, setLang] = useState<Lang>('en');
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const t = NAV_LABELS[lang];
  const toggleLang = () => setLang((p) => (p === 'en' ? 'fr' : 'en'));

  // If not authenticated, show login
  if (!isAuthenticated) {
    return (
      <div>
        <div className="flex justify-end px-4 py-2">
          <button
            type="button"
            onClick={toggleLang}
            className="text-sm font-medium text-blue-700 underline hover:text-blue-900"
            aria-label={t.language}
          >
            {lang === 'en' ? 'Francais' : 'English'}
          </button>
        </div>
        <DemoLoginInline lang={lang} onLogin={login} />
      </div>
    );
  }

  // Admin role check
  if (user?.role !== 'admin') {
    return (
      <div>
        <div className="flex justify-end px-4 py-2">
          <button
            type="button"
            onClick={toggleLang}
            className="text-sm font-medium text-blue-700 underline hover:text-blue-900"
            aria-label={t.language}
          >
            {lang === 'en' ? 'Francais' : 'English'}
          </button>
        </div>
        <AccessDenied lang={lang} role={user?.role ?? 'unknown'} onLogout={logout} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SkipLink targetId="main-content" language={lang} />
      {/* GC Header bar */}
      <div className="border-b border-red-700 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5">
          <span className="text-xs font-medium text-gray-700">{t.gcHeader}</span>
          <button
            type="button"
            onClick={toggleLang}
            className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
            aria-label={t.language}
          >
            {lang === 'en' ? 'Francais' : 'English'}
          </button>
        </div>
      </div>

      {/* Main navigation bar */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">{t.title}</h1>
            <nav className="flex gap-1" role="navigation" aria-label="Main">
              {PAGES.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setActivePage(page)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activePage === page
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-current={activePage === page ? 'page' : undefined}
                >
                  {t[page]}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {t.signedInAs} <strong>{user.name}</strong>
            </span>
            <span className="inline-flex rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-xs font-medium text-red-800">
              {user.role}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t.signOut}
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={activePage} {...pageTransition}>
            {activePage === 'dashboard' && <AdminDashboard lang={lang} />}
            {activePage === 'clients' && <ClientOnboarding lang={lang} />}
            {activePage === 'workspaces' && <WorkspaceManagement lang={lang} />}
            {activePage === 'models' && <ModelRegistry lang={lang} />}
            {activePage === 'prompts' && <PromptVersioning lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* GC Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <p className="text-xs text-gray-500">{t.gcFooter}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
