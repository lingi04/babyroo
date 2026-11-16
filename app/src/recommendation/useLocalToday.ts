import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDayStart } from './visitDates';

export function useLocalToday() {
  const [today, setToday] = useState(() => localDayStart(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      setToday(localDayStart(now));
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, tomorrow.getTime() - now.getTime());
    }

    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return new Date(today);
}
