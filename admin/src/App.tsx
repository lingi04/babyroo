import { LogOut, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminSession } from './api/adminApi';
import { clearSession, readStoredSession } from './api/auth';
import { LoginPage } from './pages/LoginPage';
import { EventEditorPage } from './pages/EventEditorPage';
import { EventListPage } from './pages/EventListPage';

type Route =
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
      next.name === 'new' ? '#/events/new' : next.name === 'edit' ? `#/events/${next.id}/edit` : '#/events';
    setRoute(next);
  }, []);

  const page = useMemo(() => {
    if (!session) {
      return <LoginPage onLogin={setSession} />;
    }
    if (route.name === 'new') {
      return <EventEditorPage accessToken={session.accessToken} mode="new" onDone={() => navigate({ name: 'list' })} />;
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
          <h1>이벤트 관리</h1>
        </div>
        {session && (
          <div className="header-actions">
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
  if (hash === '#/events/new') {
    return { name: 'new' };
  }
  const editMatch = /^#\/events\/(.+)\/edit$/.exec(hash);
  if (editMatch) {
    return { name: 'edit', id: decodeURIComponent(editMatch[1]) };
  }
  return { name: 'list' };
}
