import { useEffect, useState } from 'react';
import { AppPolicy, listAppPolicies, updateAppPolicy } from '../api/adminApi';

export function AppPolicyPage({ accessToken, refreshToken }: { accessToken: string; refreshToken: number }) {
  const [policies, setPolicies] = useState<AppPolicy[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listAppPolicies(accessToken).then(data => {
      if (active) setPolicies(data);
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, refreshToken]);

  return <main className="page editor-page">
    <h2>앱 업데이트 정책</h2>
    <p>최소 빌드보다 낮은 앱은 업데이트가 필요합니다. 최소 빌드 0은 강제 업데이트를 해제합니다. 저장 후 다음 정책 조회부터 적용됩니다.</p>
    {error && <div className="alert" role="alert">{error}</div>}
    {loading ? <p>불러오는 중...</p> : policies.map(policy =>
      <PolicyForm key={policy.platform + policy.updatedAt} policy={policy} accessToken={accessToken} />)}
  </main>;
}

function PolicyForm({ policy, accessToken }: { policy: AppPolicy; accessToken: string }) {
  const [minimumBuild, setMinimumBuild] = useState(String(policy.minimumBuild));
  const [latestBuild, setLatestBuild] = useState(String(policy.latestBuild));
  const [storeUrl, setStoreUrl] = useState(policy.storeUrl);
  const [message, setMessage] = useState(policy.message);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  return <form className="table-panel" onSubmit={async event => {
    event.preventDefault();
    setSaving(true); setError(''); setSaved('');
    try {
      const updated = await updateAppPolicy(accessToken, policy.platform, {
        minimumBuild: Number(minimumBuild), latestBuild: Number(latestBuild), storeUrl, message,
      });
      setSaved('저장되었습니다. ' + new Date(updated.updatedAt).toLocaleString());
    } catch (e) { setError(e instanceof Error ? e.message : '저장에 실패했습니다.'); }
    finally { setSaving(false); }
  }}>
    <h3>{policy.platform === 'android' ? 'Android' : 'iOS'}</h3>
    <fieldset disabled={saving} style={{ display: 'grid', gap: 12, border: 0 }}>
      <label>최소 지원 빌드<input type="number" min="0" max="2147483647" step="1" required value={minimumBuild} onChange={e => { setMinimumBuild(e.target.value); setSaved(''); }} /></label>
      <label>최신 빌드<input type="number" min={minimumBuild || '0'} max="2147483647" step="1" required value={latestBuild} onChange={e => { setLatestBuild(e.target.value); setSaved(''); }} /></label>
      <label>스토어 URL<input type="url" maxLength={2048} required={Number(minimumBuild) > 0 || Number(latestBuild) > 0} value={storeUrl} onChange={e => { setStoreUrl(e.target.value); setSaved(''); }} /></label>
      <label>업데이트 안내 메시지<textarea required maxLength={2000} value={message} onChange={e => { setMessage(e.target.value); setSaved(''); }} /></label>
      <button type="submit" className="primary">{saving ? '저장 중...' : '저장'}</button>
    </fieldset>
    {error && <p className="alert" role="alert">{error}</p>}
    {saved && <p role="status">{saved}</p>}
  </form>;
}
