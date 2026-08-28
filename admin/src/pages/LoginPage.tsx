import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AdminSession } from '../api/adminApi';
import { mountGoogleLoginButton } from '../api/auth';

export function LoginPage({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!buttonRef.current) return;
    mountGoogleLoginButton(buttonRef.current, onLogin, setError).catch(error => {
      setError(error instanceof Error ? error.message : 'Google 로그인을 시작할 수 없습니다.');
    });
  }, [onLogin]);

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-mark">
          <ShieldCheck size={30} />
        </div>
        <h2>어드민 로그인</h2>
        <p>등록된 관리자 Google 계정으로만 접근할 수 있습니다.</p>
        <div ref={buttonRef} className="google-button" />
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}
