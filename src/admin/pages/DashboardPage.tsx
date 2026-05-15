import { useEffect, useState, useCallback } from "react";
import { Users, Star, Music, AlertCircle, Clock, MessageSquare } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import StatCard from "../components/StatCard";
import { fetchAdminStats, fetchRegistrationChart } from "../services/adminQueries";

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  verifiedSongs: number;
  openReports: number;
  pendingSongs: number;
  unreadFeedback: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, c] = await Promise.all([fetchAdminStats(), fetchRegistrationChart()]);
      setStats(s); setChartData(c);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !stats) {
    return <div className="admin-page-loading"><div className="admin-spinner" /></div>;
  }

  return (
    <div className="admin-page">
      <h1>Dashboard</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        Resumen general de la plataforma.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Usuarios" value={stats.totalUsers} icon={<Users size={28} />} />
        <StatCard label="Premium" value={stats.premiumUsers} icon={<Star size={28} />} accentColor="var(--gold)" />
        <StatCard label="Canciones Verificadas" value={stats.verifiedSongs} icon={<Music size={28} />} />
        <StatCard label="Reportes Abiertos" value={stats.openReports} icon={<AlertCircle size={28} />} accentColor="var(--red)" />
        <StatCard label="Pendientes" value={stats.pendingSongs} icon={<Clock size={28} />} accentColor="var(--gold)" />
        <StatCard label="Sugerencias" value={stats.unreadFeedback} icon={<MessageSquare size={28} />} accentColor="var(--blue)" />
      </div>

      <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Registros últimos 30 días</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13
                }}
              />
              <Line type="monotone" dataKey="count" stroke="var(--gold)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
            No hay registros en los últimos 30 días.
          </p>
        )}
      </div>
    </div>
  );
}
