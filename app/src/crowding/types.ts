export type CrowdingArea = { id: string; name: string; revision: string };
export type CurrentCrowding =
  | { supported: false }
  | {
      supported: true;
      area: CrowdingArea;
      serverNow: string;
      level: '여유' | '보통' | '약간 붐빔' | '붐빔' | null;
      observedAt: string | null;
      lastSuccessAt: string | null;
      state: 'current' | 'last_known' | 'unavailable';
      refreshFailed: boolean;
      quality: string | null;
      attribution: { name: string; url: string };
    };
