import { useCallback, useEffect, useRef } from 'react';
import { updateCurrentUserInBabyrooApi } from '../api/babyrooApi';

type Patch = Parameters<typeof updateCurrentUserInBabyrooApi>[0]['user'];
type Completion = { resolve: () => void; reject: (error: unknown) => void };
type Batch = { patch: Patch; completions: Completion[] };
type Session = {
  accessToken: string;
  pending?: Batch;
  timer?: ReturnType<typeof setTimeout>;
  writing: boolean;
  stopped: boolean;
};

async function drain(session: Session): Promise<void> {
  if (session.stopped || session.writing || !session.pending) return;
  const batch = session.pending;
  session.pending = undefined;
  session.writing = true;
  try {
    await updateCurrentUserInBabyrooApi({
      accessToken: session.accessToken,
      user: batch.patch,
    });
    if (session.stopped) throw new Error('Login session changed');
    batch.completions.forEach(completion => completion.resolve());
    // Never replace newer optimistic edits with a response to an older patch.
  } catch (error) {
    batch.completions.forEach(completion => completion.reject(error));
    if (batch.completions.length === 0)
      console.warn('[Babyroo API] failed to sync user profile', error);
  } finally {
    session.writing = false;
    if (!session.stopped && session.pending && !session.timer)
      void drain(session);
  }
}

/** One ordered queue for automatic profile edits and explicit selection saves. */
export function useProfileSync(accessToken?: string) {
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    if (!accessToken) {
      sessionRef.current = null;
      return;
    }
    const session: Session = { accessToken, writing: false, stopped: false };
    sessionRef.current = session;
    return () => {
      session.stopped = true;
      clearTimeout(session.timer);
      session.pending?.completions.forEach(completion =>
        completion.reject(new Error('Login session changed')),
      );
      session.pending = undefined;
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [accessToken]);

  const enqueue = useCallback((patch: Patch) => {
    const session = sessionRef.current;
    if (!session || session.stopped) return;
    session.pending = {
      patch: { ...session.pending?.patch, ...patch },
      completions: session.pending?.completions ?? [],
    };
    clearTimeout(session.timer);
    // An explicitly requested save should not be delayed by later auto edits.
    if (session.pending.completions.length > 0) {
      session.timer = undefined;
      void drain(session);
      return;
    }
    session.timer = setTimeout(() => {
      session.timer = undefined;
      void drain(session);
    }, 250);
  }, []);

  const save = useCallback((patch: Patch): Promise<void> => {
    const session = sessionRef.current;
    if (!session || session.stopped)
      return Promise.reject(new Error('No active login session'));
    return new Promise((resolve, reject) => {
      session.pending = {
        patch: { ...session.pending?.patch, ...patch },
        completions: [
          ...(session.pending?.completions ?? []),
          { resolve, reject },
        ],
      };
      clearTimeout(session.timer);
      session.timer = undefined;
      void drain(session);
    });
  }, []);
  return { enqueue, save };
}
