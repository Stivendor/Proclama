import { useEffect, useState } from "react";
import {
  Save,
  Sliders,
  LogOut,
  Menu,
  Cloud,
  FileText,
  ShieldCheck,
  X,
  Loader2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  useAppStore,
} from "@/stores";
import { supabase } from "@/services/supabase";
import TermsModal from "@/components/TermsModal";
import { CURRENT_TERMS_VERSION } from "@/constants/terms";
import MFAModal from "@/components/MFAModal";
import { usePlan } from "@/hooks/usePlan";
import { useMercadoPagoCheckout } from "@/components/MercadoPagoCheckout";
import DeviceList from "@/components/DeviceList";
import { Monitor } from "lucide-react";

export default function SettingsView() {
  const {
    settings,
    updateSettings,
    isSidebarOpen,
    toggleSidebar,
    user,
    backgrounds,
    fetchBackgrounds,
    acceptTerms,
    setActiveView,
  } = useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
      isSidebarOpen: s.isSidebarOpen,
      toggleSidebar: s.toggleSidebar,
      user: s.user,
      backgrounds: s.backgrounds,
      fetchBackgrounds: s.fetchBackgrounds,
      acceptTerms: s.acceptTerms,
      setActiveView: s.setActiveView,
    })),
  );
  const [saved, setSaved] = useState(false);
  const [attendanceCategories, setAttendanceCategories] = useState<string[]>(
    settings.attendanceCategories?.length > 0
      ? settings.attendanceCategories
      : ['Caballeros', 'Damas', 'Amigos', 'Niños']
  );


  const { isPremium } = usePlan();
  const { openCheckout } = useMercadoPagoCheckout();

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  // Auth states
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // MFA states
  const [showMFAModal, setShowMFAModal] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
      setGoogleLoading(false);
    }
  };

  const set = (key: string, value: any) =>
    updateSettings({ [key]: value } as any);

  const handleSave = () => {
    updateSettings({ attendanceCategories });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const FONTS = [
    "Montserrat, sans-serif",
    "Outfit, sans-serif",
    "Rubik, sans-serif",
    "Lexend, sans-serif",
    "Kanit, sans-serif",
    "Urbanist, sans-serif",
    "Nunito, sans-serif",
    "Inter, sans-serif",
    "Playfair Display, serif",
    "Lora, serif",
    "Montserrat, sans-serif",
    "Verdana, sans-serif",
  ];

  const TRANSITIONS = [
    { value: "fade", label: "Fade (suave)" },
    { value: "slide", label: "Slide (deslizar)" },
    { value: "instant", label: "Instantáneo" },
  ];

  return (
    <div className="settings-view">
      <div className="view-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>Ajustes</h1>
        </div>
        <button
          className="btn-primary"
          onClick={handleSave}
          aria-label="Guardar todos los ajustes"
        >
          <Save size={15} /> {saved ? "¡Guardado!" : "Guardar"}
        </button>
      </div>

      <div className="settings-body">
        <div className="settings-config-col">
          {/* Cuenta y Sincronización */}
          <section className="settings-section">
            <h2>Cuenta Proclama</h2>
            {!user ? (
              <div className="auth-card">
                <div className="sync-benefits">
                  <div className="sync-benefit-item">
                    <Cloud size={16} />
                    <span>
                      <strong>Acceso Pro:</strong> Búsqueda de letras online en tiempo real (Genius/LRC)
                    </span>
                  </div>
                  <div className="sync-benefit-item">
                    <Cloud size={16} />
                    <span>
                      <strong>Reportes:</strong> Exporta tu historial de asistencia a CSV para Excel
                    </span>
                  </div>
                  <div className="sync-benefit-item">
                    <Cloud size={16} />
                    <span><strong>Comunidad:</strong> Comparte tus canciones con la biblioteca global</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-google-settings"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continuar con Google
                </button>

                {authError && (
                  <div
                    style={{ color: "#ff4d4f", fontSize: 13, marginTop: 12, textAlign: 'center' }}
                  >
                    {authError}
                  </div>
                )}
              </div>
            ) : (
              <div className="session-card">
                <div className="session-profile">
                  <div className="session-avatar">
                    {user.email?.[0].toUpperCase() ?? "U"}
                  </div>
                  <div className="session-details">
                    <div className="session-email">{user.email}</div>
                    <div className="session-status">
                      <Cloud size={12} />
                      <span>Sincronización activa</span>
                      <span className="status-divider">•</span>
                      <span className="status-plan">Plan Escritura</span>
                    </div>
                  </div>
                </div>

                <div className="session-actions-grid">
                  <button
                    className="btn-session logout"
                    onClick={async () => {
                      useAppStore.getState().logout();
                      try {
                        await supabase.auth.signOut();
                      } catch (e) {
                        console.warn(e);
                      }
                    }}
                  >
                    <LogOut size={16} />
                    <span>Cerrar Sesión</span>
                  </button>

                  <button
                    className="btn-session terms"
                    onClick={() => setActiveView("terms")}
                  >
                    <FileText size={16} />
                    <span>Términos y Condiciones</span>
                  </button>
                </div>
              </div>
            )}
          </section>

{/* Planes */}
          <section className="settings-section">
            <h2>Planes</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Plan Básico */}
              <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#d1dae8', fontSize: '12px', fontWeight: 700 }}>Usar Gratis</span>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>$0<span style={{ fontSize: '14px', fontWeight: 400, color: '#778398' }}> para siempre</span></div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Proyección de alto rendimiento</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Gestión de Setlists y Notas</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Uso local ilimitado y fluido</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ 10 canciones propias</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Acceso a 50 canciones de biblioteca</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Hasta 5 archivos de media local</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#778398', fontSize: '14px' }}>🔒 Biblioteca completa (3,000+ canciones)</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#778398', fontSize: '14px' }}>🔒 +50 Fondos exclusivos (Imágenes y Videos)</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#778398', fontSize: '14px' }}>🔒 Exportación de asistencia CSV y PDF con estadísticas</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#778398', fontSize: '14px' }}>🔒 Gestión de carpetas en media local</li>
                </ul>
              </div>

              {/* Plan Premium */}
              <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(201, 166, 88, 0.22)', background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(201, 166, 88, 0.14)', color: '#f0dfb6', fontSize: '12px', fontWeight: 700 }}>Plan Premium</span>
                  {isPremium && <span style={{ padding: '4px 10px', borderRadius: '999px', background: 'var(--gold)', color: '#000', fontSize: '11px', fontWeight: 600 }}>ACTIVO</span>}
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#f0dfb6' }}>$ Próximamente<span style={{ fontSize: '14px', fontWeight: 400, color: '#778398' }}> · único</span></div>
                  <p style={{ fontSize: '12px', color: '#778398', margin: 0 }}>Acceso de por vida</p>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Biblioteca completa (3,000+ canciones)</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Búsqueda online de letras de canciones</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Exportación de asistencia CSV y PDF con estadísticas</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Canciones propias ilimitadas</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Importar Biblias en múltiples idiomas</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ +50 Fondos exclusivos (Imágenes y Videos)</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Gestión de carpetas en media local</li>
                  <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#d5dce7', fontSize: '14px' }}>✓ Hasta 25 archivos de media local</li>
                </ul>
                {!isPremium && (
                  <button style={{ background: 'var(--gold)', color: '#000', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 600, fontSize: '15px', cursor: 'pointer', width: '100%', marginTop: '8px' }} onClick={() => {
                    useAppStore.getState().setForceLanding(true, 'planes')
                  }}>
                    Mejorar a Premium
                  </button>
                )}
              </div>
            </div>
          </section>





          {/* Seguridad */}
          {user && (
            <section className="settings-section">
              <h2>Seguridad</h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                }}
              >
                Protege tu cuenta con autenticación de dos factores (TOTP).
              </p>
              <button
                className="btn-secondary"
                onClick={() => setShowMFAModal(true)}
              >
                <ShieldCheck size={15} />
                Gestionar MFA
              </button>
            </section>
          )}

          {showMFAModal && <MFAModal onClose={() => setShowMFAModal(false)} />}

          {/* Dispositivos conectados — Solo para usuarios Premium */}
          {user && isPremium && (
            <section className="settings-section">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Monitor size={18} />
                Dispositivos conectados
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                }}
              >
                Tu plan Pro permite hasta <strong style={{ color: 'var(--text-primary)' }}>2 dispositivos</strong>. Puedes revocar el acceso de cualquier equipo desde aquí.
              </p>
              <DeviceList />
            </section>
          )}

        </div>
      </div>

      <style>{`
        .settings-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 40px;
          align-items: center;
          padding-bottom: 60px;
        }

        .settings-config-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 800px;
          width: 100%;
        }

        .background-options { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px; }
        .gallery-container { display: flex; flex-direction: column; gap: 12px; }
        .gallery-container label { display: flex; alignItems: center; gap: 6px; font-weight: 600; font-size: 13px; }
        .backgrounds-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          max-height: 300px;
          overflow-y: auto;
          padding: 4px;
        }
        .gallery-item {
          aspect-ratio: 16/9;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
          position: relative;
          background: #000;
        }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; opacity: 0.8; }
        .gallery-item:hover img { opacity: 1; transform: scale(1.05); }
        .gallery-item.active { border-color: var(--gold); }
        .gallery-item.active img { opacity: 1; }
        .active-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center; color: var(--gold);
        }
        .input-tip { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block; }
        .sync-benefits {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(212, 175, 55, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.15);
        }
        .sync-benefit-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .sync-benefit-item svg { color: var(--gold); flex-shrink: 0; }
        .auth-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .toggle-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .toggle-btn.active {
          background: var(--gold);
          border-color: var(--gold);
          color: black;
        }
        .auth-hint {
          text-align: center;
          margin-top: 12px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .btn-google-settings {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 10px 16px;
          background: #fff;
          color: #3c4043;
          border: 1px solid #dadce0;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 4px;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .btn-google-settings:hover:not(:disabled) {
          background: #f8f9fa;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .btn-google-settings:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-divider-settings {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
          font-size: 11px;
          margin: 8px 0;
        }
        .auth-divider-settings::before,
        .auth-divider-settings::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* Session Active Card */
        .session-card {
          background: linear-gradient(145deg, var(--bg-elevated), var(--bg-base));
          border: 1px solid var(--border-light);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .session-profile {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .session-avatar {
          width: 48px;
          height: 48px;
          background: var(--gold);
          color: black;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-weight: 700;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
        }
        .session-email {
          font-weight: 600;
          font-size: 15px;
          color: var(--text-primary);
          margin-bottom: 2px;
          word-break: break-all;
        }
        .session-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .session-status svg {
          color: var(--green);
        }
        .status-divider {
          color: var(--border);
        }
        .status-plan {
          color: var(--gold);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.5px;
        }
        .session-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .btn-session {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
        }
        .btn-session:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-light);
          transform: translateY(-1px);
        }
        .btn-session.logout:hover {
          background: rgba(224, 85, 85, 0.1);
          color: var(--red);
          border-color: var(--red-dim);
        }
        
        @media (max-width: 480px) {
          .session-actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
