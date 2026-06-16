import { useEffect, useState } from "react";
import { CreditCard, Zap, ZapOff } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { logAdminAction } from "../services/adminLogs";
import { setUserSubscription, supabase } from "@/services/supabase";

type Duration = "1m" | "3m" | "6m" | "12m" | "lifetime";

const DURATIONS: { key: Duration; label: string }[] = [
  { key: "1m",       label: "1 mes" },
  { key: "3m",       label: "3 meses" },
  { key: "6m",       label: "6 meses" },
  { key: "12m",      label: "1 año" },
  { key: "lifetime", label: "De por vida" },
];

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function calcExpiry(duration: Duration): string | null {
  if (duration === "lifetime") return null;
  const months = parseInt(duration);
  return addMonths(months);
}

function formatExpiry(iso: string | null) {
  if (!iso) return "de por vida";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export default function PlansPage() {
  const [stats, setStats] = useState({ free: 0, premium: 0 });
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<Duration>("1m");
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "free"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "premium"),
    ]).then(([f, p]) => setStats({ free: f.count ?? 0, premium: p.count ?? 0 }));
  }, []);

  const overridePlan = async (newPlan: "free" | "premium") => {
    if (!email || !reason) { setMsg("Email y razón son obligatorios."); return; }
    setUpdating(true); setMsg("");
    try {
      const { data } = await supabase.from("profiles").select("id, plan").eq("email", email).single();
      if (!data) { setMsg("Usuario no encontrado."); return; }

      const expiresAt = newPlan === "premium" ? calcExpiry(duration) : null;
      const ok = await setUserSubscription(data.id, newPlan, expiresAt);
      if (!ok) { setMsg("Error al cambiar plan."); return; }

      const durationLabel = newPlan === "premium" ? DURATIONS.find(d => d.key === duration)!.label : "";
      await logAdminAction({
        action: "change_plan",
        targetType: "user",
        targetId: data.id,
        targetLabel: email,
        note: `${data.plan} → ${newPlan}${durationLabel ? ` (${durationLabel})` : ""}. Razón: ${reason}`,
      });

      const expiryText = newPlan === "premium" ? ` — vence ${formatExpiry(expiresAt)}` : "";
      setMsg(`Plan de ${email} cambiado a ${newPlan.toUpperCase()}${expiryText}.`);
      setEmail(""); setReason("");
      setStats(prev => ({
        free: prev.free + (newPlan === "free" ? 1 : -1),
        premium: prev.premium + (newPlan === "premium" ? 1 : -1),
      }));
    } catch { setMsg("Error al cambiar plan."); }
    finally { setUpdating(false); }
  };

  const pieData = [
    { name: "Free",    value: stats.free,    color: "var(--text-muted)" },
    { name: "Premium", value: stats.premium, color: "var(--gold)" },
  ];

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CreditCard size={24} color="var(--gold)" /> Planes & Pagos
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Distribución</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 13, justifyContent: "center" }}>
            <span>Free: <strong>{stats.free}</strong></span>
            <span style={{ color: "var(--gold)" }}>Premium: <strong>{stats.premium}</strong></span>
          </div>
        </div>

        <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Override manual</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              placeholder="Email del usuario"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }}
            />
            <textarea
              placeholder="Razón (obligatorio)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              style={{ padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", resize: "vertical" }}
            />

            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)" }}>Duración</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DURATIONS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDuration(d.key)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      border: `1px solid ${duration === d.key ? "var(--gold)" : "var(--border)"}`,
                      background: duration === d.key ? "var(--gold)" : "var(--bg-surface)",
                      color: duration === d.key ? "#000" : "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-action-btn gold" disabled={updating} onClick={() => overridePlan("premium")}>
                <Zap size={13} /> Hacer Premium
              </button>
              <button className="admin-action-btn danger" disabled={updating} onClick={() => overridePlan("free")}>
                <ZapOff size={13} /> Quitar Premium
              </button>
            </div>
            {msg && <p style={{ fontSize: 13, color: msg.includes("Error") ? "var(--red)" : "var(--green)" }}>{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
