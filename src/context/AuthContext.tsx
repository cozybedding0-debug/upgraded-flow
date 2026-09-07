import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types";

const DEMO_SESSION_KEY = "cozy-bedding-demo-session";

const DEMO_SESSION = {
  id: "demo-admin",
  email: "balatce.mre@gmail.com",
  role: "admin" as UserRole,
  user_metadata: { full_name: "COZY BEDDING" },
};

function demoProfile(): Profile {
  return {
    id: DEMO_SESSION.id,
    email: DEMO_SESSION.email,
    full_name: DEMO_SESSION.user_metadata.full_name,
    role: DEMO_SESSION.role,
    created_at: new Date().toISOString(),
  };
}

function readDemoSession(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as typeof DEMO_SESSION;
    return {
      id: parsed.id ?? DEMO_SESSION.id,
      email: parsed.email ?? DEMO_SESSION.email,
      full_name: parsed.user_metadata?.full_name ?? DEMO_SESSION.user_metadata.full_name,
      role: (parsed.role as UserRole) ?? "admin",
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeDemoSession() {
  try {
    window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(DEMO_SESSION));
  } catch {
    // ignore storage failures
  }
}

function clearDemoSession() {
  try {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // ignore storage failures
  }
}

function isNetworkError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err ?? "");
  return /failed to fetch|network|fetch failed|load failed|typeerror/i.test(message);
}

interface AuthContextValue {
  profile: Profile | null;
  session: boolean;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    // A saved demo session wins immediately — no network needed.
    const demo = readDemoSession();
    if (demo) {
      setProfile(demo);
      setDemoMode(true);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        if (session) {
          fetchProfile(session.user.id, session.user.email || "");
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === "SIGNED_OUT" || !session) {
          if (readDemoSession()) return;
          setProfile(null);
          setLoading(false);
          return;
        }
        await fetchProfile(session.user.id, session.user.email || "");
      })();
    });

    async function fetchProfile(userId: string, email: string) {
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

        if (!mounted) return;
        setProfile(
          (data as Profile | null) ?? {
            id: userId,
            email,
            full_name: "",
            role: "admin" as UserRole,
            created_at: new Date().toISOString(),
          },
        );
        setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    }

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const enterDemoMode = () => {
    writeDemoSession();
    setProfile(demoProfile());
    setDemoMode(true);
    setLoading(false);
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return enterDemoMode();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (isNetworkError(error.message)) return enterDemoMode();
        return { error: error.message };
      }
      return { error: null };
    } catch (err) {
      if (isNetworkError(err)) return enterDemoMode();
      return { error: err instanceof Error ? err.message : "Sign in failed" };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) return enterDemoMode();
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        if (isNetworkError(error.message)) return enterDemoMode();
        return { error: error.message };
      }
      return { error: null };
    } catch (err) {
      if (isNetworkError(err)) return enterDemoMode();
      return { error: err instanceof Error ? err.message : "Sign up failed" };
    }
  };

  const signOut = async () => {
    clearDemoSession();
    setDemoMode(false);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network failures on sign out
    }
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        session: !!profile,
        loading,
        demoMode,
        signIn,
        signUp,
        signOut,
        isAdmin: profile?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
