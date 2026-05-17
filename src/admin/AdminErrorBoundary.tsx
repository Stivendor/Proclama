import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AdminErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100vh", gap: 16,
        padding: 24, textAlign: "center", color: "var(--text-primary)"
      }}>
        <AlertTriangle size={48} color="var(--red)" />
        <h2 style={{ margin: 0 }}>Error en el panel de administración</h2>
        <pre style={{
          background: "var(--bg-surface)", padding: 16, borderRadius: 8,
          fontSize: 13, maxWidth: 600, overflow: "auto",
          color: "var(--text-secondary)", border: "1px solid var(--border)"
        }}>
          {this.state.error?.message}
        </pre>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
            background: "var(--gold)", color: "#000", border: "none",
            borderRadius: 8, cursor: "pointer", fontWeight: 600
          }}
        >
          <RefreshCw size={16} /> Recargar panel
        </button>
      </div>
    );
  }
}
