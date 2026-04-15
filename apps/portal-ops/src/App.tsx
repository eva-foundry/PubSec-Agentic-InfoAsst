// ---------------------------------------------------------------------------
// App — Portal 3 Operations & Support shell with GC identity and tab nav
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useAuth, SkipLink } from '@eva/ui-kit';
import { motion, AnimatePresence } from 'framer-motion';

import FinOpsDashboard from './pages/FinOpsDashboard';
import AIOpsMonitor from './pages/AIOpsMonitor';
import LiveOpsHealth from './pages/LiveOpsHealth';
import DevOpsPipelines from './pages/DevOpsPipelines';

type Lang = 'en' | 'fr';
type Page = 'finops' | 'aiops' | 'liveops' | 'devops';

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

const NAV_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    title: 'EVA Operations & Support',
    finops: 'FinOps',
    aiops: 'AIOps',
    liveops: 'LiveOps',
    devops: 'DevOps',
    signedInAs: 'Signed in as',
    signOut: 'Sign Out',
    signIn: 'Sign In',
    language: 'Langue',
    accessDenied: 'Access Denied',
    accessDeniedMsg: 'You must have ops portal access to view this portal.',
    currentRole: 'Your current role',
    portalAccess: 'Portal access',
    selectUser: 'Select a demo user',
    loading: 'Loading users...',
    gcHeader: 'Government of Canada',
    gcFooter: 'Government of Canada',
  },
  fr: {
    title: 'EVA Operations et soutien',
    finops: 'FinOps',
    aiops: 'AIOps',
    liveops: 'LiveOps',
    devops: 'DevOps',
    signedInAs: 'Connecte(e) en tant que',
    signOut: 'Se deconnecter',
    signIn: 'Se connecter',
    language: 'Language',
    accessDenied: 'Acces refuse',
    accessDeniedMsg: 'Vous devez avoir acces au portail des operations pour voir ce portail.',
    currentRole: 'Votre role actuel',
    portalAccess: 'Acces au portail',
    selectUser: 'Selectionnez un utilisateur',
    loading: 'Chargement des utilisateurs...',
    gcHeader: 'Gouvernement du Canada',
    gcFooter: 'Gouvernement du Canada',
  },
};

const PAGES: Page[] = ['finops', 'aiops', 'liveops', 'devops'];

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
        <label htmlFor="ops-login-select" className="mb-2 block text-sm font-medium text-gray-700">
          {t.selectUser}
        </label>
        <select
          id="ops-login-select"
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

function AccessDenied({
  lang,
  role,
  portalAccess,
  onLogout,
}: {
  lang: Lang;
  role: string;
  portalAccess: string[];
  onLogout: () => void;
}) {
  const t = NAV_LABELS[lang];
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <div className="mb-4 text-4xl text-red-400" aria-hidden="true">&#9888;</div>
        <h1 className="mb-2 text-xl font-semibold text-red-800">{t.accessDenied}</h1>
        <p className="mb-4 text-sm text-red-600">{t.accessDeniedMsg}</p>
        <p className="mb-2 text-sm text-red-500">
          {t.currentRole}: <strong>{role}</strong>
        </p>
        <p className="mb-6 text-sm text-red-500">
          {t.portalAccess}: <strong>{portalAccess.join(', ') || 'none'}</strong>
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
  const [activePage, setActivePage] = useState<Page>('finops');
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

  // Ops portal access check — require "ops" in portal_access
  const hasOpsAccess = user?.portal_access?.includes('ops');
  if (!hasOpsAccess) {
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
        <AccessDenied
          lang={lang}
          role={user?.role ?? 'unknown'}
          portalAccess={user?.portal_access ?? []}
          onLogout={logout}
        />
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
              {t.signedInAs} <strong>{user!.name}</strong>
            </span>
            <span className="inline-flex rounded-full bg-indigo-100 border border-indigo-300 px-2 py-0.5 text-xs font-medium text-indigo-800">
              {user!.role}
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
            {activePage === 'finops' && <FinOpsDashboard lang={lang} />}
            {activePage === 'aiops' && <AIOpsMonitor lang={lang} />}
            {activePage === 'liveops' && <LiveOpsHealth lang={lang} />}
            {activePage === 'devops' && <DevOpsPipelines lang={lang} />}
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
