import { useEffect, useId, useState } from 'react';
import { AdminEvent, getAdminEvent, listAdminEvents } from '../api/adminApi';
import { StatusBadge } from './StatusBadge';

const PAGE_SIZE = 10;
type Results = {
  key: string;
  events: AdminEvent[];
  count: number;
  error: boolean;
};

export function CrowdingEventPicker({
  accessToken,
  initialEventId,
  refreshToken,
  disabled,
  onSelect,
}: {
  accessToken: string;
  initialEventId: string;
  refreshToken: number;
  disabled: boolean;
  onSelect: (event: AdminEvent | null) => void;
}) {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [initialRetry, setInitialRetry] = useState(0);
  const [selected, setSelected] = useState<AdminEvent | null>(null);
  const [hydrating, setHydrating] = useState(Boolean(initialEventId));
  const [initialError, setInitialError] = useState(false);
  const [results, setResults] = useState<Results>();
  const key = JSON.stringify([accessToken, query, offset, retry, refreshToken]);
  const loading = results?.key !== key;
  const visible = loading ? undefined : results;

  useEffect(() => {
    let live = true;
    listAdminEvents(accessToken, {
      q: query,
      publicationStatus: 'all',
      limit: PAGE_SIZE,
      offset,
    })
      .then(result => {
        if (live) setResults({ key, ...result, error: false });
      })
      .catch(() => {
        if (live) setResults({ key, events: [], count: 0, error: true });
      });
    return () => {
      live = false;
    };
  }, [accessToken, query, offset, key]);

  useEffect(() => {
    let live = true;
    onSelect(null);
    if (!initialEventId) return;
    setHydrating(true);
    setInitialError(false);
    getAdminEvent(accessToken, initialEventId)
      .then(event => {
        if (!live) return;
        setSelected(event);
        onSelect(event);
      })
      .catch(() => {
        if (live) setInitialError(true);
      })
      .finally(() => {
        if (live) setHydrating(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, initialEventId, initialRetry, onSelect]);

  return (
    <div className="crowding-event-picker">
      <form
        onSubmit={e => {
          e.preventDefault();
          setOffset(0);
          setQuery(search.trim());
          setRetry(value => value + 1);
        }}
      >
        <fieldset disabled={disabled}>
          <label htmlFor={searchId}>이벤트 선택</label>
          <div className="crowding-event-search">
            <input
              id={searchId}
              type="search"
              value={search}
              placeholder="제목, 장소명, 주소 검색"
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="primary">
              검색
            </button>
          </div>
        </fieldset>
      </form>
      {hydrating && <p role="status">선택한 이벤트를 불러오는 중…</p>}
      {initialError && (
        <div className="alert" role="alert">
          <p>
            연결할 이벤트를 불러오지 못했습니다. 삭제되었거나 접근할 수 없는
            이벤트일 수 있습니다.
          </p>
          <button
            type="button"
            disabled={disabled || hydrating}
            onClick={() => setInitialRetry(value => value + 1)}
          >
            선택한 이벤트 다시 불러오기
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">이벤트 목록을 불러오는 중…</p>
      ) : visible?.error ? (
        <div className="alert" role="alert">
          <p>이벤트 목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRetry(value => value + 1)}
          >
            목록 다시 불러오기
          </button>
        </div>
      ) : (
        <>
          <p className="crowding-event-meta" role="status">
            검색 결과 {visible?.count.toLocaleString()}개 · 전체 상태
          </p>
          {visible?.events.length ? (
            <fieldset
              className="crowding-event-results"
              disabled={disabled || hydrating}
            >
              <legend className="sr-only">연결할 이벤트</legend>
              {visible.events.map(event => (
                <label
                  key={event.id}
                  className={`crowding-event-option${
                    selected?.id === event.id ? ' is-selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name={searchId}
                    value={event.id}
                    checked={selected?.id === event.id}
                    onChange={() => {
                      setSelected(event);
                      setInitialError(false);
                      onSelect(event);
                    }}
                  />
                  <span className="crowding-event-copy">
                    <strong>{event.title || '제목 없음'}</strong>
                    <span>{event.venueName || '장소명 없음'}</span>
                    <small>
                      {event.address ||
                        [event.region, event.locality]
                          .filter(Boolean)
                          .join(' ') ||
                        '주소 없음'}
                    </small>
                  </span>
                  <StatusBadge status={event.publicationStatus} />
                </label>
              ))}
            </fieldset>
          ) : (
            <p>검색 결과가 없습니다.</p>
          )}
          <div className="crowding-event-pagination">
            <button
              type="button"
              disabled={disabled || offset === 0}
              onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}
            >
              이전
            </button>
            <span>
              {visible?.count
                ? `${offset + 1}–${Math.min(
                    offset + PAGE_SIZE,
                    visible.count,
                  )} / ${visible.count}`
                : '0 / 0'}
            </span>
            <button
              type="button"
              disabled={
                disabled || !visible || offset + PAGE_SIZE >= visible.count
              }
              onClick={() => setOffset(value => value + PAGE_SIZE)}
            >
              다음
            </button>
          </div>
        </>
      )}
      {selected && !hydrating && (
        <div className="crowding-event-selection">
          <small>선택한 이벤트</small>
          <strong>{selected.title || '제목 없음'}</strong>
          <span>{selected.venueName || '장소명 없음'}</span>
          <small>ID: {selected.id}</small>
        </div>
      )}
    </div>
  );
}
