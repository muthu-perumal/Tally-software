import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Database,
  RefreshCw,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Server,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tallyStatus, setTallyStatus] = useState({
    status: 'checking',
    config: {},
    health: { mode: 'mock', message: 'Checking Tally status...' }
  });

  // Fetch Tally Status periodically
  const fetchStatus = async () => {
    try {
      const data = await api.getTallyStatus();
      setTallyStatus(data);
    } catch {
      setTallyStatus({
        status: 'disconnected',
        config: { companyName: 'DhanaLakshmi & Co' },
        health: { mode: 'direct', message: 'Tally connection error' }
      });
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const companyName = tallyStatus.config?.companyName || 'DhanaLakshmi & Co';

  // Determine current page title
  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/') return 'Dashboard';
    if (p.startsWith('/entry')) return 'New Accounting Entry';
    if (p.startsWith('/edit')) return 'Edit Transaction';
    if (p.startsWith('/transactions/') && p !== '/transactions') return 'Transaction Details';
    if (p.startsWith('/transactions')) return 'Transactions';
    if (p.startsWith('/masters')) return 'Masters Management';
    if (p.startsWith('/sync')) return 'Tally Sync Center';
    if (p.startsWith('/settings')) return 'Settings';
    return 'Tally Sync Portal';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isMock = tallyStatus.config?.mockMode || tallyStatus.health?.mode === 'mock';
  const isBridge = tallyStatus.config?.connectionMode === 'bridge' || tallyStatus.health?.mode === 'bridge';
  const isOnline = tallyStatus.status === 'connected' || isMock || isBridge;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ height: 'auto', minHeight: 64, padding: '14px 20px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo">T</div>
            <span className="sidebar-brand">Tally Sync Portal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            <Building2 size={13} color="#3b82f6" />
            <span style={{ fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }} title={companyName}>
              {companyName}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/entry" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <PlusCircle size={18} />
            <span>New Entry</span>
          </NavLink>

          <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <Receipt size={18} />
            <span>Transactions</span>
          </NavLink>

          <NavLink to="/masters" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <Database size={18} />
            <span>Masters</span>
          </NavLink>

          <NavLink to="/sync" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <RefreshCw size={18} />
            <span>Tally Sync</span>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name || 'Muthu Perumal'}</span>
              <span className="sidebar-user-role">{user?.role || 'Admin'}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: 8, justifyContent: 'flex-start', background: '#1e293b', color: '#cbd5e1', borderColor: '#334155' }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="btn btn-secondary btn-sm"
              style={{ display: window.innerWidth <= 768 ? 'inline-flex' : 'none' }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h1 className="topbar-title">{getPageTitle()}</h1>
            </div>
          </div>

          <div className="topbar-right">
            {/* Active Company Name Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe'
              }}
              title={`Active Tally Company: ${companyName}`}
            >
              <Building2 size={13} color="#2563eb" />
              <span>{companyName}</span>
            </div>

            {/* Tally Connectivity Badge */}
            <div
              className={`tally-status-pill ${isMock ? 'mock' : isBridge ? 'bridge' : isOnline ? 'online' : 'offline'
                }`}
              title={tallyStatus.health?.message || 'Tally Connection Status'}
            >
              <div
                className={`status-dot ${isMock ? 'mock' : isBridge ? 'bridge' : isOnline ? 'online' : 'offline'
                  }`}
              />
              <Server size={14} />
              <span>
                {isMock
                  ? 'Tally Mock Mode'
                  : isBridge
                    ? 'Local Bridge Queue'
                    : isOnline
                      ? 'Tally Online'
                      : 'Tally Offline'}
              </span>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/entry')}
            >
              <PlusCircle size={15} />
              <span>+ New Entry</span>
            </button>
          </div>
        </header>

        <main className="content-area">
          <Outlet context={{ companyName }} />
        </main>

        <footer className="app-footer">
          <div className="footer-content">
            <span className="footer-copyright">© {new Date().getFullYear()} Tally Sync Portal</span>
            <span className="footer-separator">•</span>
            <span className="footer-powered">Powered By <strong>@Dhanalakshmi Muthu</strong></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
