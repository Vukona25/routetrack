import { STATUS } from '../utils';

export default function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: '' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}
