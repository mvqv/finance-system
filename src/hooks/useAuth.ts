import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<"owner" | "operator" | "viewer" | null>(null);

  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .order("role", { ascending: true })
      .then(({ data }) => {
        if (!data || data.length === 0) return setRole("viewer");
        const order = ["owner", "operator", "viewer"];
        const top = data.map((r: { role: string }) => r.role).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
        setRole((top as "owner" | "operator" | "viewer") ?? "viewer");
      });
  }, [user]);

  return role;
}
