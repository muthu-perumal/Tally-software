import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Server, 
  Code, 
  ExternalLink,
  Zap
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import XmlModal from '../../components/XmlModal';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function TallySync() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const { addToast } = useToast();

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', content: '' });

  const loadSyncCenter = async () => {
    try {
      setLoading(true);
      const [dash, txList] = await Promise.all([
        api.getDashboard(),
        api.getTransactions({ sync_status: 'failed', limit: 50 }),
      ]);
      const pendingList = await api.getTransactions({ sync_status: 'pending', limit: 50 });

      setData({
        dashboard: dash,
        failedQueue: txList.items || [],
        pendingQueue: pendingList.items || [],
      });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to load sync queue' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyncCenter();
  }, []);

  const handleSyncAllPending = async () => {
    try {
      setBulkSyncing(true);
      const res = await api.syncTransaction({ syncAllPending: true });
      addToast({
        type: 'success',
        message: `Processed ${res.processedCount} voucher(s): ${res.successCount} synced, ${res.failCount} failed.`,
      });
      loadSyncCenter();
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Bulk sync failed' });
    } finally {
      setBulkSyncing(false);
    }
  };

  const handleRetrySingle = async (id, voucherNumber) => {
    try {
      setRetryingId(id);
      const res = await api.retrySync(id);
      if (res.success && res.status === 'synced') {
        addToast({ type: 'success', message: `Voucher #${voucherNumber} posted to Tally.` });
      } else {
        addToast({ type: 'warning', message: `Sync failed for #${voucherNumber}: ${res.message || 'Error'}` });
      }
      loadSyncCenter();
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Retry failed' });
    } finally {
      setRetryingId(null);
    }
  };

  const inspectPayloads = async (txId, isResponse = false) => {
    try {
      const details = await api.getTransaction(txId);
      const latestLog = details.syncLogs?.[0];
      if (!latestLog) {
        addToast({ type: 'info', message: 'No sync log payload available for this voucher.' });
        return;
      }

      setModalConfig({
        isOpen: true,
        title: isResponse
          ? `Tally Response XML - #${details.transaction.voucher_number}`
          : `Tally Request XML - #${details.transaction.voucher_number}`,
        content: isResponse ? latestLog.response_payload : latestLog.request_payload,
      });
    } catch (err) {
      addToast({ type: 'error', message: 'Could not load XML payloads' });
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
        <RotateCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
        <p>Loading Tally synchronization monitor...</p>
      </div>
    );
  }

  const stats = data?.dashboard?.stats || {};
  const health = data?.dashboard?.tallyHealth || {};
  const failedItems = data?.failedQueue || [];
  const pendingItems = data?.pendingQueue || [];
  const combinedQueue = [...pendingItems, ...failedItems];

  return (
    <div>
      {/* Metrics Row */}
      <div className="stat-grid">
        <StatCard
          label="Tally Connection"
          value={health.mode === 'mock' ? 'Mock Engine' : health.online ? 'Connected' : 'Offline'}
          icon={Server}
          color={health.online ? '#10b981' : '#ef4444'}
          bg={health.online ? '#ecfdf5' : '#fef2f2'}
        />
        <StatCard
          label="Synced Today"
          value={stats.synced_today || 0}
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
          label="Failed Queue"
          value={stats.failed_count || 0}
          icon={AlertTriangle}
          color="#ef4444"
          bg="#fef2f2"
        />
      </div>

      {/* Sync Queue Manager */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Pending & Failed Synchronization Queue</h2>
            <p className="card-subtitle">
              Monitor, retry, and inspect XML payloads for vouchers requiring Tally sync
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadSyncCenter}
              disabled={loading}
            >
              <RotateCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh Queue</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSyncAllPending}
              disabled={bulkSyncing || (stats.pending_count === 0 && stats.failed_count === 0)}
            >
              <Zap size={14} />
              <span>{bulkSyncing ? 'Processing Queue...' : 'Sync Pending Queue'}</span>
            </button>
          </div>
        </div>

        {combinedQueue.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#10b981' }}>
            <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>All Vouchers Are In Sync</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              There are no pending or failed transactions in the Tally synchronization queue.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th>Party</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedQueue.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 600 }}>{tx.voucher_number}</td>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(tx.voucher_date).toLocaleDateString('en-GB')}
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
                    <td style={{ color: '#64748b', fontSize: 12 }}>
                      {new Date(tx.created_at).toLocaleString('en-GB')}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title="View Request XML"
                          onClick={() => inspectPayloads(tx.id, false)}
                        >
                          <Code size={12} />
                          <span>Req XML</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title="View Response XML"
                          onClick={() => inspectPayloads(tx.id, true)}
                        >
                          <Code size={12} />
                          <span>Resp XML</span>
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => handleRetrySingle(tx.id, tx.voucher_number)}
                          disabled={retryingId === tx.id}
                        >
                          <RotateCw size={12} className={retryingId === tx.id ? 'spin' : ''} />
                          <span>Retry</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <XmlModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        xmlContent={modalConfig.content}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </div>
  );
}
