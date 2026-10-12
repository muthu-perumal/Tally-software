import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

export default function XmlModal({ isOpen, onClose, title, xmlContent }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (xmlContent) {
      navigator.clipboard.writeText(xmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="card-title">{title || 'XML Payload'}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy XML'}
            </button>
          </div>
          <pre
            style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              padding: 16,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              overflowX: 'auto',
              maxHeight: '55vh',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {xmlContent || '// No payload available'}
          </pre>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
