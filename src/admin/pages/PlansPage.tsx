import { useCallback, useEffect, useState } from "react";
import { CreditCard, Zap, ZapOff } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { logAdminAction } from "../services/adminLogs";
import { setUserSubscription, supabase } from "@/services/supabase";
import { isPremiumFromProfile, type PlanTier } from "@/hooks/usePlan";

type Duration = "1m" | "3m" | "6m" | "12m" | "lifetime";

interface PlanRow {
  id: string;
  email: string;
  full_name: string | null;
  plan: PlanTier;
  role: "admin" | "user";
  premium_expires_at: string | null;
}

const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  trial: "Prueba",
  paid: "Pago",
  founding: "Fundador",
};

const rowIsPremium = (u: PlanRow) =>
  isPremiumFromProfile({ plan: u.plan, role: u.role, premiumExpiresAt: u.premium_expires_at });

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
  const [users, setUsers] = useState<PlanRow[]>([]);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  // Anual por defecto: es el único plan que se vende. Con "1m" por defecto, un
  // clic de más le concede un mes a quien acaba de pagar el año, y encima cae
  // dentro de la ventana del aviso de fin de gracia.
  const [duration, setDuration] = useState<Duration>("12m");
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    // ponytail: trae todas las filas y cuenta en cliente; ok para cientos de
    // usuarios, mover a una función SQL si la base crece a decenas de miles.
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, plan, role, premium_expires_at")
      .order("created_at", { ascending: false });
    setUsers((data as PlanRow[]) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const premiumCount = users.filter(rowIsPremium).length;
  const stats = { premium: premiumCount, free: users.length - premiumCount };

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
      await load();
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

      <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24, marginTop: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Usuarios y suscripciones</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Email</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Nombre</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Plan</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Vence</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const premium = rowIsPremium(u);
                const expired = u.premium_expires_at ? new Date(u.premium_expires_at) < new Date() : false;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{u.email}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{u.full_name || "—"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span className={`admin-badge ${premium ? "gold" : ""}`}>{PLAN_LABELS[u.plan] ?? u.plan}</span>
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                      {!premium ? "—" : !u.premium_expires_at ? (
                        <span style={{ color: "var(--gold)" }}>De por vida</span>
                      ) : (
                        <span style={{ color: expired ? "var(--red, #ef4444)" : "var(--text-secondary)" }}>
                          {new Date(u.premium_expires_at).toLocaleDateString("es-CO")}{expired && " ✗"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={4} style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-muted)" }}>Sin usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
