import { PublicationStatus } from '../api/adminApi';

const LABELS: Record<PublicationStatus, string> = {
  draft: '검토중',
  published: '공개',
  hidden: '숨김',
  archived: '보관',
};

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return <span className={`status-badge ${status}`}>{LABELS[status]}</span>;
}
