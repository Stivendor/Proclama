import { useEffect, useState } from "react";
import {
  Save,
  Sliders,
  LogOut,
  Menu,
  Cloud,
  FileText,
  X,
  Loader2,
  Globe,
  Church,
  MapPin,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  useAppStore,
} from "@/stores";
import { supabase } from "@/services/supabase";
import TermsModal from "@/components/terms/TermsModal";
import { CURRENT_TERMS_VERSION } from "@/constants/terms";
import { usePlan } from "@/hooks/usePlan";
import DeviceList from "@/components/auth/DeviceList";
import { Monitor } from "lucide-react";
import { MAX_DEVICES_PREMIUM } from "@/constants/plans";
import { t } from "@/i18n";
import { LATAM_COUNTRIES } from "@/constants/latamLocations";

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
    language,
    setLanguage,
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
      language: s.language,
      setLanguage: s.setLanguage,
    })),
  );
  const [saved, setSaved] = useState(false);
  const [attendanceCategories, setAttendanceCategories] = useState<string[]>(
    settings.attendanceCategories?.length > 0
      ? settings.attendanceCategories
      : ['Caballeros', 'Damas', 'Amigos', 'Niños']
  );
  const [churchName, setChurchName] = useState(settings.churchName ?? "");
  const initialListedCountry = LATAM_COUNTRIES.find((item) => item.name === settings.country);
  const initialCountry = settings.country
    ? initialListedCountry
      ? settings.country
      : "OTHER"
    : "";
  const initialCity = settings.city
    ? initialListedCountry?.cities.includes(settings.city)
      ? settings.city
      : "OTHER"
    : "";
  const [country, setCountry] = useState(initialCountry);
  const [city, setCity] = useState(initialCity);
  const [customCountry, setCustomCountry] = useState(initialCountry === "OTHER" ? settings.country ?? "" : "");
  const [customCity, setCustomCity] = useState(initialCity === "OTHER" ? settings.city ?? "" : "");

  const { isPremium } = usePlan();

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  // Auth states
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      setAuthError(error.message);
      setGoogleLoading(false);
    }
  };

  const set = (key: string, value: any) =>
    updateSettings({ [key]: value } as any);

  const handleSave = () => {
    const finalCountry = country === "OTHER" ? customCountry.trim() : country.trim();
    const finalCity = city === "OTHER" || country === "OTHER" ? customCity.trim() : city.trim();

    updateSettings({
      attendanceCategories,
      churchName: churchName.trim(),
      country: finalCountry,
      city: finalCity,
    });
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

  const selectedCountry = LATAM_COUNTRIES.find((item) => item.name === country);

  return (
    <div className="settings-view">
      <div className="view-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>{t(language, 'settings.title')}</h1>
        </div>
        <button
          className="btn-primary"
          onClick={handleSave}
          aria-label={t(language, 'settings.save')}
        >
          <Save size={15} /> {saved ? t(language, 'settings.saved') : t(language, 'settings.save')}
        </button>
      </div>

      <div className="settings-body">
        <div className="settings-config-col">
          {/* Cuenta y Sincronización */}
          <section className="settings-section">
            <h2>{t(language, 'settings.account')}</h2>
            {!user ? (
              <div className="auth-card">
                <div className="sync-benefits">
                  <div className="sync-benefit-item">
                    <Cloud size={16} />
                    <span>
                      <strong>{t(language, 'settings.proAccess')}</strong> {t(language, 'settings.proDesc')}
                    </span>
                  </div>
                  <div className="sync-benefit-item">
                    <Cloud size={16} />
                    <span>
                      <strong>{t(language, 'settings.reports')}</strong> {t(language, 'settings.reportsDesc')}
                    </span>
                  </div>
                  <div className="sync-benefit-item">
                    <Cloud size={16} />
                    <span><strong>{t(language, 'settings.community')}</strong> {t(language, 'settings.communityDesc')}</span>
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
                  {t(language, 'settings.continueWithGoogle')}
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
                      <span>{t(language, 'settings.syncActive')}</span>
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
                    <span>{t(language, 'settings.signOut')}</span>
                  </button>

                  <button
                    className="btn-session terms"
                    onClick={() => setActiveView("terms")}
                  >
                    <FileText size={16} />
                    <span>{t(language, 'settings.terms')}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Connected devices — Registered users only */}
          {user && isPremium && (
            <section className="settings-section">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Monitor size={18} />
                {t(language, 'settings.connectedDevices')}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                }}
              >
                {t(language, 'settings.connectedDevicesDesc', { maxDevices: MAX_DEVICES_PREMIUM })}
              </p>
              <DeviceList />
            </section>
          )}

          {/* Informacion opcional de iglesia */}
          <section className="settings-section">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Church size={18} />
              {t(language, 'settings.churchInfo')}
            </h2>
            <p className="settings-section-copy">
              {t(language, 'settings.churchInfoDesc')}
            </p>
            <div className="church-info-grid">
              <label className="settings-field">
                <span>{t(language, 'settings.churchName')}</span>
                <div className="settings-input-wrap">
                  <Church size={16} aria-hidden="true" />
                  <input
                    type="text"
                    value={churchName}
                    onChange={(event) => setChurchName(event.target.value)}
                    placeholder={t(language, 'settings.churchNamePlaceholder')}
                    autoComplete="organization"
                  />
                </div>
              </label>

              <label className="settings-field">
                <span>{t(language, 'settings.country')}</span>
                <div className="settings-input-wrap">
                  <Globe size={16} aria-hidden="true" />
                  <select
                    value={country}
                    onChange={(event) => {
                      setCountry(event.target.value);
                      setCity("");
                      setCustomCity("");
                    }}
                    autoComplete="country-name"
                  >
                    <option value="">{t(language, 'settings.chooseCountry')}</option>
                    {LATAM_COUNTRIES.map((item) => (
                      <option key={item.code} value={item.name}>{item.name}</option>
                    ))}
                    <option value="OTHER">{t(language, 'settings.otherCountry')}</option>
                  </select>
                </div>
              </label>

              {country === "OTHER" && (
                <label className="settings-field">
                  <span>{t(language, 'settings.customCountry')}</span>
                  <div className="settings-input-wrap">
                    <Globe size={16} aria-hidden="true" />
                    <input
                      type="text"
                      value={customCountry}
                      onChange={(event) => setCustomCountry(event.target.value)}
                      placeholder={t(language, 'settings.countryPlaceholder')}
                      autoComplete="country-name"
                    />
                  </div>
                </label>
              )}

              {country && country !== "OTHER" && (
                <label className="settings-field">
                  <span>{t(language, 'settings.city')}</span>
                  <div className="settings-input-wrap">
                    <MapPin size={16} aria-hidden="true" />
                    <select
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      autoComplete="address-level2"
                    >
                      <option value="">{t(language, 'settings.chooseCity')}</option>
                      {selectedCountry?.cities.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                      <option value="OTHER">{t(language, 'settings.otherCity')}</option>
                    </select>
                  </div>
                </label>
              )}

              {(city === "OTHER" || country === "OTHER") && (
                <label className="settings-field">
                  <span>{t(language, 'settings.customCity')}</span>
                  <div className="settings-input-wrap">
                    <MapPin size={16} aria-hidden="true" />
                    <input
                      type="text"
                      value={customCity}
                      onChange={(event) => setCustomCity(event.target.value)}
                      placeholder={t(language, 'settings.cityPlaceholder')}
                      autoComplete="address-level2"
                    />
                  </div>
                </label>
              )}
            </div>
          </section>

          {/* Language selector */}
          <section className="settings-section">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} />
              {t(language, 'settings.language')}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
              {t(language, 'settings.languageDesc')}
            </p>
            <div className="language-selector">
              <button
                className={`lang-option${language === 'es' ? ' active' : ''}`}
                onClick={() => setLanguage('es')}
              >
                <span className="lang-flag">🇪🇸</span>
                <span>{t(language, 'settings.spanish')}</span>
                {language === 'es' && <span className="lang-check">✓</span>}
              </button>
              <button
                className={`lang-option${language === 'en' ? ' active' : ''}`}
                onClick={() => setLanguage('en')}
              >
                <span className="lang-flag">🇺🇸</span>
                <span>{t(language, 'settings.english')}</span>
                {language === 'en' && <span className="lang-check">✓</span>}
              </button>
            </div>
          </section>

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
        .settings-section-copy {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 16px;
          line-height: 1.5;
        }
        .church-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .church-info-grid .settings-field:first-child {
          grid-column: 1 / -1;
        }
        .settings-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
        }
        .settings-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-surface);
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .settings-input-wrap:focus-within {
          border-color: var(--gold);
          background: var(--bg-elevated);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
        }
        .settings-input-wrap svg {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .settings-input-wrap input,
        .settings-input-wrap select {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text-primary);
          font: inherit;
          font-size: 14px;
          font-weight: 500;
        }
        .settings-input-wrap select {
          cursor: pointer;
        }
        .settings-input-wrap input::placeholder {
          color: var(--text-muted);
        }
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
          .church-info-grid {
            grid-template-columns: 1fr;
          }
        }

        .language-selector {
          display: flex;
          gap: 10px;
        }
        .lang-option {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .lang-option:hover {
          background: var(--bg-hover);
          border-color: var(--border-light);
          color: var(--text-primary);
        }
        .lang-option.active {
          border-color: var(--gold);
          background: rgba(212, 175, 55, 0.08);
          color: var(--gold);
        }
        .lang-flag {
          font-size: 20px;
          line-height: 1;
        }
        .lang-check {
          margin-left: auto;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
