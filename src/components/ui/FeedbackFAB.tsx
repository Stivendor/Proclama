import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores";

export default function FeedbackFAB() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const user = useAppStore(s => s.user);

  if (!user) return null;

  const send = async () => {
    if (message.trim().length < 5) return;
    setSending(true);
    try {
      await supabase.from("feedback").insert({
        user_id: user.id, user_email: user.email ?? "",
        message: message.trim(), category
      });
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setMessage(""); }, 1500);
    } catch { alert("Error al enviar."); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '4px' }}>
      {open && (
        <div style={{ 
          position: 'absolute', bottom: '100%', left: '0', width: '100%',
          background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)',
          borderRadius: '8px', padding: '8px', marginBottom: '6px',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)', zIndex: 100,
          animation: 'fadeInUp 0.15s ease-out',
          display: 'flex', flexDirection: 'column', gap: '6px'
        }}>
          {sent ? (
            <p style={{ textAlign: "center", color: "var(--green)", fontWeight: 600, fontSize: 12, margin: '4px 0' }}>¡Enviado!</p>
          ) : (
            <>
              <select value={category} onChange={e => setCategory(e.target.value)} className="admin-select" style={{ width: "100%", fontSize: 11, padding: '4px 6px' }}>
                <option value="general">General</option>
                <option value="bug">Error / Bug</option>
                <option value="feature">Sugerencia</option>
                <option value="content">Contenido</option>
              </select>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Escribe aquí..."
                style={{ width: "100%", padding: 6, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 11, resize: "none", minHeight: '40px' }} />
              <button className="admin-action-btn gold" style={{ width: "100%", justifyContent: "center", padding: '4px', fontSize: 11 }}
                onClick={send} disabled={sending || message.trim().length < 5}>
                <Send size={11} /> {sending ? "Enviando..." : "Enviar"}
              </button>
            </>
          )}
        </div>
      )}
      <button 
        onClick={() => setOpen(!open)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%', 
          padding: '6px 8px', background: open ? 'rgba(212, 175, 55, 0.1)' : 'transparent', 
          border: '1px dashed ' + (open ? 'var(--gold)' : 'var(--border)'), 
          borderRadius: '6px', color: open ? 'var(--gold)' : 'var(--text-muted)', 
          fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s ease-out'
        }}
        onMouseOver={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
        onMouseOut={e => { e.currentTarget.style.color = open ? 'var(--gold)' : 'var(--text-muted)'; e.currentTarget.style.borderColor = open ? 'var(--gold)' : 'var(--border)'; }}
      >
        <MessageSquarePlus size={14} />
        Sugerencias
      </button>
    </div>
  );
}
