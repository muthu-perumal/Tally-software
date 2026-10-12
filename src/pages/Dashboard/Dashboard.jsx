import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Receipt, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  PlusCircle, 
  RefreshCw, 
  ExternalLink,
  RotateCw,
  TrendingUp,
  Server
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to load dashboard metrics' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRetry = async (transactionId, voucherNumber) => {
    try {
      setSyncingId(transactionId);
      const res = await api.retrySync(transactionId);
      if (res.success && res.status === 'synced') {
        addToast({ type: 'success', message: `Voucher #${voucherNumber} successfully posted to Tally!` });
      } else {
        addToast({ type: 'error', message: `Sync failed for #${voucherNumber}: ${res.message || 'Error'}` });
      }
      loadDashboard();
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Retry synchronization failed' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllPending = async () => {
    try {
      setBulkSyncing(true);
      const res = await api.syncTransaction({ syncAllPending: true });
      addToast({
        type: 'success',
        message: `Processed ${res.processedCount} vouchers (${res.successCount} synced, ${res.failCount} failed).`,
      });
      loadDashboard();
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Bulk sync failed' });
    } finally {
      setBulkSyncing(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px' }} />
        <p>Loading accounting statistics and synchronization status...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recent = data?.recentTransactions || [];
  const health = data?.tallyHealth || {};

  return (
    <div>
      {/* Tally Health Info Alert */}
      {health.mode === 'mock' && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: '12px 18px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={18} color="#166534" />
            <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>
              <strong>Tally Mock Mode Active:</strong> Accounting entries will simulate successful Tally XML synchronization without requiring an active Tally connection.
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/settings')}
            style={{ fontSize: 12 }}
          >
            Configure Tally
          </button>
        </div>
      )}

      {/* KPI Stats Cards Grid */}
      <div className="stat-grid">
        <StatCard
          label="Total Transactions"
          value={stats.total_count || 0}
          icon={Receipt}
          color="#2563eb"
          bg="#eff6ff"
        />
        <StatCard
          label="Synced to Tally"
          value={stats.synced_count || 0}
          icon={CheckCircle2}
          color="#10b981"
          bg="#ecfdf5"
        />
        <StatCard
          label="Pending Sync"
          value={stats.pending_count || 0}
          icon={Clock}
          color="#f59e0b"
          bg="#fffbeb"
        />
        <StatCard
          label="Failed Sync"
          value={stats.failed_count || 0}
          icon={AlertTriangle}
          color="#ef4444"
          bg="#fef2f2"
        />
      </div>

      {/* Recent Transactions Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Accounting Entries</h2>
            <p className="card-subtitle">Latest vouchers saved to database and synced with Tally</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {stats.pending_count > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSyncAllPending}
                disabled={bulkSyncing}
              >
                <RotateCw size={14} className={bulkSyncing ? 'spin' : ''} />
                <span>Sync Pending ({stats.pending_count})</span>
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/entry')}
            >
              <PlusCircle size={14} />
              <span>+ New Entry</span>
            </button>
          </div>
        </div>

        {recent.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>
            <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontSize: 14 }}>No transactions recorded yet.</p>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => navigate('/entry')}
            >
              Create First Accounting Entry
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher No</th>
                  <th>Voucher Type</th>
                  <th>Party / Ledger</th>
                  <th>Amount</th>
                  <th>Sync Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(tx.voucher_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{tx.voucher_number}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                        }}
                      >
                        {tx.voucher_type}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.party_ledger}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      ₹{parseFloat(tx.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <StatusBadge status={tx.tally_sync_status} />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {tx.tally_sync_status === 'failed' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Retry Tally Sync"
                            onClick={() => handleRetry(tx.id, tx.voucher_number)}
                            disabled={syncingId === tx.id}
                          >
                            <RotateCw size={13} className={syncingId === tx.id ? 'spin' : ''} />
                            <span>Retry</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/transactions/${tx.id}`)}
                        >
                          <ExternalLink size={13} />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 18, textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/transactions')}
          >
            View All Transactions & Detailed Filters →
          </button>
        </div>
      </div>
    </div>
  );
}
