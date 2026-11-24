import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { nextRecommendationDayBoundary } from './visitDates';

export function useLocalToday() {
  const [today, setToday] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      setToday(now.getTime());
      timer = setTimeout(refresh, nextRecommendationDayBoundary(now) - now.getTime());
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
