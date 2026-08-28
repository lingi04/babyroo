import { Upload } from 'lucide-react';
import { AdminEvent, EventMutationInput } from '../api/adminApi';

type FormEvent = AdminEvent | EventMutationInput;

export function EventForm({
  event,
  errors,
  onChange,
  onUploadImage,
}: {
  event: FormEvent;
  errors: Record<string, string>;
  onChange: (event: FormEvent) => void;
  onUploadImage: (file: File) => void;
}) {
  function setField<K extends keyof EventMutationInput>(key: K, value: EventMutationInput[K]) {
    onChange({ ...event, [key]: value });
  }

  return (
    <form className="event-form" onSubmit={submitNothing}>
      <section className="form-section">
        <h3>기본 정보</h3>
        <div className="form-grid two">
          <TextField label="제목" value={event.title} error={errors.title} onChange={value => setField('title', value)} />
          <SelectField label="공개상태" value={event.publicationStatus ?? 'draft'} onChange={value => setField('publicationStatus', value as EventMutationInput['publicationStatus'])}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="hidden">hidden</option>
            <option value="archived">archived</option>
          </SelectField>
        </div>
        <TextAreaField label="요약" value={event.summary} error={errors.summary} onChange={value => setField('summary', value)} />
        <div className="form-grid two">
          <SelectField label="카테고리" value={event.category ?? ''} error={errors.category} onChange={value => setField('category', value || null)}>
            <option value="">선택</option>
            <option value="experience">experience</option>
            <option value="play_space">play_space</option>
            <option value="camp">camp</option>
            <option value="exhibition">exhibition</option>
            <option value="performance">performance</option>
            <option value="class">class</option>
            <option value="festival">festival</option>
            <option value="other">other</option>
          </SelectField>
          <TextField label="태그" value={(event.tags ?? []).join(', ')} onChange={value => setField('tags', value.split(',').map(tag => tag.trim()).filter(Boolean))} />
        </div>
      </section>

      <section className="form-section">
        <h3>장소</h3>
        <div className="form-grid two">
          <TextField label="장소명" value={event.venueName} error={errors.venueName} onChange={value => setField('venueName', value)} />
          <TextField label="상세 장소" value={event.venueDetail} onChange={value => setField('venueDetail', value)} />
        </div>
        <TextField label="주소" value={event.address} onChange={value => setField('address', value)} />
        <div className="form-grid two">
          <TextField label="지역" value={event.region} error={errors.region} onChange={value => setField('region', value)} />
          <TextField label="동네" value={event.locality} error={errors.locality} onChange={value => setField('locality', value)} />
        </div>
        <div className="image-row">
          <TextField label="이미지 URL" value={event.imageUrl} onChange={value => setField('imageUrl', value)} />
          <label className="upload-button">
            <Upload size={18} />
            이미지 업로드
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={change => {
              const file = change.target.files?.[0];
              if (file) onUploadImage(file);
            }} />
          </label>
        </div>
        {event.imageUrl && <img className="image-preview" src={event.imageUrl} alt="" />}
      </section>

      <section className="form-section">
        <h3>일정</h3>
        <div className="form-grid three">
          <TextField type="date" label="시작일" value={event.startsAt} error={errors.startsAt} onChange={value => setField('startsAt', value)} />
          <TextField type="date" label="종료일" value={event.endsAt} error={errors.endsAt} onChange={value => setField('endsAt', value)} />
          <TextField type="date" label="확인일" value={event.lastCheckedAt} onChange={value => setField('lastCheckedAt', value)} />
        </div>
      </section>

      <section className="form-section">
        <h3>아이 / 가족 적합성</h3>
        <div className="form-grid three">
          <NumberField label="최소 월령" value={event.ageMinMonths} onChange={value => setField('ageMinMonths', value)} />
          <NumberField label="최대 월령" value={event.ageMaxMonths} onChange={value => setField('ageMaxMonths', value)} />
          <TriStateField label="실내" value={event.indoor} onChange={value => setField('indoor', value)} />
          <TriStateField label="보호자 동반" value={event.guardianRequired} onChange={value => setField('guardianRequired', value)} />
          <TriStateField label="유모차" value={event.strollerFriendly} onChange={value => setField('strollerFriendly', value)} />
          <TriStateField label="수유실" value={event.nursingRoom} onChange={value => setField('nursingRoom', value)} />
          <TriStateField label="주차" value={event.parking} onChange={value => setField('parking', value)} />
        </div>
      </section>

      <section className="form-section">
        <h3>가격 / 예약</h3>
        <div className="form-grid three">
          <SelectField label="가격 유형" value={event.priceType ?? 'unknown'} error={errors.priceType} onChange={value => setField('priceType', value as EventMutationInput['priceType'])}>
            <option value="unknown">unknown</option>
            <option value="free">free</option>
            <option value="paid">paid</option>
          </SelectField>
          <TextField label="가격 설명" value={event.priceText} onChange={value => setField('priceText', value)} />
          <TriStateField label="예약 필요" value={event.reservationRequired} onChange={value => setField('reservationRequired', value)} />
          <SelectField label="예약 상태" value={event.reservationStatus ?? 'unknown'} error={errors.reservationStatus} onChange={value => setField('reservationStatus', value as EventMutationInput['reservationStatus'])}>
            <option value="unknown">unknown</option>
            <option value="available">available</option>
            <option value="limited">limited</option>
            <option value="closed">closed</option>
          </SelectField>
        </div>
      </section>

      <section className="form-section">
        <h3>출처</h3>
        <div className="form-grid two">
          <TextField label="소스" value={event.source ?? 'manual'} error={errors.source} onChange={value => setField('source', value)} />
          <TextField label="소스 이벤트 ID" value={event.sourceEventId} onChange={value => setField('sourceEventId', value)} />
        </div>
        <TextField label="원본 URL" value={event.sourceUrl} error={errors.sourceUrl} onChange={value => setField('sourceUrl', value)} />
      </section>
    </form>
  );
}

function TextField({ label, value, error, type = 'text', onChange }: { label: string; value?: string | null; error?: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input type={type} value={value ?? ''} onChange={event => onChange(event.target.value)} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function TextAreaField({ label, value, error, onChange }: { label: string; value?: string | null; error?: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea value={value ?? ''} onChange={event => onChange(event.target.value)} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (value: number | null) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))} />
    </label>
  );
}

function SelectField({ label, value, error, onChange, children }: { label: string; value: string; error?: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      {label}
      <select value={value} onChange={event => onChange(event.target.value)}>
        {children}
      </select>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function TriStateField({ label, value, onChange }: { label: string; value?: boolean | null; onChange: (value: boolean | null) => void }) {
  return (
    <label>
      {label}
      <select value={value === null || value === undefined ? 'unknown' : String(value)} onChange={event => {
        onChange(event.target.value === 'unknown' ? null : event.target.value === 'true');
      }}>
        <option value="unknown">알 수 없음</option>
        <option value="true">예</option>
        <option value="false">아니오</option>
      </select>
    </label>
  );
}

function submitNothing(event: React.FormEvent) {
  event.preventDefault();
}
