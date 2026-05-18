import { useEffect, useState } from "react";
import { 
  Users, 
  Calendar, 
  Download, 
  Search,
  UserCheck,
  Shield,
  Star,
  ArrowUpDown,
  RefreshCcw,
  Zap,
  ZapOff
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/stores";
import { supabase } from "@/services/supabase";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  role: string;
  is_authorized: boolean;
}

export default function AdminUsersView() {
  const { userRole } = useAppStore(
    useShallow((s) => ({
      userRole: s.userRole,
    })),
  );

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'premium'>('all');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, created_at, plan, role, is_authorized')
        .order('created_at', { ascending: sortOrder === 'asc' });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      fetchUsers();
    }
  }, [userRole, sortOrder]);

  const toggleAuthorized = async (u: UserProfile) => {
    const newVal = !u.is_authorized;
    if (!confirm(`¿${newVal ? 'Autorizar' : 'Desautorizar'} a ${u.email} para publicar sin revisión?`)) return;
    setUpdatingUserId(u.id);
    try {
      await supabase.from('profiles').update({ is_authorized: newVal }).eq('id', u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_authorized: newVal } : x));
    } catch {
      alert('Error al cambiar autorización.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleTogglePlan = async (userId: string, currentPlan: string) => {
    if (updatingUserId) return;
    
    const newPlan = currentPlan === 'premium' ? 'free' : 'premium';
    const confirmMsg = `¿Estás seguro de cambiar el plan a ${newPlan.toUpperCase()} para este usuario?`;
    
    if (!window.confirm(confirmMsg)) return;

    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ plan: newPlan, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
    } catch (err) {
      console.error("Error updating plan:", err);
      alert("Error al actualizar el plan.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users
    .filter(u => {
      const matchesSearch = u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlan = filterPlan === 'all' || u.plan === filterPlan;
      return matchesSearch && matchesPlan;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  const exportCSV = () => {
    const headers = ["Email", "Fecha Registro", "Plan", "Rol"];
    const rows = filteredUsers.map(u => [
      u.email, 
      new Date(u.created_at).toLocaleDateString(), 
      u.plan, 
      u.role
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `usuarios_proclama_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (userRole !== 'admin') {
    return (
      <div className="admin-access-denied" style={{ textAlign: 'center', padding: '100px' }}>
        <Shield size={48} color="var(--red)" style={{ marginBottom: '20px' }} />
        <h2>Acceso Denegado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="admin-users-view">
      <div className="admin-users-content">
        <header className="view-header">
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
              <Users size={28} color="var(--gold)" />
              Gestión de Usuarios
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Control total de la base de datos de usuarios y suscripciones.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-icon-refresh" onClick={fetchUsers} title="Refrescar datos">
              <RefreshCcw size={18} className={loading ? "spin" : ""} />
            </button>
            <button className="btn-export" onClick={exportCSV}>
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </header>

        <div className="stats-grid">
          <div 
            className={`stat-card ${filterPlan === 'all' ? 'active-filter' : ''}`}
            onClick={() => setFilterPlan('all')}
          >
            <span className="stat-label">Total Usuarios Registrados</span>
            <span className="stat-value">{users.length}</span>
            <Users className="stat-icon" size={24} />
          </div>
          <div 
            className={`stat-card premium ${filterPlan === 'premium' ? 'active-filter' : ''}`}
            onClick={() => setFilterPlan('premium')}
          >
            <span className="stat-label">Usuarios Premium</span>
            <span className="stat-value">{users.filter(u => u.plan === 'premium').length}</span>
            <Star className="stat-icon" size={24} />
          </div>
          <div 
            className={`stat-card free ${filterPlan === 'free' ? 'active-filter' : ''}`}
            onClick={() => setFilterPlan('free')}
          >
            <span className="stat-label">Usuarios Free</span>
            <span className="stat-value">{users.filter(u => u.plan === 'free').length}</span>
            <UserCheck className="stat-icon" size={24} />
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            className={`btn-sort ${sortOrder === 'asc' ? 'active' : ''}`} 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? "Más recientes primero" : "Más antiguos primero"}
          >
            <ArrowUpDown size={18} />
          </button>
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Registro</th>
                <th>Plan</th>
                <th>Rol</th>
                <th>Autorizado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px' }}>
                    <div className="loading-spinner" />
                    <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Sincronizando usuarios...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    No se encontraron usuarios con estos criterios.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-email-cell">{u.email}</div>
                    </td>
                    <td>
                      <div className="user-date-cell">
                        {new Date(u.created_at).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </td>
                    <td>
                      <span className={`plan-badge ${u.plan}`}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`role-badge ${u.role}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="authorized-toggle"
                        onClick={() => toggleAuthorized(u)}
                        title={u.is_authorized ? 'Desautorizar' : 'Autorizar'}
                        style={{ 
                          cursor: 'pointer', fontWeight: 600, fontSize: 13,
                          color: u.is_authorized ? 'var(--green)' : 'var(--text-muted)'
                        }}
                      >
                        {u.is_authorized ? '✅ Sí' : '❌ No'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className={`action-btn ${u.plan === 'premium' ? 'remove-premium' : 'add-premium'}`}
                        onClick={() => handleTogglePlan(u.id, u.plan)}
                        disabled={updatingUserId === u.id}
                      >
                        {updatingUserId === u.id ? (
                          <RefreshCcw size={14} className="spin" />
                        ) : u.plan === 'premium' ? (
                          <><ZapOff size={14} /> Quitar Premium</>
                        ) : (
                          <><Zap size={14} /> Hacer Premium</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .admin-users-view {
          height: 100%;
          overflow-y: auto;
          background: var(--bg-base);
          position: relative;
        }

        .admin-users-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .view-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .header-actions { display: flex; gap: 12px; }

        .btn-export {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-export:hover { background: var(--bg-hover); border-color: var(--text-muted); }

        .btn-icon-refresh {
          padding: 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .btn-icon-refresh:hover { color: var(--gold); border-color: var(--gold-dim); }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .stat-card {
          background: var(--bg-elevated);
          padding: 24px;
          border-radius: 18px;
          border: 1px solid var(--border);
          position: relative;
          cursor: pointer;
          transition: all 0.2s ease-out;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .stat-card:hover { transform: translateY(-4px); border-color: var(--gold-dim); }
        .stat-card.active-filter { border-color: var(--gold); background: rgba(212, 175, 55, 0.03); }

        .stat-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
        .stat-value { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-top: 8px; display: block; }
        .stat-icon { position: absolute; right: 24px; bottom: 24px; opacity: 0.05; color: var(--gold); }

        .filters-bar {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .search-wrapper { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-wrapper input {
          width: 100%;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          padding: 14px 14px 14px 44px;
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 15px;
          transition: border-color 0.2s;
        }
        .search-wrapper input:focus { border-color: var(--gold-dim); outline: none; }

        .btn-sort {
          padding: 14px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text-secondary);
          transition: all 0.2s;
          cursor: pointer;
        }
        .btn-sort:hover { color: var(--gold); border-color: var(--gold-dim); }
        .btn-sort.active { color: var(--gold); background: rgba(212, 175, 55, 0.05); border-color: var(--gold); }

        .users-table-container {
          background: var(--bg-elevated);
          border-radius: 20px;
          border: 1px solid var(--border);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .users-table { width: 100%; border-collapse: collapse; }
        .users-table th {
          text-align: left;
          padding: 18px 24px;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .users-table td { padding: 18px 24px; border-bottom: 1px solid var(--border); }
        .users-table tr:last-child td { border-bottom: none; }
        .users-table tr:hover { background: rgba(255,255,255,0.01); }

        .user-email-cell { font-weight: 500; color: var(--text-primary); }
        .user-date-cell { color: var(--text-secondary); font-size: 13px; }

        .plan-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
        .plan-badge.free { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
        .plan-badge.premium { background: rgba(212, 175, 55, 0.1); color: var(--gold); border: 1px solid rgba(212, 175, 55, 0.2); }

        .role-badge { font-size: 12px; color: var(--text-muted); }
        .role-badge.admin { color: var(--blue); font-weight: 600; }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
          cursor: pointer;
        }
        .action-btn.add-premium { background: rgba(212, 175, 55, 0.1); color: var(--gold); }
        .action-btn.add-premium:hover { background: var(--gold); color: #000; }
        .action-btn.remove-premium { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); }
        .action-btn.remove-premium:hover { background: rgba(255, 76, 76, 0.1); color: #ff4c4c; }

        .loading-spinner {
          width: 28px; height: 28px; border: 3px solid rgba(212, 175, 55, 0.1);
          border-top-color: var(--gold); border-radius: 50%; animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: 1fr; }
          .admin-users-content { padding: 20px; }
        }
      `}</style>
    </div>
  );
}
