import { LogOut, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminSession } from './api/adminApi';
import { clearSession, readStoredSession } from './api/auth';
import { LoginPage } from './pages/LoginPage';
import { EventEditorPage } from './pages/EventEditorPage';
import { EventListPage } from './pages/EventListPage';
import { AppPolicyPage } from './pages/AppPolicyPage';
import { CrowdingPage } from './pages/CrowdingPage';

type Route =
  | { name: 'crowding'; eventId?: string }
  | { name: 'policy' }
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'edit'; id: string };

export function App() {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession());
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash =
      next.name === 'crowding' ? '#/crowding' : next.name === 'policy' ? '#/app-policies' : next.name === 'new' ? '#/events/new' : next.name === 'edit' ? `#/events/${next.id}/edit` : '#/events';
    setRoute(next);
  }, []);

  const page = useMemo(() => {
    if (!session) {
      return <LoginPage onLogin={setSession} />;
    }
    if (route.name === 'crowding') {
      return <CrowdingPage key={session.accessToken} accessToken={session.accessToken} refreshToken={refreshToken} initialEventId={route.eventId} />;
    }
    if (route.name === 'new') {
      return <EventEditorPage accessToken={session.accessToken} mode="new" onDone={() => navigate({ name: 'list' })} />;
    }
    if (route.name === 'policy') {
      return <AppPolicyPage accessToken={session.accessToken} refreshToken={refreshToken} />;
    }
    if (route.name === 'edit') {
      return (
        <EventEditorPage
          accessToken={session.accessToken}
          eventId={route.id}
          mode="edit"
          onDone={() => navigate({ name: 'list' })}
        />
      );
    }
    return (
      <EventListPage
        accessToken={session.accessToken}
        refreshToken={refreshToken}
        onCreate={() => navigate({ name: 'new' })}
        onEdit={id => navigate({ name: 'edit', id })}
      />
    );
  }, [navigate, refreshToken, route, session]);

  function signOut() {
    clearSession();
    setSession(null);
    window.location.hash = '#/events';
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Babyroo Admin</p>
          <h1>{route.name === 'crowding' ? '주변 혼잡도' : route.name === 'policy' ? '앱 업데이트 정책' : '이벤트 관리'}</h1>
        </div>
        {session && (
          <div className="header-actions">
            <button type="button" onClick={() => navigate({ name: 'list' })}>이벤트 관리</button>
            <button type="button" onClick={() => navigate({ name: 'policy' })}>앱 업데이트 정책</button>
            <button type="button" onClick={() => navigate({ name: 'crowding' })}>주변 혼잡도</button>
            <span className="admin-email">{session.adminUser.email}</span>
            <button type="button" className="icon-button" onClick={() => setRefreshToken(value => value + 1)} title="새로고침">
              <RefreshCw size={18} />
            </button>
            <button type="button" className="primary action-button" onClick={() => navigate({ name: 'new' })}>
              <Plus size={18} />
              새 이벤트
            </button>
            <button type="button" className="icon-button" onClick={signOut} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </header>
      {page}
    </div>
  );
}

function parseRoute(): Route {
  const hash = window.location.hash || '#/events';
  if (hash === '#/crowding' || hash.startsWith('#/crowding?')) {
    return { name: 'crowding', eventId: new URLSearchParams(hash.split('?')[1]).get('eventId') ?? undefined };
  }
  if (hash === '#/app-policies') return { name: 'policy' };
  if (hash === '#/events/new') {
    return { name: 'new' };
  }
  const editMatch = /^#\/events\/(.+)\/edit$/.exec(hash);
  if (editMatch) {
    return { name: 'edit', id: decodeURIComponent(editMatch[1]) };
  }
  return { name: 'list' };
}
