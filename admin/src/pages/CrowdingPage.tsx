import { useCallback, useEffect, useRef, useState } from 'react';
import { crowdingRequest } from '../api/adminApi';

type Area = {
  id: string;
  name: string;
  boundaryVersion: string;
  boundaryUrl: string;
  revision: number;
  intervalMinutes: number;
  enabled: boolean;
  active: boolean;
  level: string | null;
  observedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextDueAt: string;
};
type Catalog = Pick<Area, 'id' | 'name' | 'boundaryVersion' | 'boundaryUrl'>;
type Verification = {
  fingerprint: string;
  area: Area;
  event: {
    id: string;
    venueName: string | null;
    venueDetail: string | null;
    address: string | null;
    publicationStatus: string;
  };
  verified?: { id: string; name: string };
};
const emptyCatalog: Catalog = {
  id: '',
  name: '',
  boundaryVersion: '',
  boundaryUrl: '',
};
const stamp = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '—';

export function CrowdingPage({
  accessToken,
  refreshToken,
  initialEventId = '',
}: {
  accessToken: string;
  refreshToken: number;
  initialEventId?: string;
}) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [editRevision, setEditRevision] = useState<number>();
  const [interval, setInterval] = useState('30');
  const [enabled, setEnabled] = useState('keep');
  const [active, setActive] = useState('keep');
  const [target, setTarget] = useState<'selected' | 'all'>('selected');
  const [eventId, setEventId] = useState(initialEventId);
  const [areaId, setAreaId] = useState('');
  const [verification, setVerification] = useState<Verification>();
  const [evidence, setEvidence] = useState('');
  const [confirmedInside, setConfirmedInside] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const verificationRequest = useRef(0);
  const reload = useCallback(async () => {
    const data = await crowdingRequest<Area[]>(accessToken, '/areas');
    setAreas(data);
  }, [accessToken]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    crowdingRequest<Area[]>(accessToken, '/areas')
      .then(data => {
        if (live) setAreas(data);
      })
      .catch(e => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, refreshToken]);
  useEffect(() => {
    verificationRequest.current += 1;
    setEventId(initialEventId);
    setVerification(undefined);
    setConfirmedInside(false);
    setEvidence('');
  }, [initialEventId]);
  async function save(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice('저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  const clearVerification = () => {
    verificationRequest.current += 1;
    setVerification(undefined);
    setConfirmedInside(false);
    setEvidence('');
  };
  return (
    <main className="page editor-page crowding-page">
      <h2>주변 혼잡도</h2>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="table-panel">
        <h3>지역 · 수집 현황</h3>
        {loading ? (
          <p>불러오는 중…</p>
        ) : areas.length === 0 ? (
          <p>등록된 지역이 없습니다.</p>
        ) : (
          <div className="crowding-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>선택</th>
                  <th>지역</th>
                  <th>상태</th>
                  <th>수집 주기</th>
                  <th>최근 관측</th>
                  <th>마지막 수집 성공</th>
                  <th>다음 수집</th>
                  <th>오류</th>
                  <th>편집</th>
                </tr>
              </thead>
              <tbody>
                {areas.map(area => (
                  <tr key={area.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${area.name} 선택`}
                        checked={selected.includes(area.id)}
                        onChange={e =>
                          setSelected(ids =>
                            e.target.checked
                              ? [...ids, area.id]
                              : ids.filter(id => id !== area.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      {area.name}
                      <br />
                      <small>{area.id}</small>
                    </td>
                    <td>
                      {!area.active
                        ? '비활성'
                        : area.enabled
                        ? '수집 중'
                        : '수집 중지'}
                    </td>
                    <td>{area.intervalMinutes}분</td>
                    <td>
                      {area.level ?? '정보 없음'}
                      <br />
                      {stamp(area.observedAt)}
                    </td>
                    <td>{stamp(area.lastSuccessAt)}</td>
                    <td>{stamp(area.nextDueAt)}</td>
                    <td>{area.lastError ? '원본 연결 확인 필요' : '—'}</td>
                    <td>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setCatalog({
                            id: area.id,
                            name: area.name,
                            boundaryVersion: area.boundaryVersion,
                            boundaryUrl: area.boundaryUrl,
                          });
                          setEditRevision(area.revision);
                          setInterval(String(area.intervalMinutes));
                          setEnabled('keep');
                          setActive('keep');
                          setSelected([area.id]);
                          setTarget('selected');
                        }}
                      >
                        편집
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <form
        className="table-panel"
        onSubmit={e => {
          e.preventDefault();
          const ids = target === 'all' ? areas.map(a => a.id) : selected;
          if (!ids.length) {
            setError('지역을 선택하세요.');
            return;
          }
          if (
            !window.confirm(
              `${ids.length}개 지역의 주기와 수집/공개 상태를 변경할까요?`,
            )
          )
            return;
          void save(async () => {
            await crowdingRequest(accessToken, '/areas/settings', 'PATCH', {
              ids: target === 'all' ? 'all' : ids,
              revisions: Object.fromEntries(areas.map(a => [a.id, a.revision])),
              intervalMinutes: Number(interval),
              ...(enabled !== 'keep' ? { enabled: enabled === 'on' } : {}),
              ...(active !== 'keep' ? { active: active === 'on' } : {}),
            });
            await reload();
            setSelected([]);
            setEditRevision(undefined);
            setCatalog(emptyCatalog);
            clearVerification();
          });
        }}
      >
        <h3>수집 설정</h3>
        <fieldset disabled={busy || loading} className="crowding-fields">
          <label>
            적용 대상
            <select
              value={target}
              onChange={e => setTarget(e.target.value as 'selected' | 'all')}
            >
              <option value="selected">선택한 지역 ({selected.length})</option>
              <option value="all">모든 지역 ({areas.length})</option>
            </select>
          </label>
          <label>
            수집 주기 (분)
            <input
              required
              type="number"
              min="1"
              max="1440"
              step="1"
              value={interval}
              onChange={e => setInterval(e.target.value)}
            />
          </label>
          <label>
            수집 상태
            <select value={enabled} onChange={e => setEnabled(e.target.value)}>
              <option value="keep">기존 상태 유지</option>
              <option value="on">수집 활성화</option>
              <option value="off">수집 중지</option>
            </select>
          </label>
          <label>
            공개 상태
            <select value={active} onChange={e => setActive(e.target.value)}>
              <option value="keep">기존 상태 유지</option>
              <option value="on">지역 공개</option>
              <option value="off">지역 비공개</option>
            </select>
          </label>
          <button className="primary" type="submit">
            설정 적용
          </button>
        </fieldset>
      </form>
      <form
        className="table-panel"
        onSubmit={e => {
          e.preventDefault();
          void save(async () => {
            await crowdingRequest(
              accessToken,
              editRevision
                ? `/areas/${encodeURIComponent(catalog.id)}`
                : '/areas',
              editRevision ? 'PATCH' : 'POST',
              {
                ...catalog,
                ...(editRevision ? { revision: editRevision } : {}),
              },
            );
            setCatalog(emptyCatalog);
            setEditRevision(undefined);
            clearVerification();
            await reload();
          });
        }}
      >
        <h3>{editRevision ? '지역 정보 편집' : '공식 지역 등록'}</h3>
        <fieldset disabled={busy} className="crowding-fields">
          <label>
            공식 지역 코드
            <input
              required
              disabled={Boolean(editRevision)}
              maxLength={32}
              value={catalog.id}
              onChange={e => setCatalog(c => ({ ...c, id: e.target.value }))}
            />
          </label>
          <label>
            지역명
            <input
              required
              maxLength={120}
              value={catalog.name}
              onChange={e => setCatalog(c => ({ ...c, name: e.target.value }))}
            />
          </label>
          <label>
            공식 경계 버전
            <input
              required
              maxLength={120}
              value={catalog.boundaryVersion}
              onChange={e =>
                setCatalog(c => ({ ...c, boundaryVersion: e.target.value }))
              }
            />
          </label>
          <label>
            공식 경계 출처 URL
            <input
              required
              type="url"
              maxLength={2048}
              value={catalog.boundaryUrl}
              onChange={e =>
                setCatalog(c => ({ ...c, boundaryUrl: e.target.value }))
              }
            />
          </label>
          <button className="primary" type="submit">
            {editRevision ? '지역 정보 저장' : '지역 등록'}
          </button>
          {editRevision && (
            <button
              type="button"
              onClick={() => {
                setEditRevision(undefined);
                setCatalog(emptyCatalog);
              }}
            >
              편집 취소
            </button>
          )}
        </fieldset>
      </form>
      <section className="table-panel">
        <h3>장소 경계 확인</h3>
        <p>
          공식 경계 안에 있는 장소만 연결하세요. 지역 이름이나 거리만으로
          판단하지 마세요.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            setError('');
            clearVerification();
            setBusy(true);
            const requestId = verificationRequest.current;
            crowdingRequest<Verification>(
              accessToken,
              `/events/${encodeURIComponent(
                eventId,
              )}?areaId=${encodeURIComponent(areaId)}`,
            )
              .then(data => {
                if (requestId === verificationRequest.current)
                  setVerification(data);
              })
              .catch(err => {
                if (requestId === verificationRequest.current)
                  setError(err.message);
              })
              .finally(() => setBusy(false));
          }}
        >
          <fieldset disabled={busy} className="crowding-fields">
            <label>
              이벤트 ID
              <input
                required
                value={eventId}
                onChange={e => {
                  setEventId(e.target.value);
                  clearVerification();
                }}
              />
            </label>
            <label>
              공식 지역
              <select
                required
                value={areaId}
                onChange={e => {
                  setAreaId(e.target.value);
                  clearVerification();
                }}
              >
                <option value="">지역 선택</option>
                {areas
                  .filter(a => a.active)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit">장소 정보 확인</button>
            <button
              type="button"
              disabled={!eventId.trim()}
              onClick={() => {
                if (window.confirm('장소의 지역 연결을 해제할까요?'))
                  void save(async () => {
                    await crowdingRequest(
                      accessToken,
                      `/events/${encodeURIComponent(eventId)}`,
                      'DELETE',
                    );
                    clearVerification();
                  });
              }}
            >
              연결 해제
            </button>
          </fieldset>
        </form>
        {verification && (
          <form
            onSubmit={e => {
              e.preventDefault();
              void save(async () => {
                await crowdingRequest(
                  accessToken,
                  `/events/${encodeURIComponent(eventId)}/verify`,
                  'POST',
                  {
                    areaId,
                    fingerprint: verification.fingerprint,
                    evidence,
                    confirmedInside,
                  },
                );
                clearVerification();
              });
            }}
          >
            <p>
              <strong>{verification.event.venueName}</strong>
              <br />
              {verification.event.venueDetail}
              <br />
              {verification.event.address ?? '주소 없음'}
            </p>
            <p>
              현재 연결:{' '}
              {verification.verified?.name ?? '없음 또는 재확인 필요'}
            </p>
            <a
              href={verification.area.boundaryUrl}
              target="_blank"
              rel="noreferrer"
            >
              공식 경계 확인 ↗
            </a>
            <fieldset disabled={busy} className="crowding-fields">
              <label>
                확인 근거
                <textarea
                  required
                  maxLength={2000}
                  value={evidence}
                  onChange={e => setEvidence(e.target.value)}
                />
              </label>
              <label className="crowding-check">
                <input
                  required
                  type="checkbox"
                  checked={confirmedInside}
                  onChange={e => setConfirmedInside(e.target.checked)}
                />
                표시된 장소가 공식 경계 안에 있음을 확인했습니다.
              </label>
              <button className="primary" type="submit">
                연결 저장
              </button>
            </fieldset>
          </form>
        )}
      </section>
    </main>
  );
}
