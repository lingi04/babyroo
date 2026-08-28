import { ArrowLeft, Archive, Eye, EyeOff, ExternalLink, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AdminEvent,
  changeAdminEventStatus,
  createAdminEvent,
  EventMutationInput,
  getAdminEvent,
  updateAdminEvent,
  uploadEventImage,
} from '../api/adminApi';
import { EventForm } from '../components/EventForm';
import { StatusBadge } from '../components/StatusBadge';

export function EventEditorPage({
  accessToken,
  mode,
  eventId,
  onDone,
}: {
  accessToken: string;
  mode: 'new' | 'edit';
  eventId?: string;
  onDone: () => void;
}) {
  const [event, setEvent] = useState<AdminEvent | EventMutationInput>(() => emptyEvent());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !eventId) return;
    setLoading(true);
    getAdminEvent(accessToken, eventId)
      .then(setEvent)
      .catch(() => setError('이벤트를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [accessToken, eventId, mode]);

  async function saveDraft() {
    await save(event.publicationStatus === 'published' ? { ...event, publicationStatus: 'draft' } : event);
  }

  async function publish() {
    const saved = await save({ ...event, publicationStatus: 'published' });
    if (saved && mode === 'edit') {
      await changeStatus('published', false);
    }
    if (saved) onDone();
  }

  async function hide() {
    if (window.confirm('이 이벤트를 숨길까요? 앱에는 표시되지 않지만 나중에 다시 공개할 수 있습니다.')) {
      await changeStatus('hidden', true);
    }
  }

  async function archive() {
    if (window.confirm('이 이벤트를 보관 처리할까요? 앱에 표시되지 않으며 기본 검토 목록에서도 제외됩니다.')) {
      await changeStatus('archived', false);
      onDone();
    }
  }

  async function changeStatus(status: 'published' | 'hidden' | 'archived', stay: boolean) {
    if (!('id' in event)) return;
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const next = await changeAdminEventStatus(accessToken, event.id, status);
      setEvent(next);
      if (!stay) onDone();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function save(nextEvent: EventMutationInput): Promise<AdminEvent | null> {
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const saved =
        mode === 'new'
          ? await createAdminEvent(accessToken, nextEvent)
          : await updateAdminEvent(accessToken, eventId!, nextEvent);
      setEvent(saved);
      if (mode === 'new') {
        window.location.hash = `#/events/${saved.id}/edit`;
      }
      return saved;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    setSaving(true);
    setError('');
    try {
      const result = await uploadEventImage(accessToken, file, 'id' in event ? event.id : undefined);
      setEvent(current => ({ ...current, imageUrl: result.imageUrl }));
    } catch {
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function handleError(error: unknown) {
    const maybe = error as { errors?: Record<string, string>; message?: string };
    setFieldErrors(maybe.errors ?? {});
    setError(maybe.errors ? '입력값을 확인해 주세요.' : maybe.message ?? '요청을 처리하지 못했습니다.');
  }

  if (loading) {
    return <main className="page"><div className="table-panel">불러오는 중...</div></main>;
  }

  return (
    <main className="page editor-page">
      <div className="editor-header">
        <button type="button" onClick={onDone}>
          <ArrowLeft size={18} />
          목록으로
        </button>
        <div className="editor-title">
          <h2>{mode === 'new' ? '새 이벤트' : event.title || '이벤트 수정'}</h2>
          {'publicationStatus' in event && event.publicationStatus && <StatusBadge status={event.publicationStatus} />}
        </div>
        <div className="editor-actions">
          {'sourceUrl' in event && event.sourceUrl && (
            <a className="button-link" href={event.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              원본 열기
            </a>
          )}
          <button type="button" onClick={saveDraft} disabled={saving}>
            <Save size={18} />
            임시저장
          </button>
          <button type="button" className="primary" onClick={publish} disabled={saving}>
            <Eye size={18} />
            공개
          </button>
          {mode === 'edit' && (
            <>
              <button type="button" onClick={hide} disabled={saving}>
                <EyeOff size={18} />
                숨김
              </button>
              <button type="button" className="danger" onClick={archive} disabled={saving}>
                <Archive size={18} />
                보관
              </button>
            </>
          )}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      <EventForm event={event} errors={fieldErrors} onChange={setEvent} onUploadImage={uploadImage} />
    </main>
  );
}

function emptyEvent(): EventMutationInput {
  return {
    title: '',
    source: 'manual',
    sourceUrl: '',
    publicationStatus: 'draft',
    priceType: 'unknown',
    reservationStatus: 'unknown',
    tags: [],
  };
}
