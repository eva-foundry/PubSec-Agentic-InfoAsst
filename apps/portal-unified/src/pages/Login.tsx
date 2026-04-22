import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoLogin, useDemoUsers } from "@/lib/api/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { user, login, isReady } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/chat";

  const users = useDemoUsers();
  const loginMut = useDemoLogin();
  const [selected, setSelected] = useState<string | null>(null);

  if (!isReady) return null;
  if (user) return <Navigate to={from} replace />;

  const submit = (email: string) => {
    setSelected(email);
    loginMut.mutate(email, {
      onSuccess: (u) => login(u),
      onError: () => setSelected(null),
    });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Pick a demo persona to continue.</p>
        </div>

        {users.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Could not reach the assistant. Is the backend running on{" "}
              <code>http://localhost:8000</code>?
            </AlertDescription>
          </Alert>
        )}
        {loginMut.isError && (
          <Alert variant="destructive">
            <AlertDescription>Login failed. Try another persona.</AlertDescription>
          </Alert>
        )}

        {users.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading personas…
          </div>
        ) : (
          <div className="space-y-2">
            {(users.data ?? []).map((u) => {
              const busy = loginMut.isPending && selected === u.email;
              return (
                <Button
                  key={u.email}
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  onClick={() => submit(u.email)}
                  disabled={loginMut.isPending}
                >
                  <span className="flex flex-col items-start text-left">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.role} · {u.portal_access.join(" / ")}
                    </span>
                  </span>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                </Button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
