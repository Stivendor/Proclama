import { Component } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Última red de seguridad de la app. Sin esto, cualquier error de render
 * desmonta el árbol completo de React y se ve sólo el fondo del body
 * (`--bg-base`, casi negro): el clásico "se queda todo en negro".
 *
 * (Le pasó a la búsqueda del modal de importar biblias de HelloAO, cuando
 * algunas entradas del catálogo no traían `languageName`.)
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  /** Reintenta sin recargar: sirve si el fallo era puntual (red, render). */
  private retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          height: "100%",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "var(--bg-base, #08090b)",
          color: "var(--text-primary, #f2f4f7)",
          overflow: "auto",
        }}
      >
        <AlertTriangle size={48} color="var(--red, #e05555)" />
        <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Algo salió mal en Proclama</h2>
        <p style={{ margin: 0, color: "var(--text-secondary, #a2a9b4)", maxWidth: 520, lineHeight: 1.5 }}>
          La pantalla no pudo cargarse. Puedes reintentar o recargar la aplicación.
        </p>
        <pre
          style={{
            background: "var(--bg-surface, #0e1013)",
            padding: 16,
            borderRadius: 8,
            fontSize: 13,
            maxWidth: 600,
            width: "100%",
            overflow: "auto",
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "var(--text-secondary, #a2a9b4)",
            border: "1px solid var(--border, rgba(255,255,255,0.08))",
          }}
        >
          {this.state.error?.message || "Error desconocido"}
        </pre>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.retry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "var(--bg-elevated, #16181d)",
              color: "var(--text-primary, #f2f4f7)",
              border: "1px solid var(--border, rgba(255,255,255,0.08))",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <RotateCcw size={16} /> Intentar de nuevo
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "var(--gold, #c9a658)",
              color: "#000",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <RefreshCw size={16} /> Recargar app
          </button>
        </div>
      </div>
    );
  }
}
