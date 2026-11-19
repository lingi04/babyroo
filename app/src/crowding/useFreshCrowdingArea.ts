import { useEffect, useState } from 'react';
import { getEventFromBabyrooApi } from '../api/babyrooApi';
import type { BabyrooEvent } from '../data/events';
import type { CrowdingArea } from './types';

// Explore may have loaded before an admin verified or removed an area mapping.
export function useFreshCrowdingArea(event: BabyrooEvent) {
  const identity = JSON.stringify([
    event.id,
    event.crowdingArea?.id,
    event.crowdingArea?.revision,
  ]);
  const [fresh, setFresh] = useState<{
    identity: string;
    area: CrowdingArea | undefined;
  }>();
  useEffect(() => {
    let live = true;
    getEventFromBabyrooApi(event.id)
      .then(current => {
        if (live && current.id === event.id) {
          setFresh({ identity, area: current.crowdingArea });
        }
      })
      .catch(error => {
        // Existing content remains usable offline; a removed venue must not
        // keep advertising crowding availability from its stale list entry.
        if (live && error?.statusCode === 404) {
          setFresh({ identity, area: undefined });
        }
      });
    return () => {
      live = false;
    };
  }, [event.id, identity]);
  return fresh?.identity === identity ? fresh.area : event.crowdingArea;
}
