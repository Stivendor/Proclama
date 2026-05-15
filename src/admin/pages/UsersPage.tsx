import { useEffect, useState, useCallback } from "react";
import { Users, Search, ArrowUpDown, Download, Zap, ZapOff, RefreshCcw } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchUsersPaginated } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const pageSize = 50;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchUsersPaginated(page, pageSize, { search, plan: filterPlan, sortOrder });
      setUsers(r.data);
      setTotalCount(r.count);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [page, search, filterPlan, sortOrder]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const togglePlan = async (user: UserProfile) => {
    const newPlan = user.plan === "premium" ? "free" : "premium";
    if (!confirm(`¿Cambiar plan de ${user.email} a ${newPlan.toUpperCase()}?`)) return;
    setUpdatingId(user.id);
    try {
      await supabase.from("profiles").update({ plan: newPlan }).eq("id", user.id);
      await logAdminAction({
        action: "change_plan", targetType: "user", targetId: user.id,
        targetLabel: user.email, note: `${user.plan} → ${newPlan}`
      });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, plan: newPlan } : u));
    } catch { alert("Error al cambiar plan."); }
    finally { setUpdatingId(null); }
  };

  const exportCSV = () => {
    const rows = [["Email", "Registro", "Plan", "Rol"], ...users.map(u => [
      u.email, new Date(u.created_at).toLocaleDateString(), u.plan, u.role
    ])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px" }}>FILTRAR:</span>
          <select value={filterPlan} onChange={e => { setFilterPlan(e.target.value); setPage(0); }} className="admin-select">
            <option value="all">Todos los planes</option>
            <option value="free">Solo Free</option>
            <option value="premium">Solo Premium</option>
          </select>
          <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />
          <button className="admin-btn-icon" onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")} title={sortOrder === "desc" ? "Más recientes primero" : "Más antiguos primero"}>
            <ArrowUpDown size={16} style={{ transform: sortOrder === "asc" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "email", header: "Email", render: (u: UserProfile) => <span style={{ fontWeight: 500 }}>{u.email}</span> },
          { key: "date", header: "Registro", render: (u: UserProfile) => <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{new Date(u.created_at).toLocaleDateString()}</span> },
          { key: "plan", header: "Plan", render: (u: UserProfile) => <span className={`admin-badge ${u.plan}`}>{u.plan.toUpperCase()}</span> },
          { key: "role", header: "Rol", render: (u: UserProfile) => <span style={{ color: u.role === "admin" ? "var(--blue)" : "var(--text-muted)", fontWeight: u.role === "admin" ? 600 : 400 }}>{u.role === "admin" ? "Admin" : "Usuario"}</span> },
          { key: "actions", header: "Acciones", align: "right" as const, render: (u: UserProfile) => (
            <button className={`admin-action-btn ${u.plan === "premium" ? "danger" : "gold"}`} onClick={() => togglePlan(u)} disabled={updatingId === u.id}>
              {updatingId === u.id ? <RefreshCcw size={13} className="spin" /> : u.plan === "premium" ? <><ZapOff size={13} /> Quitar</> : <><Zap size={13} /> Premium</>}
            </button>
          )}
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
