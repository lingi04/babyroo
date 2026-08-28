import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AdminEvent,
  EventListQuery,
  listAdminEvents,
  PublicationStatus,
  ReservationStatus,
} from '../api/adminApi';
import { StatusBadge } from '../components/StatusBadge';

const LIMIT = 50;

export function EventListPage({
  accessToken,
  refreshToken,
  onCreate,
  onEdit,
}: {
  accessToken: string;
  refreshToken: number;
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState<EventListQuery>({ publicationStatus: 'draft' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    listAdminEvents(accessToken, { ...query, limit: LIMIT, offset })
      .then(result => {
        if (!alive) return;
        setEvents(result.events);
        setCount(result.count);
      })
      .catch(() => {
        if (alive) setError('이벤트 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accessToken, offset, query, refreshToken]);

  function updateQuery(next: EventListQuery) {
    setOffset(0);
    setQuery(current => ({ ...current, ...next }));
  }

  return (
    <main className="page">
      <section className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={query.q ?? ''}
            onChange={event => updateQuery({ q: event.target.value })}
            placeholder="제목, 장소, 지역, 소스 검색"
          />
        </div>
        <select
          value={query.publicationStatus ?? 'draft'}
          onChange={event => updateQuery({ publicationStatus: event.target.value as PublicationStatus | 'all' })}
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="hidden">hidden</option>
          <option value="archived">archived</option>
          <option value="all">all</option>
        </select>
        <select value={query.category ?? ''} onChange={event => updateQuery({ category: event.target.value })}>
          <option value="">카테고리 전체</option>
          <option value="experience">experience</option>
          <option value="play_space">play_space</option>
          <option value="camp">camp</option>
          <option value="exhibition">exhibition</option>
          <option value="performance">performance</option>
          <option value="class">class</option>
          <option value="festival">festival</option>
          <option value="other">other</option>
        </select>
        <select
          value={query.reservationStatus ?? ''}
          onChange={event => updateQuery({ reservationStatus: event.target.value as ReservationStatus })}
        >
          <option value="">예약상태 전체</option>
          <option value="unknown">unknown</option>
          <option value="available">available</option>
          <option value="limited">limited</option>
          <option value="closed">closed</option>
        </select>
        <input value={query.region ?? ''} onChange={event => updateQuery({ region: event.target.value })} placeholder="지역" />
        <button type="button" className="primary" onClick={onCreate}>
          새 이벤트
        </button>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="table-panel">
        <div className="table-meta">
          <strong>{count.toLocaleString()}개</strong>
          <span>최근 추가순</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>상태</th>
                <th>제목</th>
                <th>장소</th>
                <th>지역</th>
                <th>기간</th>
                <th>카테고리</th>
                <th>소스</th>
                <th>예약상태</th>
                <th>최근수정</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}>불러오는 중...</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={9}>표시할 이벤트가 없습니다.</td></tr>
              ) : (
                events.map(event => (
                  <tr key={event.id} onClick={() => onEdit(event.id)}>
                    <td><StatusBadge status={event.publicationStatus} /></td>
                    <td className="title-cell">{event.title}</td>
                    <td>{event.venueName || '-'}</td>
                    <td>{[event.region, event.locality].filter(Boolean).join(' ') || '-'}</td>
                    <td>{formatPeriod(event)}</td>
                    <td>{event.category || '-'}</td>
                    <td>{event.source}</td>
                    <td>{event.reservationStatus}</td>
                    <td>{formatDateTime(event.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - LIMIT))}>
            이전
          </button>
          <span>{count === 0 ? '0' : `${offset + 1}-${Math.min(offset + LIMIT, count)}`} / {count}</span>
          <button type="button" disabled={offset + LIMIT >= count} onClick={() => setOffset(value => value + LIMIT)}>
            다음
          </button>
        </div>
      </section>
    </main>
  );
}

function formatPeriod(event: AdminEvent): string {
  if (!event.startsAt && !event.endsAt) return '-';
  if (event.startsAt === event.endsAt) return event.startsAt ?? '-';
  return `${event.startsAt ?? '?'} - ${event.endsAt ?? '?'}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
