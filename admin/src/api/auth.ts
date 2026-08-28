import { AdminSession, loginAdminWithGoogle } from './adminApi';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const SESSION_KEY = 'babyroo.admin.session';

export function readStoredSession(): AdminSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function storeSession(session: AdminSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function mountGoogleLoginButton(
  element: HTMLElement,
  onSuccess: (session: AdminSession) => void,
  onError: (message: string) => void,
) {
  await loadGoogleScript();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    onError('VITE_GOOGLE_CLIENT_ID가 설정되어 있지 않습니다.');
    return;
  }
  window.google?.accounts.id.initialize({
    client_id: clientId,
    callback: async response => {
      if (!response.credential) {
        onError('Google 로그인 응답을 받을 수 없습니다.');
        return;
      }
      try {
        const session = await loginAdminWithGoogle(response.credential);
        storeSession(session);
        onSuccess(session);
      } catch {
        onError('어드민 접근 권한이 없습니다.');
      }
    },
  });
  window.google?.accounts.id.renderButton(element, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    width: 280,
  });
}

function loadGoogleScript(): Promise<void> {
  if (window.google) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 로그인 스크립트를 불러올 수 없습니다.'));
    document.head.appendChild(script);
  });
}
