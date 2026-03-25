import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  credits: number;
  signOut: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  credits: 0,
  signOut: async () => {},
  refreshCredits: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [credits, setCredits] = useState(0);

  const checkAdmin = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      console.error("checkAdmin error:", error.message);
      setIsAdmin(false);
      return false;
    }

    const admin = !!data;
    setIsAdmin(admin);
    return admin;
  };

  const refreshCredits = async (targetUserId?: string) => {
    const uid = targetUserId ?? user?.id;
    if (!uid) {
      setCredits(0);
      return;
    }

    const { data, error } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.error("refreshCredits error:", error.message);
      return;
    }

    setCredits(data?.balance ?? 0);
  };

  useEffect(() => {
    let isMounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await Promise.all([
          checkAdmin(nextSession.user.id),
          refreshCredits(nextSession.user.id),
        ]);
      } else {
        setIsAdmin(false);
        setCredits(0);
      }

      if (isMounted) setLoading(false);
    };

    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        void applySession(session);
      })
      .catch((err) => {
        console.error("getSession error:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setCredits(0);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, credits, signOut, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  );
};
