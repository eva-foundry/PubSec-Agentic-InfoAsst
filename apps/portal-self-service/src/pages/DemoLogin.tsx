import { useCallback, useEffect, useState } from "react";

interface UserContext {
  user_id: string;
  email: string;
  name: string;
  role: string;
  portal_access: string[];
  workspace_grants: string[];
  data_classification_level: string;
  language: string;
}

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    title: "EVA Demo Login",
    selectUser: "Select a demo user",
    signIn: "Sign In",
    signOut: "Sign Out",
    signedInAs: "Signed in as",
    role: "Role",
    loading: "Loading users...",
    error: "Failed to load demo users",
    language: "Langue",
  },
  fr: {
    title: "Connexion de d\u00e9mo EVA",
    selectUser: "S\u00e9lectionner un utilisateur",
    signIn: "Se connecter",
    signOut: "Se d\u00e9connecter",
    signedInAs: "Connect\u00e9(e) en tant que",
    role: "R\u00f4le",
    loading: "Chargement des utilisateurs...",
    error: "\u00c9chec du chargement des utilisateurs",
    language: "Language",
  },
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 border-red-300",
  contributor: "bg-blue-100 text-blue-800 border-blue-300",
  reader: "bg-gray-100 text-gray-800 border-gray-300",
};

const API_BASE = "/v1/eva/auth";

export default function DemoLogin() {
  const [lang, setLang] = useState<Lang>("en");
  const [users, setUsers] = useState<UserContext[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = strings[lang];

  useEffect(() => {
    fetch(`${API_BASE}/demo/users`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: UserContext[]) => {
        setUsers(data);
        if (data.length > 0) setSelectedEmail(data[0].email);
        setLoading(false);
      })
      .catch(() => {
        setError(t.error);
        setLoading(false);
      });
  }, [t.error]);

  const handleLogin = useCallback(async () => {
    if (!selectedEmail) return;
    const res = await fetch(`${API_BASE}/demo/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: selectedEmail }),
    });
    if (res.ok) {
      const user: UserContext = await res.json();
      setCurrentUser(user);
      localStorage.setItem("eva-auth-user", JSON.stringify(user));
    }
  }, [selectedEmail]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem("eva-auth-user");
  }, []);

  const toggleLang = () => setLang((prev) => (prev === "en" ? "fr" : "en"));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">{t.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        {/* Language toggle */}
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={toggleLang}
            className="text-sm font-medium text-blue-700 underline hover:text-blue-900"
            aria-label={t.language}
          >
            {lang === "en" ? "Fran\u00e7ais" : "English"}
          </button>
        </div>

        <h1 className="mb-6 text-2xl font-semibold text-gray-900">{t.title}</h1>

        {currentUser ? (
          <div className="space-y-4">
            <p className="text-gray-700">
              {t.signedInAs}{" "}
              <span className="font-semibold">{currentUser.name}</span>
            </p>
            <span
              className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${ROLE_COLORS[currentUser.role] ?? ROLE_COLORS.reader}`}
            >
              {t.role}: {currentUser.role}
            </span>
            <div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t.signOut}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label
              htmlFor="demo-user-select"
              className="block text-sm font-medium text-gray-700"
            >
              {t.selectUser}
            </label>
            <select
              id="demo-user-select"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.email}) - {u.role}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLogin}
              className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t.signIn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
