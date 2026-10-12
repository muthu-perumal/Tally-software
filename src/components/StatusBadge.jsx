import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, FileEdit } from 'lucide-react';

export default function StatusBadge({ status }) {
  const norm = (status || '').toLowerCase();

  switch (norm) {
    case 'synced':
      return (
        <span className="badge badge-synced">
          <CheckCircle2 size={13} />
          Synced
        </span>
      );
    case 'pending':
      return (
        <span className="badge badge-pending">
          <Clock size={13} />
          Pending
        </span>
      );
    case 'failed':
      return (
        <span className="badge badge-failed">
          <AlertTriangle size={13} />
          Failed
        </span>
      );
    case 'draft':
      return (
        <span className="badge badge-draft">
          <FileEdit size={13} />
          Draft
        </span>
      );
    default:
      return <span className="badge badge-draft">{status || 'Unknown'}</span>;
  }
}
