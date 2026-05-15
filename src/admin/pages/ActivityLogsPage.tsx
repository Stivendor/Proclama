import { useEffect, useState, useCallback } from "react";
import { ScrollText, Download } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchLogsPaginated } from "../services/adminQueries";

interface LogEntry {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  note: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  approve_song: "Aprobó canción",
  reject_song: "Rechazó canción",
  delete_song: "Eliminó canción",
  change_plan: "Cambió plan",
  resolve_report: "Resolvió reporte",
  verify_song: "Verificó canción",
  unverify_song: "Quitó verificación"
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const ps = 50;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchLogsPaginated(page, ps, { action: filterAction || undefined });
      setLogs(r.data);
      setTotal(r.count);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, filterAction]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const exportCSV = () => {
    const rows = [
      ["Admin", "Acción", "Tipo", "Objetivo", "Nota", "Fecha"],
      ...logs.map((l) => [
        l.admin_email,
        ACTION_LABELS[l.action] || l.action,
        l.target_type,
        l.target_label,
        l.note ?? "",
        new Date(l.created_at).toLocaleString(),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `admin_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScrollText size={24} color="var(--text-muted)" /> Logs de Actividad
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{total} registros</p>
        </div>
        <button className="admin-btn-secondary" onClick={exportCSV}>
          <Download size={14} /> CSV
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select
          className="admin-select"
          value={filterAction}
          onChange={(e) => {
            setFilterAction(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todas las acciones</option>
          {Object.keys(ACTION_LABELS).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { key: "admin", header: "Admin", render: (l: LogEntry) => <span style={{ fontSize: 13 }}>{l.admin_email}</span> },
          {
            key: "action",
            header: "Acción",
            render: (l: LogEntry) => (
              <span className="admin-badge premium">{ACTION_LABELS[l.action] || l.action}</span>
            ),
          },
          { key: "target", header: "Objetivo", render: (l: LogEntry) => <span style={{ fontSize: 13 }}>{l.target_label}</span> },
          {
            key: "note",
            header: "Nota",
            render: (l: LogEntry) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{l.note ?? "—"}</span>,
          },
          {
            key: "date",
            header: "Fecha",
            render: (l: LogEntry) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(l.created_at).toLocaleString()}</span>,
          },
        ]}
        data={logs}
        totalCount={total}
        page={page}
        pageSize={ps}
        onPageChange={setPage}
        loading={loading}
        rowKey={(l: LogEntry) => l.id}
      />
    </div>
  );
}
