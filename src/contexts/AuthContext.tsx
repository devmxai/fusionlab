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
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const refreshCredits = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    setCredits(data?.balance ?? 0);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          checkAdmin(session.user.id);
          refreshCredits();
        }, 0);
      } else {
        setIsAdmin(false);
        setCredits(0);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdmin(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) refreshCredits();
  }, [user]);

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
