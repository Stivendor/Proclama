import { useEffect, useState, useCallback } from "react";
import { Users, Search, ArrowUpDown, Download, RefreshCcw } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchUsersPaginated } from "../services/adminQueries";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role: string;
  plan: "free" | "premium";
  full_name?: string | null;
  premium_expires_at?: string | null;
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
            key: "expires",
            header: "Vence",
            render: (u: UserProfile) => {
              if (u.plan !== "premium") return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
              if (!u.premium_expires_at) return <span style={{ color: "var(--gold)", fontSize: 12 }}>De por vida</span>;
              const expired = new Date(u.premium_expires_at) < new Date();
              return (
                <span style={{ color: expired ? "var(--red, #ef4444)" : "var(--text-secondary)", fontSize: 12 }}>
                  {new Date(u.premium_expires_at).toLocaleDateString("es-CO")}
                  {expired && " ✗"}
                </span>
              );
            }
          },
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
