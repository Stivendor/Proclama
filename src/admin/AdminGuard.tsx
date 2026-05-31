import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { Shield } from "lucide-react";

type GuardState = "loading" | "authorized" | "denied";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("loading");

  useEffect(() => {
    const check = async () => {
      try {
        // Usamos un timeout por si getSession se queda colgado (bug conocido de supabase-js con tokens corruptos)
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{data: {session: null}}>((_, reject) => 
          setTimeout(() => reject(new Error("auth_timeout")), 5000)
        );
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (!session) {
          window.location.href = "/";
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        setState((data?.role === "admin" || data?.role === "superadmin") ? "authorized" : "denied");
      } catch (err: any) {
        console.error("AdminGuard error:", err);
        if (err.message === "auth_timeout") {
          window.location.href = "/";
        } else {
          setState("denied");
        }
      }
    };
    check();
  }, []);

  if (state === "loading") {
    return (
      <div className="admin-guard-loading">
        <div className="admin-spinner" />
        <p>Verificando acceso...</p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="admin-guard-denied">
        <Shield size={48} />
        <h2>Acceso Denegado</h2>
        <p>No tienes permisos de administrador.</p>
        <button onClick={() => (window.location.href = "/")}>
          Volver a Proclama
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
