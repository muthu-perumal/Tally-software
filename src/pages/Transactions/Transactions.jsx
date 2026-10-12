import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Edit3, 
  RotateCw, 
  Send, 
  PlusCircle, 
  ChevronLeft, 
  ChevronRight,
  Receipt
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function Transactions() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);

  // Filters State
  const [filters, setFilters] = useState({
    search: '',
    voucher_type: 'ALL',
    sync_status: 'ALL',
    date_from: '',
    date_to: '',
  });

  const loadTransactions = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.getTransactions({
        ...filters,
        page,
        limit: 15,
      });
      setTransactions(res.items || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to fetch transactions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(1);
  }, [filters.voucher_type, filters.sync_status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadTransactions(1);
  };

  const handleSyncOrRetry = async (id, voucherNumber, isRetry = false) => {
    try {
      setSyncingId(id);
      const res = isRetry ? await api.retrySync(id) : await api.syncTransaction({ transactionId: id });
      if (res.success && res.status === 'synced') {
        addToast({ type: 'success', message: `Voucher #${voucherNumber} posted to Tally.` });
      } else {
        addToast({ type: 'warning', message: `Sync failed for #${voucherNumber}: ${res.message || 'Error'}` });
      }
      loadTransactions(pagination.page);
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Sync operation failed' });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        {/* Filter Toolbar */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search voucher #, party, ledger..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ paddingLeft: 34 }}
            />
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
          </div>

          <div style={{ width: 140 }}>
            <select
              className="form-control"
              value={filters.voucher_type}
              onChange={(e) => setFilters({ ...filters, voucher_type: e.target.value })}
            >
              <option value="ALL">All Types</option>
              <option value="Sales">Sales</option>
              <option value="Purchase">Purchase</option>
              <option value="Payment">Payment</option>
              <option value="Receipt">Receipt</option>
              <option value="Journal">Journal</option>
              <option value="Contra">Contra</option>
            </select>
          </div>

          <div style={{ width: 140 }}>
            <select
              className="form-control"
              value={filters.sync_status}
              onChange={(e) => setFilters({ ...filters, sync_status: e.target.value })}
            >
              <option value="ALL">All Status</option>
              <option value="synced">Synced</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              className="form-control"
              style={{ width: 130 }}
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              title="From Date"
            />
            <span style={{ color: '#94a3b8' }}>-</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130 }}
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              title="To Date"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-sm">
            <Filter size={14} />
            <span>Apply Filters</span>
          </button>

          {(filters.search || filters.date_from || filters.date_to || filters.voucher_type !== 'ALL' || filters.sync_status !== 'ALL') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFilters({ search: '', voucher_type: 'ALL', sync_status: 'ALL', date_from: '', date_to: '' });
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Transactions Data Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Accounting Transactions</h2>
            <p className="card-subtitle">
              Showing {transactions.length} of {pagination.total} records
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/entry')}>
            <PlusCircle size={14} />
            <span>+ New Entry</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <RotateCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
            <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>No transactions match your search or filter criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Party Ledger</th>
                  <th>Amount</th>
                  <th>Created By</th>
                  <th>Tally Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>
                      {tx.voucher_number}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(tx.voucher_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
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
                    <td style={{ color: '#64748b', fontSize: 12 }}>
                      {tx.created_by_name || 'System'}
                    </td>
                    <td>
                      <StatusBadge status={tx.tally_sync_status} />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {/* View Button */}
                        <button
                          className="btn btn-secondary btn-sm"
                          title="View Details & Sync Logs"
                          onClick={() => navigate(`/transactions/${tx.id}`)}
                        >
                          <ExternalLink size={13} />
                          <span>View</span>
                        </button>

                        {/* Edit Button (Allowed only if not yet synced) */}
                        {tx.tally_sync_status !== 'synced' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit Transaction"
                            onClick={() => navigate(`/edit/${tx.id}`)}
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                        )}

                        {/* Sync / Retry Button */}
                        {tx.tally_sync_status === 'failed' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Retry Tally Sync"
                            onClick={() => handleSyncOrRetry(tx.id, tx.voucher_number, true)}
                            disabled={syncingId === tx.id}
                          >
                            <RotateCw size={13} className={syncingId === tx.id ? 'spin' : ''} />
                            <span>Retry</span>
                          </button>
                        )}

                        {(tx.tally_sync_status === 'pending' || tx.tally_sync_status === 'draft') && (
                          <button
                            className="btn btn-primary btn-sm"
                            title="Send to Tally"
                            onClick={() => handleSyncOrRetry(tx.id, tx.voucher_number, false)}
                            disabled={syncingId === tx.id}
                          >
                            <Send size={13} />
                            <span>Sync</span>
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

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 18,
              borderTop: '1px solid #e2e8f0',
              marginTop: 14,
            }}
          >
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => loadTransactions(pagination.page - 1)}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadTransactions(pagination.page + 1)}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
