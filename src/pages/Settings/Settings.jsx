import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  HelpCircle,
  Shield,
  Zap
} from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function Settings() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [settings, setSettings] = useState({
    app_name: 'Tally Sync Portal',
    company_name: 'Acme Trading & Services Ltd.',
    tally_url: 'http://localhost:9000',
    tally_company: 'Acme Trading Co (2025-2026)',
    tally_connection_mode: 'direct',
    tally_mock_mode: 'true',
    sync_timeout_ms: '8000',
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettings(res);
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to load configuration settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      await api.saveSettings({ settings });
      addToast({ type: 'success', message: 'Settings saved successfully.' });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.saveSettings({
        settings,
        test_connection: true,
      });
      setTestResult(res.testResult);
      if (res.testResult?.online) {
        addToast({ type: 'success', message: 'Tally connection test successful!' });
      } else {
        addToast({ type: 'warning', message: res.testResult?.message || 'Could not connect to Tally' });
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading application settings...</div>;
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <form onSubmit={handleSave}>
        {/* General Brand Settings */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">General Settings</h2>
              <p className="card-subtitle">Application identity and organization metadata</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Application Name</label>
              <input
                type="text"
                className="form-control"
                value={settings.app_name}
                onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
                placeholder="e.g. Tally Sync Portal"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Company Name</label>
              <input
                type="text"
                className="form-control"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="e.g. Acme Trading Ltd."
              />
            </div>
          </div>
        </div>

        {/* Tally Integration Configuration */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Tally ERP / Prime Integration</h2>
              <p className="card-subtitle">Configure XML interface, connection modes, and mock development engine</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                <Zap size={14} />
                <span>{testing ? 'Testing...' : 'Test Tally Connection'}</span>
              </button>
            </div>
          </div>

          {/* Test Result Indicator */}
          {testResult && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: testResult.online ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${testResult.online ? '#a7f3d0' : '#fecaca'}`,
              }}
            >
              {testResult.online ? (
                <CheckCircle2 color="#10b981" size={18} />
              ) : (
                <AlertCircle color="#ef4444" size={18} />
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: testResult.online ? '#065f46' : '#991b1b',
                }}
              >
                {testResult.message}
              </span>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tally HTTP URL / Endpoint</label>
              <input
                type="text"
                className="form-control"
                value={settings.tally_url}
                onChange={(e) => setSettings({ ...settings, tally_url: e.target.value })}
                placeholder="http://localhost:9000 or http://public-ip:9000"
              />
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                Default Tally XML/ODBC server port is usually 9000.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Tally Company Name</label>
              <input
                type="text"
                className="form-control"
                value={settings.tally_company}
                onChange={(e) => setSettings({ ...settings, tally_company: e.target.value })}
                placeholder="Exact Company Name in Tally"
              />
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                Must exactly match the opened company in Tally.
              </span>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Connection Mode</label>
              <select
                className="form-control"
                value={settings.tally_connection_mode}
                onChange={(e) => setSettings({ ...settings, tally_connection_mode: e.target.value })}
              >
                <option value="direct">Direct HTTP (Tally accessible on internet / public IP / VPN)</option>
                <option value="bridge">Local Tally Bridge (Tally on office localhost:9000)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Development / Mock Mode</label>
              <select
                className="form-control"
                value={settings.tally_mock_mode}
                onChange={(e) => setSettings({ ...settings, tally_mock_mode: e.target.value })}
              >
                <option value="true">Enabled (Simulate Tally responses without live Tally instance)</option>
                <option value="false">Disabled (Real Tally XML HTTP calls only)</option>
              </select>
            </div>
          </div>

          {/* Mode Explanation Card */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              marginTop: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <HelpCircle size={16} color="#2563eb" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                About Connection Modes
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              <strong>Direct Mode:</strong> Use when your Tally server has a static public IP or port forwarding enabled so cloud Netlify Functions can post XML directly.
              <br />
              <strong>Local Bridge Mode:</strong> When Tally runs on <code>http://localhost:9000</code> behind an office router, cloud servers cannot reach your computer. Run the lightweight Node agent in <code>tally-bridge/</code> on your computer to bridge transactions securely outbound.
            </p>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={15} />
            <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
