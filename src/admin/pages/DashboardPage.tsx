import { useEffect, useState, useCallback } from "react";
import { 
  Users, Music, AlertCircle, Clock, MessageSquare, 
  Smartphone, CalendarCheck, RefreshCcw, Activity, 
  ChevronRight 
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAdminStats, fetchRegistrationChart, fetchUserActivity, fetchDauChart, type UserActivityRow } from "../services/adminQueries";
import { supabase } from "@/services/supabase";
import type { AdminView } from "../AdminSidebar";

interface Stats {
  totalUsers: number;
  verifiedSongs: number;
  openReports: number;
  pendingSongs: number;
  unreadFeedback: number;
  totalDevices: number;
  totalAttendance: number;
}

interface DashboardPageProps {
  onNavigate: (view: AdminView) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);
  const [dauData, setDauData] = useState<{ date: string; count: number }[]>([]);
  const [topUsers, setTopUsers] = useState<UserActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingStatus, setPingStatus] = useState<"connecting" | "success" | "error">("connecting");
  const [refreshing, setRefreshing] = useState(false);

  // Carga de datos
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, c, dau, activity] = await Promise.all([
        fetchAdminStats(),
        fetchRegistrationChart(),
        fetchDauChart().catch(() => []),
        fetchUserActivity().catch(() => []),
      ]);
      setStats(s as any);
      setChartData(c);
      setDauData(dau);
      setTopUsers(activity.filter(u => u.activeDays > 0).slice(0, 10));
    } catch (e) { 
      console.error("Error loading dashboard stats:", e); 
    } finally { 
      if (!silent) setLoading(false); 
    }
  }, []);

  // Ping de conexión
  const testConnection = useCallback(async () => {
    setPingStatus("connecting");
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) setPingStatus("error");
      else setPingStatus("success");
    } catch {
      setPingStatus("error");
    }
  }, []);

  useEffect(() => { 
    load(); 
    testConnection();
  }, [load, testConnection]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(true), testConnection()]);
    setRefreshing(false);
  };

  if (loading || !stats) {
    return <div className="admin-page-loading"><div className="admin-spinner" /></div>;
  }

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            Panel de Control
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Visión global en tiempo real y operaciones del sistema Proclama.
          </p>
        </div>
        <button 
          onClick={handleRefresh} 
          className="admin-btn-secondary" 
          style={{ gap: 8, height: 42, padding: "0 18px", borderRadius: 10 }}
          disabled={refreshing}
        >
          <RefreshCcw size={15} className={refreshing ? "spin" : ""} />
          {refreshing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {/* ═══ BENTO GRID LAYOUT ═══ */}
      <div className="bento-grid">
        {/* Bento Item 1: Héroe / Usuarios y Estado de API (Doble Ancho) */}
        <div className="bento-item bento-hero">
          <div className="bento-glow" />
          <div className="bento-card-header">
            <span className="bento-label">Usuarios & Red</span>
            <div className={`ping-badge ${pingStatus}`}>
              <Activity size={12} />
              <span>
                {pingStatus === "connecting" && "Ping..."}
                {pingStatus === "success" && "Supabase Conectada"}
                {pingStatus === "error" && "Error de Enlace"}
              </span>
            </div>
          </div>
          <div className="bento-value-large">{stats.totalUsers}</div>
          <div className="bento-sub">Miembros registrados en total</div>
          
          <div className="bento-hero-footer">
            <div className="hero-stat-pill">
              <Smartphone size={14} />
              <span><strong>{stats.totalDevices}</strong> Equipos</span>
            </div>
            <div className="hero-stat-pill">
              <CalendarCheck size={14} />
              <span><strong>{stats.totalAttendance}</strong> Asistencias</span>
            </div>
            <div className="hero-stat-pill">
              <Activity size={14} />
              <span><strong>{dauData.find(d => d.date === new Date().toLocaleDateString("en-CA"))?.count ?? 0}</strong> Activos hoy</span>
            </div>
          </div>
        </div>

        {/* Bento Item 2: Canciones Verificadas */}
        <div className="bento-item">
          <div className="bento-icon-box gold">
            <Music size={20} />
          </div>
          <span className="bento-label">Biblioteca</span>
          <div className="bento-value">{stats.verifiedSongs}</div>
          <div className="bento-sub">Canciones comunitarias verificadas</div>
        </div>

        {/* Bento Item 3: Gráfico de Registros de Usuario (Doble Ancho) */}
        <div className="bento-item bento-chart">
          <span className="bento-label">Registros Diarios (Últimos 30 días)</span>
          <div style={{ marginTop: 20, width: "100%", height: 180 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="var(--gold)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, margin: 0, fontSize: 12 }}>
                Sin registros de usuarios este mes.
              </p>
            )}
          </div>
        </div>

        {/* Bento: Usuarios activos diarios */}
        <div className="bento-item bento-chart">
          <span className="bento-label">Usuarios Activos Diarios (Últimos 30 días)</span>
          <div style={{ marginTop: 20, width: "100%", height: 180 }}>
            {dauData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dauData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="var(--blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, margin: 0, fontSize: 12 }}>
                Aún no hay datos de actividad. Se acumulan desde el despliegue del heartbeat.
              </p>
            )}
          </div>
        </div>

        {/* Bento: Top usuarios más activos */}
        <div className="bento-item bento-chart">
          <span className="bento-label">Top Usuarios Más Activos (30 días)</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {topUsers.length > 0 ? topUsers.map((u, i) => (
              <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 22 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.fullName || u.email}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Última actividad: {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}
                  </div>
                </div>
                <span className="mod-count-badge">{u.activeDays} {u.activeDays === 1 ? "día" : "días"}</span>
              </div>
            )) : (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 30, margin: 0, fontSize: 12 }}>
                Aún no hay actividad registrada.
              </p>
            )}
          </div>
        </div>

        {/* Bento Item 4: Acciones de Moderación */}
        <div className="bento-item bento-moderation">
          <span className="bento-label">Fila de Moderación</span>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div className="mod-list-row" onClick={() => onNavigate("pending-songs")}>
              <div className="mod-row-indicator warning">
                <Clock size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Revisión de Letras</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Canciones en cola de aprobación</div>
              </div>
              <span className="mod-count-badge">{stats.pendingSongs}</span>
              <ChevronRight size={14} className="mod-chevron" />
            </div>

            <div className="mod-list-row" onClick={() => onNavigate("reports")}>
              <div className="mod-row-indicator danger">
                <AlertCircle size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Reportes de Errores</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Correcciones enviadas por usuarios</div>
              </div>
              <span className="mod-count-badge danger">{stats.openReports}</span>
              <ChevronRight size={14} className="mod-chevron" />
            </div>

            <div className="mod-list-row" onClick={() => onNavigate("suggestions")}>
              <div className="mod-row-indicator blue">
                <MessageSquare size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Buzón de Sugerencias</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Feedback y solicitudes unread</div>
              </div>
              <span className="mod-count-badge blue">{stats.unreadFeedback}</span>
              <ChevronRight size={14} className="mod-chevron" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BENTO GRID STYLES (EMBEDDED) ═══ */}
      <style>{`
        .bento-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        .bento-item {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), 
                      border-color 0.22s ease, 
                      box-shadow 0.22s ease;
        }

        .bento-item:hover {
          transform: translateY(-2px);
          border-color: rgba(201, 166, 88, 0.3);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }

        /* Héroe card styles */
        .bento-hero {
          grid-column: span 2;
          background: linear-gradient(135deg, rgba(20, 24, 33, 0.95), rgba(15, 19, 28, 0.95));
          border-color: rgba(201, 166, 88, 0.12);
        }

        .bento-glow {
          position: absolute;
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(201, 166, 88, 0.05) 0%, transparent 70%);
          top: -100px;
          right: -100px;
          pointer-events: none;
        }

        .bento-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .bento-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .ping-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
        }

        .ping-badge.success {
          background: rgba(46, 213, 115, 0.08);
          border-color: rgba(46, 213, 115, 0.25);
          color: #2ed573;
        }

        .ping-badge.success svg {
          animation: pulsePing 2s infinite ease-in-out;
        }

        .ping-badge.error {
          background: rgba(255, 71, 87, 0.08);
          border-color: rgba(255, 71, 87, 0.25);
          color: #ff4757;
        }

        @keyframes pulsePing {
          0%, 100% { opacity: 0.5; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .bento-value-large {
          font-size: 48px;
          font-weight: 800;
          color: #fff;
          font-family: var(--font-display);
          line-height: 1.1;
          letter-spacing: -1px;
        }

        .bento-value {
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          font-family: var(--font-display);
          line-height: 1.2;
          margin-top: 10px;
          letter-spacing: -0.5px;
        }

        .bento-sub {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 6px;
        }

        .bento-hero-footer {
          display: flex;
          gap: 10px;
          margin-top: 24px;
          border-top: 1px solid var(--border);
          padding-top: 16px;
        }

        .hero-stat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .hero-stat-pill strong {
          color: #fff;
        }

        .bento-icon-box {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          margin-bottom: 16px;
          color: var(--text-secondary);
        }

        .bento-icon-box.gold {
          background: rgba(201, 166, 88, 0.08);
          border-color: rgba(201, 166, 88, 0.2);
          color: var(--gold);
        }

        /* Fila de moderación */
        .bento-moderation {
          display: flex;
          flex-direction: column;
        }

        .mod-list-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mod-list-row:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .mod-row-indicator {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mod-row-indicator.warning { background: rgba(201, 166, 88, 0.08); color: var(--gold); }
        .mod-row-indicator.danger { background: rgba(255, 71, 87, 0.08); color: #ff4757; }
        .mod-row-indicator.blue { background: rgba(84, 144, 217, 0.08); color: var(--blue); }

        .mod-count-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(201, 166, 88, 0.12);
          border: 1px solid rgba(201, 166, 88, 0.2);
          color: var(--gold);
        }

        .mod-count-badge.danger {
          background: rgba(255, 71, 87, 0.12);
          border-color: rgba(255, 71, 87, 0.2);
          color: #ff4757;
        }

        .mod-count-badge.blue {
          background: rgba(84, 144, 217, 0.12);
          border-color: rgba(84, 144, 217, 0.2);
          color: var(--blue);
        }

        .mod-chevron {
          color: var(--text-muted);
          opacity: 0.3;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .mod-list-row:hover .mod-chevron {
          opacity: 0.8;
          transform: translateX(2px);
          color: var(--text-primary);
        }

        .bento-chart {
          grid-column: span 2;
        }

        /* Responsive Bento */
        @media (max-width: 768px) {
          .bento-grid {
            grid-template-columns: 1fr;
          }
          .bento-hero {
            grid-column: span 1;
          }
          .bento-chart {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}
