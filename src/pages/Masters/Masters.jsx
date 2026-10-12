import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Layers, Box, Check, RotateCw } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function Masters() {
  const [activeTab, setActiveTab] = useState('ledgers'); // 'ledgers' | 'items' | 'types'
  const [data, setData] = useState({ ledgers: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { addToast } = useToast();

  // New Master Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('ledger');
  const [newMaster, setNewMaster] = useState({
    name: '',
    group_name: 'Sundry Debtors',
    is_party: true,
    unit: 'Nos',
    default_rate: 0,
    default_tax_rate: 18,
  });

  const loadMasters = async () => {
    try {
      setLoading(true);
      const res = await api.getMasters();
      setData(res);
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to load masters' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const handleCreateMaster = async (e) => {
    e.preventDefault();
    if (!newMaster.name.trim()) {
      addToast({ type: 'warning', message: 'Master name is required.' });
      return;
    }

    try {
      await api.createMaster({
        type: modalType,
        ...newMaster,
      });
      addToast({ type: 'success', message: `${modalType === 'ledger' ? 'Ledger' : 'Item'} created successfully.` });
      setIsModalOpen(false);
      setNewMaster({
        name: '',
        group_name: 'Sundry Debtors',
        is_party: true,
        unit: 'Nos',
        default_rate: 0,
        default_tax_rate: 18,
      });
      loadMasters();
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to save master' });
    }
  };

  const filteredLedgers = (data.ledgers || []).filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.group_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredItems = (data.items || []).filter((it) =>
    it.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Top Controls & Tab Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${activeTab === 'ledgers' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('ledgers')}
            >
              <Layers size={14} />
              <span>Ledgers & Parties ({data.ledgers?.length || 0})</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'items' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('items')}
            >
              <Box size={14} />
              <span>Stock Items ({data.items?.length || 0})</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'types' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('types')}
            >
              <span>Voucher Types</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search masters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 13 }}
              />
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setModalType(activeTab === 'items' ? 'item' : 'ledger');
                setIsModalOpen(true);
              }}
            >
              <Plus size={14} />
              <span>Add {activeTab === 'items' ? 'Item' : 'Ledger'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
            <RotateCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
            <p>Loading master records...</p>
          </div>
        ) : activeTab === 'ledgers' ? (
          <div>
            <div className="card-header">
              <div>
                <h3 className="card-title">Accounting & Party Ledgers</h3>
                <p className="card-subtitle">Ledgers used in voucher debit/credit mappings and Tally accounts</p>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ledger Name</th>
                    <th>Account Group</th>
                    <th>Type</th>
                    <th>Opening Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgers.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.name}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 4,
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          {l.group_name}
                        </span>
                      </td>
                      <td>
                        {l.is_party ? (
                          <span className="badge badge-synced" style={{ fontSize: 11 }}>Party Ledger</span>
                        ) : (
                          <span className="badge badge-draft" style={{ fontSize: 11 }}>Account</span>
                        )}
                      </td>
                      <td>₹{parseFloat(l.opening_balance || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'items' ? (
          <div>
            <div className="card-header">
              <div>
                <h3 className="card-title">Stock Items & Services</h3>
                <p className="card-subtitle">Inventory items available for Sales and Purchase vouchers</p>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Unit</th>
                    <th>Default Rate (₹)</th>
                    <th>Default GST %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((it) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 600 }}>{it.name}</td>
                      <td>{it.unit}</td>
                      <td>₹{parseFloat(it.default_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td>{parseFloat(it.default_tax_rate || 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Voucher Types Tab */
          <div>
            <div className="card-header">
              <div>
                <h3 className="card-title">Supported Tally Voucher Types</h3>
                <p className="card-subtitle">Standard accounting voucher types configured with XML schemas</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[
                { type: 'Sales', desc: 'Outward invoices to customers with line-item stock & tax support' },
                { type: 'Purchase', desc: 'Inward bills from suppliers with inventory allocations' },
                { type: 'Payment', desc: 'Outgoing disbursements via Bank or Cash ledgers' },
                { type: 'Receipt', desc: 'Inward collections into Bank or Cash ledgers' },
                { type: 'Journal', desc: 'General adjustment entries between debit and credit ledgers' },
                { type: 'Contra', desc: 'Bank deposits, withdrawals, and inter-bank transfers' },
              ].map((vt) => (
                <div key={vt.type} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>{vt.type}</span>
                    <span className="badge badge-synced">XML Ready</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748b' }}>{vt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Master Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">
                {modalType === 'ledger' ? 'Create New Ledger' : 'Create New Stock Item'}
              </h3>
            </div>
            <form onSubmit={handleCreateMaster}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    {modalType === 'ledger' ? 'Ledger Name' : 'Item Name'} <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={newMaster.name}
                    onChange={(e) => setNewMaster({ ...newMaster, name: e.target.value })}
                    placeholder={modalType === 'ledger' ? 'e.g. Acme Tech Solutions' : 'e.g. Wireless Mouse'}
                  />
                </div>

                {modalType === 'ledger' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Group Name</label>
                      <select
                        className="form-control"
                        value={newMaster.group_name}
                        onChange={(e) => setNewMaster({ ...newMaster, group_name: e.target.value })}
                      >
                        <option value="Sundry Debtors">Sundry Debtors (Customers)</option>
                        <option value="Sundry Creditors">Sundry Creditors (Suppliers)</option>
                        <option value="Bank Accounts">Bank Accounts</option>
                        <option value="Cash-in-hand">Cash-in-hand</option>
                        <option value="Sales Accounts">Sales Accounts</option>
                        <option value="Purchase Accounts">Purchase Accounts</option>
                        <option value="Duties & Taxes">Duties & Taxes</option>
                        <option value="Indirect Expenses">Indirect Expenses</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        id="is_party"
                        checked={newMaster.is_party}
                        onChange={(e) => setNewMaster({ ...newMaster, is_party: e.target.checked })}
                      />
                      <label htmlFor="is_party" style={{ fontSize: 13, cursor: 'pointer' }}>
                        This is a Party / Client / Vendor ledger
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Unit of Measure</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newMaster.unit}
                          onChange={(e) => setNewMaster({ ...newMaster, unit: e.target.value })}
                          placeholder="Nos, Pcs, Kgs, Box"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Default Rate (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={newMaster.default_rate}
                          onChange={(e) => setNewMaster({ ...newMaster, default_rate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Default Tax Rate (%)</label>
                      <select
                        className="form-control"
                        value={newMaster.default_tax_rate}
                        onChange={(e) => setNewMaster({ ...newMaster, default_tax_rate: e.target.value })}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
