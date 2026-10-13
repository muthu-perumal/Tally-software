import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  RotateCw, 
  Edit3, 
  Code, 
  Calendar, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle,
  History,
  Info
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import XmlModal from '../../components/XmlModal';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function TransactionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [txData, setTxData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // XML Inspection Modal
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', content: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getTransaction(id);
      setTxData(res);
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to fetch transaction details' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSyncOrRetry = async (isRetry = false) => {
    try {
      setSyncing(true);
      const res = isRetry ? await api.retrySync(id) : await api.syncTransaction({ transactionId: id });
      if (res.success && res.status === 'synced') {
        addToast({ type: 'success', message: 'Transaction successfully posted to Tally!' });
      } else {
        addToast({ type: 'warning', message: `Sync failed: ${res.message || 'Error occurred'}` });
      }
      loadData();
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
        <RotateCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
        <p>Loading voucher details and sync history...</p>
      </div>
    );
  }

  if (!txData) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
        <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 18, color: '#0f172a', marginBottom: 8 }}>Transaction Not Found</h3>
        <p style={{ marginBottom: 20 }}>The requested voucher ID does not exist in the database.</p>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/transactions')}>
          <ArrowLeft size={14} />
          <span>Back to Transactions</span>
        </button>
      </div>
    );
  }

  const { transaction: tx, items = [], syncLogs = [] } = txData;
  const isSynced = tx.tally_sync_status === 'synced';

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/transactions')}>
          <ArrowLeft size={14} />
          <span>Back to Transactions</span>
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          {!isSynced && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/edit/${tx.id}`)}>
              <Edit3 size={14} />
              <span>Edit Voucher</span>
            </button>
          )}

          {tx.tally_sync_status === 'failed' && (
            <button className="btn btn-secondary btn-sm" onClick={() => handleSyncOrRetry(true)} disabled={syncing}>
              <RotateCw size={14} className={syncing ? 'spin' : ''} />
              <span>Retry Tally Sync</span>
            </button>
          )}

          {tx.tally_sync_status !== 'synced' && tx.tally_sync_status !== 'failed' && (
            <button className="btn btn-primary btn-sm" onClick={() => handleSyncOrRetry(false)} disabled={syncing}>
              <Send size={14} />
              <span>Send to Tally</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Voucher Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 className="card-title" style={{ fontSize: 20 }}>
                {tx.voucher_type} Voucher #{tx.voucher_number}
              </h2>
              <StatusBadge status={tx.tally_sync_status} />
            </div>
            <p className="card-subtitle" style={{ marginTop: 4 }}>
              Reference: {tx.reference_number || 'N/A'} • Created on{' '}
              {new Date(tx.created_at).toLocaleString('en-GB')} by {tx.created_by_name || 'System'}
            </p>
          </div>

          {/* Tally Identifiers if synced */}
          {tx.tally_master_id && (
            <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
              <div><strong>Tally Master ID:</strong> {tx.tally_master_id}</div>
              {tx.tally_alter_id && <div><strong>Tally Alter ID:</strong> {tx.tally_alter_id}</div>}
            </div>
          )}
        </div>

        {/* Ledger & Financial Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, margin: '20px 0' }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Party / Ledger</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
              {tx.party_ledger}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Account Ledger</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
              {tx.account_ledger}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Voucher Date</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
              {new Date(tx.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Total Amount</span>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
              ₹{parseFloat(tx.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({tx.debit_credit})
            </div>
          </div>
        </div>

        {/* Line Items Table if present */}
        {items.length > 0 && (
          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 10 }}>
              Line Items ({items.length})
            </h3>
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Rate (₹)</th>
                    <th>Discount (₹)</th>
                    <th>Tax %</th>
                    <th>Tax Amount (₹)</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 500 }}>{it.item_name}</td>
                      <td>{parseFloat(it.quantity)}</td>
                      <td>₹{parseFloat(it.rate).toFixed(2)}</td>
                      <td>₹{parseFloat(it.discount).toFixed(2)}</td>
                      <td>{parseFloat(it.tax_percentage)}%</td>
                      <td>₹{parseFloat(it.tax_amount).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{parseFloat(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Narration */}
        {tx.narration && (
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: 6, marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Narration:</span>
            <p style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>{tx.narration}</p>
          </div>
        )}
      </div>

      {/* Sync Audit History & Diagnostic Logs */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="#2563eb" />
            <h3 className="card-title">Tally Synchronization Audit Trail</h3>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {syncLogs.length} Sync Attempt(s) Logged
          </span>
        </div>

        {syncLogs.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>
            No synchronization attempts made yet. Click "Send to Tally" to initiate sync.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Timestamp</th>
                  <th>HTTP Status</th>
                  <th>Sync Result</th>
                  <th>Error / Message</th>
                  <th style={{ textAlign: 'right' }}>Payloads</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>#{log.attempt_number}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>
                      {new Date(log.created_at).toLocaleString('en-GB')}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 500,
                          backgroundColor: log.http_status === 200 ? '#ecfdf5' : '#fef2f2',
                          color: log.http_status === 200 ? '#065f46' : '#991b1b',
                        }}
                      >
                        {log.http_status || 'Network Error'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={log.sync_status} />
                    </td>
                    <td style={{ maxWidth: 300, fontSize: 12, color: log.error_message ? '#ef4444' : '#64748b' }}>
                      {log.error_message || 'Success'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {log.request_payload && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() =>
                              setModalConfig({
                                isOpen: true,
                                title: `Tally Request XML (Attempt #${log.attempt_number})`,
                                content: log.request_payload,
                              })
                            }
                          >
                            <Code size={12} />
                            <span>Request XML</span>
                          </button>
                        )}
                        {log.response_payload && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() =>
                              setModalConfig({
                                isOpen: true,
                                title: `Tally Response XML (Attempt #${log.attempt_number})`,
                                content: log.response_payload,
                              })
                            }
                          >
                            <Code size={12} />
                            <span>Response XML</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* XML Inspection Modal */}
      <XmlModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        xmlContent={modalConfig.content}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </div>
  );
}
