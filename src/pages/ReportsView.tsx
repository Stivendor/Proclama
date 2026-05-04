import { useEffect, useState } from 'react';
import { fetchSongReports, fetchSongById, deleteSong, updateSong, SongReport, supabase } from '@/services/supabase';
import { AlertCircle, Calendar, Music, User, CheckCircle, Trash2, ShieldCheck, Clock, Check, X, FileText, Edit2 } from 'lucide-react';
import { useAppStore } from '@/stores';
import { db } from '@/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Song } from '@/types';

export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<'reports' | 'pending'>('reports');
  const [reports, setReports] = useState<SongReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSongId, setLoadingSongId] = useState<number | null>(null);
  const [previewSong, setPreviewSong] = useState<Song | null>(null);
  const userRole = useAppStore(s => s.userRole);
  const setForceLanding = useAppStore(s => s.setForceLanding);

  const pendingSongs = useLiveQuery(async () => {
    const all = await db.songs.toArray();
    return all.filter(s => s.isPublic && !s.isVerified);
  }) ?? [];
  useEffect(() => {
    if (userRole !== 'admin') {
      setForceLanding(true);
      return;
    }

    loadReports();
  }, [userRole, setForceLanding]);

  const loadReports = async () => {
    setLoading(true);
    try {
      // Usamos un timeout de 5 segundos máximo para evitar que se quede "Cargando..." si Supabase falla silenciosamente
      let timeoutId: any;
      const timeoutPromise = new Promise<SongReport[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout fetching reports (10s)')), 10000);
      });
      
      try {
        const data = await Promise.race([
          fetchSongReports(),
          timeoutPromise
        ]);
        setReports(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
      // Si falla, mostramos una lista vacía para no bloquear la pantalla
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      const { error, count } = await supabase
        .from('song_reports')
        .delete({ count: 'exact' })
        .eq('id', reportId);
        
      if (error) throw error;
      
      if (count === 0) {
        throw new Error('No se pudo eliminar el reporte. Es posible que falten permisos en la base de datos (RLS) o que el reporte ya no exista.');
      }
      
      // Update local state
      setReports(reports.filter(r => r.id !== reportId));
    } catch (err: any) {
      console.error('Error deleting report:', err);
      alert(`Hubo un problema al resolver el reporte: ${err.message}`);
    }
  };

  const deleteSongAndReport = async (report: SongReport) => {
    if (!window.confirm(`¿Estás seguro de que deseas ELIMINAR COMPLETAMENTE la canción "${report.songs?.title || 'desconocida'}"? Esta acción borrará la canción de la base de datos para todos los usuarios y también eliminará el reporte.`)) return;

    try {
      // 1. Borrar todos los reportes asociados a esta canción primero (para evitar error de Foreign Key)
      const { count } = await supabase.from('song_reports').delete({ count: 'exact' }).eq('song_id', report.song_id);

      if (count === 0 && report.id) {
        // Podría no haber ninguno o que RLS nos bloquee
        console.warn('Ningún reporte eliminado o falta de permisos RLS para eliminar el reporte.');
      }

      // 2. Borrar de Supabase
      const success = await deleteSong(report.song_id);
      if (!success) throw new Error('Error al eliminar la canción en Supabase');

      // 3. Borrar de Dexie localmente
      await db.songs.delete(report.song_id);

      // Update local state
      setReports(reports.filter(r => r.song_id !== report.song_id));
      
      alert('Canción y reporte eliminados correctamente.');
    } catch (err) {
      console.error('Error deleting song and report:', err);
      alert('Hubo un error al eliminar la canción. Asegúrate de tener conexión y permisos.');
    }
  };

  const handleApprove = async (song: Song) => {
    if (song.id == null) return;
    try {
      await updateSong(song.id, { isVerified: true });
      await db.songs.update(song.id, { isVerified: true });
    } catch (err) {
      console.error('Error approving song:', err);
      alert('Error al aprobar la canción.');
    }
  };

  const handleReject = async (song: Song) => {
    if (song.id == null) return;
    if (!window.confirm(`¿Rechazar "${song.title}"? Esto la volverá privada.`)) return;
    try {
      await updateSong(song.id, { isPublic: false, isVerified: false });
      await db.songs.update(song.id, { isPublic: false, isVerified: false });
    } catch (err) {
      console.error('Error rejecting song:', err);
      alert('Error al rechazar la canción.');
    }
  };

  if (loading && activeTab === 'reports') {
    return (
      <div className="reports-view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando reportes...</p>
      </div>
    );
  }

  return (
    <div className="reports-view" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={28} color="var(--primary)" />
          Gestión de Canciones
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Administra los reportes de contenido y las canciones pendientes de aprobación.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'reports' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'reports' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <AlertCircle size={16} />
          Reportes {reports.length > 0 && <span style={{ background: 'var(--red)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', marginLeft: '4px' }}>{reports.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'pending' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'pending' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Clock size={16} />
          Pendientes de Aprobación {pendingSongs.length > 0 && <span style={{ background: 'var(--gold)', color: 'black', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', marginLeft: '4px', fontWeight: 700 }}>{pendingSongs.length}</span>}
        </button>
      </div>

      {activeTab === 'reports' ? (
        reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <AlertCircle size={48} style={{ color: 'var(--blue)', marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Todo al día</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay reportes de canciones pendientes.</p>
            <button 
              onClick={loadReports}
              style={{ 
                marginTop: '1.5rem', 
                padding: '0.5rem 1rem', 
                background: 'var(--blue)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer' 
              }}
            >
              Actualizar ahora
            </button>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '1.5rem' 
          }}>
          {reports.map((report) => (
            <div 
              key={report.id} 
              style={{ 
                background: 'var(--bg-elevated)', 
                borderRadius: '16px', 
                padding: '1.5rem',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                transition: 'all 0.2s ease-out',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--gold-dim)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
              }}
            >
              {/* Decorative top border */}
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px', 
                background: 'linear-gradient(90deg, var(--gold), var(--blue))',
                opacity: 0.8
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: 600, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    <Music size={18} color="var(--gold)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {report.songs?.title || 'Canción desconocida'} 
                      {report.songs?.artist ? ` - ${report.songs.artist}` : ''}
                    </span>
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} />
                      {report.reason}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} />
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ 
                background: 'var(--bg-surface)', 
                padding: '1rem', 
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                borderLeft: '3px solid var(--border-light)',
                flex: 1
              }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Detalles del reporte</strong>
                {report.details || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Sin detalles adicionales.</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: 'auto' }}>
                <button 
                  className="btn secondary"
                  onClick={async () => {
                    setLoadingSongId(report.song_id);
                    try {
                      const store = useAppStore.getState();
                      const song = await fetchSongById(report.song_id);
                      if (song) {
                        store.setEditingSong(song);
                        store.setActiveView('editor');
                      } else {
                        alert('No se pudo encontrar la canción. Puede que haya sido eliminada.');
                      }
                    } finally {
                      setLoadingSongId(null);
                    }
                  }}
                  disabled={loadingSongId === report.song_id}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '10px',
                    borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)', transition: 'all 0.15s',
                    opacity: loadingSongId === report.song_id ? 0.6 : 1,
                    cursor: loadingSongId === report.song_id ? 'wait' : 'pointer'
                  }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--bg-hover)')}
                  title="Cargar canción en el editor"
                >
                  <Music size={14} />
                  {loadingSongId === report.song_id ? 'Cargando...' : 'Editar'}
                </button>
                <button 
                  className="btn secondary"
                  onClick={() => deleteSongAndReport(report)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    background: 'rgba(224, 85, 85, 0.1)', border: '1px solid rgba(224, 85, 85, 0.3)', padding: '10px',
                    borderRadius: '8px', fontSize: '12px', color: 'var(--red)', transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(224, 85, 85, 0.1)'; e.currentTarget.style.color = 'var(--red)'; }}
                  title="Eliminar esta canción permanentemente"
                >
                  <Trash2 size={14} />
                  Borrar Canción
                </button>
                <button 
                  className="btn primary"
                  onClick={() => deleteReport(report.id)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    background: 'var(--green)', border: 'none', padding: '10px',
                    borderRadius: '8px', fontSize: '12px', color: '#fff', fontWeight: 600, transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                  title="Marcar reporte como resuelto sin borrar la canción"
                >
                  <CheckCircle size={14} />
                  Resuelto
                </button>
              </div>
            </div>
          ))}
        </div>
        )
      ) : (
        pendingSongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <CheckCircle size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: '18px', marginBottom: '0.5rem' }}>Todo al día</h3>
            <p style={{ color: 'var(--text-secondary)' }}>No hay canciones pendientes de moderación.</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {pendingSongs.map((song) => (
              <div 
                key={song.id} 
                style={{ 
                  background: 'var(--bg-elevated)', 
                  borderRadius: '16px', 
                  padding: '1.5rem',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  transition: 'all 0.2s ease-out',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--gold-dim)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
                }}
              >
                {/* Decorative top border */}
                <div style={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, height: '4px', 
                  background: 'linear-gradient(90deg, var(--gold), transparent)',
                  opacity: 0.8
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: 600, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      marginBottom: '0.5rem',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      <Music size={18} color="var(--gold)" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {song.title} 
                      </span>
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={14} />
                        {song.artist || 'Sin artista'}
                      </span>
                      {song.language && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={14} />
                          {song.language}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: 'auto' }}>
                  <button 
                    className="btn secondary"
                    onClick={() => setPreviewSong(song)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '10px',
                      borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)', transition: 'all 0.15s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--bg-surface)')}
                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--bg-hover)')}
                    title="Revisar letra de la canción"
                  >
                    <FileText size={14} />
                    Revisar
                  </button>
                  <button 
                    className="btn secondary"
                    onClick={() => handleReject(song)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: 'rgba(224, 85, 85, 0.1)', border: '1px solid rgba(224, 85, 85, 0.3)', padding: '10px',
                      borderRadius: '8px', fontSize: '12px', color: 'var(--red)', transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(224, 85, 85, 0.1)'; e.currentTarget.style.color = 'var(--red)'; }}
                    title="Rechazar y hacer privada"
                  >
                    <X size={14} />
                    Rechazar
                  </button>
                  <button 
                    className="btn primary"
                    onClick={() => handleApprove(song)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: 'var(--green)', border: 'none', padding: '10px',
                      borderRadius: '8px', fontSize: '12px', color: '#fff', fontWeight: 600, transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                    title="Aprobar y verificar esta canción para todos"
                  >
                    <Check size={14} />
                    Aprobar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal de previsualización */}
      {previewSong && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '2rem'
        }} onClick={() => setPreviewSong(null)}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: '16px', width: '100%', maxWidth: '600px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Music size={20} color="var(--gold)" />
                  {previewSong.title}
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', display: 'flex', gap: '1rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} />{previewSong.artist || 'Sin artista'}</span>
                  {previewSong.language && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} />{previewSong.language}</span>}
                </div>
              </div>
              <button onClick={() => setPreviewSong(null)} className="btn-icon" style={{ background: 'transparent' }} aria-label="Cerrar modal">
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)', fontSize: '14px', lineHeight: '1.6', background: 'var(--bg-surface)' }}>
              {previewSong.lyrics}
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button 
                className="btn secondary"
                onClick={async () => {
                  setPreviewSong(null);
                  if (previewSong.id) {
                    setLoadingSongId(previewSong.id);
                    try {
                      const store = useAppStore.getState();
                      store.setEditingSong(previewSong);
                      store.setActiveView('editor');
                    } finally {
                      setLoadingSongId(null);
                    }
                  }
                }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '8px', fontWeight: 500
                }}
              >
                <Edit2 size={16} /> Editar
              </button>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn secondary"
                  onClick={() => { handleReject(previewSong); setPreviewSong(null); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(224, 85, 85, 0.1)', color: 'var(--red)',
                    border: '1px solid rgba(224, 85, 85, 0.3)', padding: '10px 20px', borderRadius: '8px', fontWeight: 500
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(224, 85, 85, 0.1)'; e.currentTarget.style.color = 'var(--red)'; }}
                >
                  <X size={16} /> Rechazar
                </button>
                <button 
                  className="btn primary"
                  onClick={() => { handleApprove(previewSong); setPreviewSong(null); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--green)', color: '#fff', border: 'none',
                    padding: '10px 20px', borderRadius: '8px', fontWeight: 600
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  <Check size={16} /> Aprobar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
