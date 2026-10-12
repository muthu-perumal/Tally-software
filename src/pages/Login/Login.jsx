import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Login() {
  const [email, setEmail] = useState('admin@tallysync.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast({ type: 'warning', message: 'Please enter both email and password.' });
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      addToast({ type: 'success', message: 'Welcome back! Logged in successfully.' });
      navigate('/');
    } catch (err) {
      addToast({
        type: 'error',
        message: err.message || 'Login failed. Please verify your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  const setDemoAdmin = () => {
    setEmail('admin@tallysync.com');
    setPassword('admin123');
  };

  const setDemoAccountant = () => {
    setEmail('accountant@tallysync.com');
    setPassword('user123');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 36,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid #334155',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 22,
              fontWeight: 'bold',
              margin: '0 auto 14px',
            }}
          >
            T
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Tally Sync Portal</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Sign in to access your accounting ledger & Tally synchronization
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: 36 }}
              />
              <Mail
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: 11 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: 36 }}
              />
              <Lock
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: 11 }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <ShieldCheck size={16} color="#2563eb" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Quick Demo Logins:
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={setDemoAdmin}
              style={{ fontSize: 12 }}
            >
              Admin Demo
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={setDemoAccountant}
              style={{ fontSize: 12 }}
            >
              Accountant Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
