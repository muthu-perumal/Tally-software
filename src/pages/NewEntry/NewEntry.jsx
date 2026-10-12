import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Building2,
  RotateCw 
} from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const VOUCHER_TYPES = ['Sales', 'Purchase', 'Payment', 'Receipt', 'Journal', 'Contra'];

function generateRandomVoucherNumber(type = 'Sales') {
  const prefix = type === 'Sales' ? 'INV' : type === 'Purchase' ? 'PUR' : type === 'Payment' ? 'PAY' : type === 'Receipt' ? 'REC' : type === 'Contra' ? 'CON' : 'JRN';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${new Date().getFullYear()}-${rand}`;
}

export default function NewEntry() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { addToast } = useToast();
  const outletCtx = useOutletContext() || {};

  const [companyName, setCompanyName] = useState(outletCtx.companyName || 'DhanaLakshmi & Co');
  const [masters, setMasters] = useState({ ledgers: [], items: [] });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null);

  const [formData, setFormData] = useState({
    voucher_type: 'Sales',
    voucher_number: generateRandomVoucherNumber('Sales'),
    voucher_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    party_ledger: 'Acme Infotech Ltd',
    account_ledger: 'Sales Account - GST',
    narration: '',
    debit_credit: 'Dr',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
  });

  const [items, setItems] = useState([
    {
      item_name: '',
      description: '',
      quantity: 1,
      rate: 0,
      discount: 0,
      tax_percentage: 18,
      tax_amount: 0,
      amount: 0,
    },
  ]);

  // Load masters & existing data if editing
  useEffect(() => {
    const init = async () => {
      try {
        const [m, settingsRes] = await Promise.allSettled([
          api.getMasters(),
          api.getSettings(),
        ]);

        if (settingsRes.status === 'fulfilled' && settingsRes.value) {
          const s = settingsRes.value;
          if (s.tally_company || s.company_name) {
            setCompanyName(s.tally_company || s.company_name);
          }
        }

        if (m.status === 'fulfilled' && m.value) {
          const masterData = m.value;
          setMasters(masterData);

          if (!isEditMode && masterData.ledgers?.length > 0) {
            const defaultParty = masterData.ledgers.find((l) => l.is_party)?.name || masterData.ledgers[0].name;
            setFormData((prev) => ({
              ...prev,
              party_ledger: prev.party_ledger || defaultParty,
            }));
          }
        }

        if (isEditMode) {
          setLoading(true);
          const txData = await api.getTransaction(id);
          const t = txData.transaction;
          setFormData({
            voucher_type: t.voucher_type,
            voucher_number: t.voucher_number,
            voucher_date: t.voucher_date.split('T')[0],
            reference_number: t.reference_number || '',
            party_ledger: t.party_ledger,
            account_ledger: t.account_ledger,
            narration: t.narration || '',
            debit_credit: t.debit_credit,
            subtotal: parseFloat(t.subtotal) || 0,
            tax_amount: parseFloat(t.tax_amount) || 0,
            total_amount: parseFloat(t.total_amount) || 0,
          });

          if (txData.items && txData.items.length > 0) {
            setItems(txData.items.map((it) => ({
              item_name: it.item_name,
              description: it.description || '',
              quantity: parseFloat(it.quantity) || 1,
              rate: parseFloat(it.rate) || 0,
              discount: parseFloat(it.discount) || 0,
              tax_percentage: parseFloat(it.tax_percentage) || 0,
              tax_amount: parseFloat(it.tax_amount) || 0,
              amount: parseFloat(it.amount) || 0,
            })));
          }
        }
      } catch (err) {
        console.warn('Init entry warning:', err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEditMode]);

  const handleVoucherTypeChange = (newType) => {
    let defaultAcc = 'Sales Account - GST';
    if (newType === 'Purchase') defaultAcc = 'Purchase Account - GST';
    if (newType === 'Payment' || newType === 'Receipt') defaultAcc = 'HDFC Bank Current A/c';
    if (newType === 'Contra') defaultAcc = 'Cash-in-Hand';
    if (newType === 'Journal') defaultAcc = 'Office Rent Expense';

    setFormData((prev) => ({
      ...prev,
      voucher_type: newType,
      voucher_number: isEditMode ? prev.voucher_number : generateRandomVoucherNumber(newType),
      account_ledger: defaultAcc,
      debit_credit: (newType === 'Sales' || newType === 'Payment') ? 'Dr' : 'Cr',
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };

      if (field === 'item_name') {
        const matched = masters.items?.find((m) => m.name === value);
        if (matched) {
          updated.rate = parseFloat(matched.default_rate) || updated.rate;
          updated.tax_percentage = parseFloat(matched.default_tax_rate) || updated.tax_percentage;
        }
      }

      // Compute item amount immediately
      const qty = parseFloat(updated.quantity) || 0;
      const rate = parseFloat(updated.rate) || 0;
      const disc = parseFloat(updated.discount) || 0;
      const taxRate = parseFloat(updated.tax_percentage) || 0;

      const base = Math.max(0, (qty * rate) - disc);
      const itemTax = (base * taxRate) / 100;
      const itemTotal = base + itemTax;

      updated.tax_amount = parseFloat(itemTax.toFixed(2));
      updated.amount = parseFloat(itemTotal.toFixed(2));

      next[index] = updated;

      // Recalculate totals across all line items
      let sub = 0;
      let totalTax = 0;
      next.forEach((it) => {
        const iQty = parseFloat(it.quantity) || 0;
        const iRate = parseFloat(it.rate) || 0;
        const iDisc = parseFloat(it.discount) || 0;
        const iTaxRate = parseFloat(it.tax_percentage) || 0;
        const iBase = Math.max(0, (iQty * iRate) - iDisc);
        const iTax = (iBase * iTaxRate) / 100;
        sub += iBase;
        totalTax += iTax;
      });

      setFormData((fPrev) => ({
        ...fPrev,
        subtotal: parseFloat(sub.toFixed(2)),
        tax_amount: parseFloat(totalTax.toFixed(2)),
        total_amount: parseFloat((sub + totalTax).toFixed(2)),
      }));

      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        item_name: '',
        description: '',
        quantity: 1,
        rate: 0,
        discount: 0,
        tax_percentage: 18,
        tax_amount: 0,
        amount: 0,
      },
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) {
      addToast({ type: 'warning', message: 'Voucher must have at least one line item.' });
      return;
    }
    const filtered = items.filter((_, i) => i !== index);
    setItems(filtered);

    // Recalculate totals
    let sub = 0;
    let totalTax = 0;
    filtered.forEach((it) => {
      const iQty = parseFloat(it.quantity) || 0;
      const iRate = parseFloat(it.rate) || 0;
      const iDisc = parseFloat(it.discount) || 0;
      const iTaxRate = parseFloat(it.tax_percentage) || 0;
      const iBase = Math.max(0, (iQty * iRate) - iDisc);
      const iTax = (iBase * iTaxRate) / 100;
      sub += iBase;
      totalTax += iTax;
    });

    setFormData((fPrev) => ({
      ...fPrev,
      subtotal: parseFloat(sub.toFixed(2)),
      tax_amount: parseFloat(totalTax.toFixed(2)),
      total_amount: parseFloat((sub + totalTax).toFixed(2)),
    }));
  };

  const handleSubmit = async (saveAndSync = true, isDraft = false) => {
    const vNum = formData.voucher_number?.trim() || generateRandomVoucherNumber(formData.voucher_type);

    if (!formData.party_ledger?.trim()) {
      addToast({ type: 'error', message: 'Party Ledger is required' });
      return;
    }
    if (!formData.account_ledger?.trim()) {
      addToast({ type: 'error', message: 'Account Ledger is required' });
      return;
    }

    const totalAmt = parseFloat(formData.total_amount) || 0;
    if (totalAmt <= 0) {
      addToast({ type: 'error', message: 'Total amount must be greater than zero. Please enter line item rate or amount.' });
      return;
    }

    setSubmitting(true);
    setSaveProgress({
      step: 'saving',
      message: `Saving transaction #${vNum} to PostgreSQL database...`,
    });

    try {
      const payload = {
        ...formData,
        voucher_number: vNum,
        is_draft: isDraft,
        auto_sync: saveAndSync && !isDraft,
        items: (formData.voucher_type === 'Sales' || formData.voucher_type === 'Purchase') ? items : [],
      };

      let result;
      if (isEditMode) {
        result = await api.updateTransaction(id, payload);
        addToast({ type: 'success', message: 'Transaction updated successfully.' });
        navigate(`/transactions/${id}`);
        return;
      } else {
        result = await api.createTransaction(payload);
      }

      const tx = result.transaction;
      const sync = result.syncResult;

      if (isDraft) {
        setSaveProgress({
          step: 'saved',
          message: 'Transaction saved as draft.',
        });
        addToast({ type: 'success', message: 'Draft saved successfully.' });
        setTimeout(() => navigate('/transactions'), 1200);
        return;
      }

      setSaveProgress({
        step: 'pending',
        message: 'Transaction saved successfully. Pending Tally Sync...',
      });

      if (saveAndSync) {
        if (sync && sync.success && sync.status === 'synced') {
          setSaveProgress({
            step: 'synced',
            message: `Transaction successfully posted to Tally in company "${companyName}"!`,
          });
          addToast({ type: 'success', message: 'Transaction successfully posted to Tally.' });
          setTimeout(() => navigate(`/transactions/${tx.id}`), 1200);
        } else if (sync && sync.mode === 'bridge') {
          setSaveProgress({
            step: 'pending',
            message: 'Transaction saved. Queued for Local Tally Bridge execution.',
          });
          addToast({ type: 'info', message: 'Transaction queued for Local Tally Bridge.' });
          setTimeout(() => navigate(`/transactions/${tx.id}`), 1500);
        } else {
          setSaveProgress({
            step: 'failed',
            message: `Transaction was saved, but Tally synchronization failed: ${sync?.message || 'Connection error'}. You can retry anytime.`,
          });
          addToast({ type: 'warning', message: 'Transaction saved, but Tally sync failed.' });
        }
      } else {
        addToast({ type: 'success', message: 'Transaction saved in database.' });
        navigate('/transactions');
      }
    } catch (err) {
      setSaveProgress({
        step: 'failed',
        message: `Error: ${err.message}`,
      });
      addToast({ type: 'error', message: err.message || 'Failed to save transaction' });
    } finally {
      setSubmitting(false);
    }
  };

  const isSalesOrPurchase = formData.voucher_type === 'Sales' || formData.voucher_type === 'Purchase';

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading transaction form...</div>;
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Top Banner showing Active Company */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={20} color="#2563eb" />
          <div>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>
              Target Accounting Company
            </span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>
              {companyName}
            </div>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/settings')}
          style={{ fontSize: 12, backgroundColor: '#ffffff' }}
        >
          Change Company
        </button>
      </div>

      {/* Progress Feedback Banner */}
      {saveProgress && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor:
              saveProgress.step === 'synced'
                ? '#ecfdf5'
                : saveProgress.step === 'failed'
                ? '#fef2f2'
                : '#eff6ff',
            border: `1px solid ${
              saveProgress.step === 'synced'
                ? '#a7f3d0'
                : saveProgress.step === 'failed'
                ? '#fecaca'
                : '#bfdbfe'
            }`,
          }}
        >
          {saveProgress.step === 'synced' && <CheckCircle2 color="#10b981" size={20} />}
          {saveProgress.step === 'failed' && <AlertCircle color="#ef4444" size={20} />}
          {(saveProgress.step === 'saving' || saveProgress.step === 'pending') && (
            <RotateCw color="#2563eb" size={20} className="spin" />
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color:
                saveProgress.step === 'synced'
                  ? '#065f46'
                  : saveProgress.step === 'failed'
                  ? '#991b1b'
                  : '#1e40af',
            }}
          >
            {saveProgress.message}
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              {isEditMode ? `Edit Transaction: ${formData.voucher_number}` : 'Create Accounting Voucher'}
            </h2>
            <p className="card-subtitle">
              Enter transaction details to commit to PostgreSQL and sync to Tally
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        </div>

        {/* Voucher Meta Form: Type, Voucher Number, Date, Reference */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            marginBottom: 20,
          }}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Voucher Type <span className="required">*</span>
              </label>
              <select
                className="form-control"
                value={formData.voucher_type}
                disabled={isEditMode}
                onChange={(e) => handleVoucherTypeChange(e.target.value)}
              >
                {VOUCHER_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Voucher Number <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.voucher_number}
                onChange={(e) => setFormData({ ...formData, voucher_number: e.target.value })}
                placeholder="e.g. INV-2026-001"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Voucher Date <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={formData.voucher_date}
                onChange={(e) => setFormData({ ...formData, voucher_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reference / PO Number</label>
              <input
                type="text"
                className="form-control"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Optional reference"
              />
            </div>
          </div>
        </div>

        {/* Ledger & Party Information */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">
              Party / Customer / Vendor Ledger <span className="required">*</span>
            </label>
            <input
              type="text"
              list="parties-list"
              className="form-control"
              value={formData.party_ledger}
              onChange={(e) => setFormData({ ...formData, party_ledger: e.target.value })}
              placeholder="Select or enter Party Ledger"
            />
            <datalist id="parties-list">
              {masters.ledgers?.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.group_name}
                </option>
              ))}
            </datalist>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">
              Account / Sales / Bank Ledger <span className="required">*</span>
            </label>
            <input
              type="text"
              list="accounts-list"
              className="form-control"
              value={formData.account_ledger}
              onChange={(e) => setFormData({ ...formData, account_ledger: e.target.value })}
              placeholder="Select or enter Account Ledger"
            />
            <datalist id="accounts-list">
              {masters.ledgers?.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.group_name}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        {/* Dynamic Line Items Section (For Sales & Purchase) */}
        {isSalesOrPurchase ? (
          <div style={{ marginTop: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Line Items & Inventory</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Item Name</th>
                    <th style={{ width: '12%' }}>Quantity</th>
                    <th style={{ width: '15%' }}>Rate (₹)</th>
                    <th style={{ width: '12%' }}>Discount (₹)</th>
                    <th style={{ width: '12%' }}>Tax %</th>
                    <th style={{ width: '15%' }}>Amount (₹)</th>
                    <th style={{ width: '6%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          list="items-list"
                          className="form-control"
                          style={{ padding: '6px 8px', fontSize: 13 }}
                          placeholder="Item name"
                          value={item.item_name}
                          onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                        />
                        <datalist id="items-list">
                          {masters.items?.map((it) => (
                            <option key={it.id} value={it.name}>
                              Default Rate: ₹{it.default_rate}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          className="form-control"
                          style={{ padding: '6px 8px', fontSize: 13 }}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          style={{ padding: '6px 8px', fontSize: 13 }}
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          style={{ padding: '6px 8px', fontSize: 13 }}
                          value={item.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="form-control"
                          style={{ padding: '6px 8px', fontSize: 13 }}
                          value={item.tax_percentage}
                          onChange={(e) => handleItemChange(idx, 'tax_percentage', e.target.value)}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          title="Remove Item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="form-row" style={{ marginTop: 12, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">
                Amount (₹) <span className="required">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="form-control"
                value={formData.total_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    subtotal: parseFloat(e.target.value) || 0,
                    total_amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Debit / Credit</label>
              <select
                className="form-control"
                value={formData.debit_credit}
                onChange={(e) => setFormData({ ...formData, debit_credit: e.target.value })}
              >
                <option value="Dr">Debit (Dr)</option>
                <option value="Cr">Credit (Cr)</option>
              </select>
            </div>
          </div>
        )}

        {/* Narration & Summary Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">Narration / Remarks</label>
            <textarea
              rows={4}
              className="form-control"
              value={formData.narration}
              onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
              placeholder="e.g. Being payment made against Bill #1004"
            />
          </div>

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: 500, color: '#0f172a' }}>
                ₹{formData.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
              <span>Tax / GST:</span>
              <span style={{ fontWeight: 500, color: '#0f172a' }}>
                ₹{formData.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 700,
                color: '#0f172a',
                borderTop: '1px solid #cbd5e1',
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <span>Total Amount:</span>
              <span style={{ color: '#2563eb' }}>
                ₹{formData.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 28,
            borderTop: '1px solid #e2e8f0',
            paddingTop: 20,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={() => handleSubmit(false, true)}
          >
            <Save size={15} />
            <span>Save as Draft</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting}
            onClick={() => handleSubmit(true, false)}
          >
            {submitting ? (
              <>
                <RotateCw size={15} className="spin" />
                <span>Processing & Syncing...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>{isEditMode ? 'Update & Sync' : 'Save & Sync to Tally'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
