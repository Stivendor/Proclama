import { useEffect, useState, useCallback } from "react";
import { Users, Search, ArrowUpDown, Download, RefreshCcw, Zap, ZapOff, UserCheck, UserX } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchUsersPaginated } from "../services/adminQueries";
import { supabase } from "@/services/supabase";
import { logAdminAction } from "../services/adminLogs";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role: string;
  plan: "free" | "premium";
  full_name?: string | null;
  is_authorized: boolean;
  settings?: {
    churchName?: string;
    country?: string;
    city?: string;
    onboardingComplete?: boolean;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const pageSize = 50;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchUsersPaginated(page, pageSize, { search, sortOrder });
      setUsers(r.data);
      setTotalCount(r.count);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [page, search, sortOrder]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const exportCSV = () => {
    const rows = [["Nombre", "Email", "Registro", "Rol", "Iglesia", "Ciudad", "País"], ...users.map(u => [
      u.full_name || "—", u.email, new Date(u.created_at).toLocaleDateString(), u.role, u.settings?.churchName || "—", u.settings?.city || "—", u.settings?.country || "—"
    ])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleTogglePlan = async (userId: string, email: string, currentPlan: "free" | "premium") => {
    const newPlan = currentPlan === "premium" ? "free" : "premium";
    const actionText = newPlan === "premium" ? "activar" : "desactivar";
    const confirm = window.confirm(`¿Seguro que deseas ${actionText} el plan Premium para ${email}?`);
    if (!confirm) return;

    try {
      const { error } = await supabase.from("profiles").update({ plan: newPlan }).eq("id", userId);
      if (error) throw error;

      await logAdminAction({
        action: "change_plan",
        targetType: "user",
        targetId: userId,
        targetLabel: email,
        note: `Plan cambiado: ${currentPlan} → ${newPlan} desde la lista de usuarios.`
      });

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
    } catch (err) {
      console.error("Error changing plan:", err);
      alert("Error al cambiar el plan del usuario.");
    }
  };

  const handleToggleAuthorized = async (userId: string, email: string, current: boolean) => {
    const newVal = !current;
    const action = newVal ? "Autorizar" : "Desautorizar";
    if (!window.confirm(`¿${action} a ${email} para publicar sin revisión?`)) return;
    try {
      const { error } = await supabase.from("profiles").update({ is_authorized: newVal }).eq("id", userId);
      if (error) throw error;

      await logAdminAction({
        action: newVal ? "authorize_user" : "deauthorize_user",
        targetType: "user",
        targetId: userId,
        targetLabel: email,
        note: `Usuario ${newVal ? "autorizado" : "desautorizado"} para publicar sin revisión.`
      });

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_authorized: newVal } : u));
    } catch (err) {
      console.error("Error toggling authorization:", err);
      alert("Error al cambiar autorización del usuario.");
    }
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} color="var(--gold)" /> Usuarios
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{totalCount} usuarios registrados</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn-icon" onClick={() => load()} title="Refrescar"><RefreshCcw size={16} /></button>
          <button className="admin-btn-secondary" onClick={exportCSV}><Download size={14} /> CSV</button>
        </div>
      </div>

      <div style={{ 
        display: "flex", 
        flexWrap: "wrap",
        gap: 16, 
        marginBottom: 24,
        alignItems: "center",
        background: "var(--bg-elevated)",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--border)"
      }}>
        <div className="admin-search-wrap" style={{ flex: "1 1 250px" }}>
          <Search size={15} className="admin-search-icon" />
          <input placeholder="Buscar usuario por email..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px" }}>ORDENAR POR FECHA:</span>
          <button className="admin-btn-icon" onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")} title={sortOrder === "desc" ? "Más recientes primero" : "Más antiguos primero"}>
            <ArrowUpDown size={16} style={{ transform: sortOrder === "asc" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (u: UserProfile) => <span style={{ fontWeight: 600 }}>{u.full_name || "—"}</span> },
          { key: "email", header: "Email", render: (u: UserProfile) => <span style={{ color: "var(--text-secondary)" }}>{u.email}</span> },
          { key: "date", header: "Registro", render: (u: UserProfile) => <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{new Date(u.created_at).toLocaleDateString()}</span> },
          { key: "church", header: "Iglesia", render: (u: UserProfile) => <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{u.settings?.churchName || "—"}</span> },
          { 
            key: "location", 
            header: "Ubicación", 
            render: (u: UserProfile) => {
              const cityVal = u.settings?.city;
              const countryVal = u.settings?.country;
              const locationStr = [cityVal, countryVal].filter(Boolean).join(", ");
              return <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{locationStr || "—"}</span>;
            }
          },
          { key: "role", header: "Rol", render: (u: UserProfile) => <span style={{ color: u.role === "admin" ? "var(--gold)" : "var(--text-muted)", fontWeight: u.role === "admin" ? 600 : 400 }}>{u.role === "admin" ? "Admin" : "Usuario"}</span> },
          { 
            key: "plan", 
            header: "Plan", 
            render: (u: UserProfile) => (
              <span className={`admin-badge ${u.plan === "premium" ? "gold" : ""}`}>
                {u.plan === "premium" ? "Premium" : "Free"}
              </span>
            )
          },
          {
            key: "authorized",
            header: "Autorizado",
            render: (u: UserProfile) => {
              const isUserAdmin = u.role === "admin";
              if (isUserAdmin) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
              return (
                <span style={{ color: u.is_authorized ? "var(--green, #22c55e)" : "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>
                  {u.is_authorized ? "Sí" : "No"}
                </span>
              );
            }
          },
          {
            key: "actions",
            header: "Acciones",
            render: (u: UserProfile) => {
              const isUserAdmin = u.role === "admin";
              if (isUserAdmin) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
              
              const isPremium = u.plan === "premium";
              return (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className={`admin-action-btn ${u.is_authorized ? "danger" : "gold"}`}
                    onClick={() => handleToggleAuthorized(u.id, u.email, u.is_authorized)}
                    title={u.is_authorized ? "Desautorizar" : "Autorizar"}
                    style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {u.is_authorized ? <UserX size={11} /> : <UserCheck size={11} />}
                    {u.is_authorized ? "Desautorizar" : "Autorizar"}
                  </button>
                  {isPremium ? (
                    <button 
                      className="admin-action-btn danger" 
                      onClick={() => handleTogglePlan(u.id, u.email, u.plan)}
                      title="Quitar Premium"
                      style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <ZapOff size={11} /> Quitar Premium
                    </button>
                  ) : (
                    <button 
                      className="admin-action-btn gold" 
                      onClick={() => handleTogglePlan(u.id, u.email, u.plan)}
                      title="Hacer Premium"
                      style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Zap size={11} /> Hacer Premium
                    </button>
                  )}
                </div>
              );
            }
          }
        ]}
        data={users}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        loading={loading}
        rowKey={(u: UserProfile) => u.id}
        emptyMessage="No se encontraron usuarios."
      />
    </div>
  );
}
