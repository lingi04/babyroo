export type PushMessage = {
  data?: { [key: string]: string | object };
  notification?: { title?: string; body?: string };
};

export interface PushClient {
  readonly provider: string;
  platform: 'android' | 'ios';
  requestPermission(): Promise<void>;
  getToken(): Promise<string>;
  deleteToken(): Promise<void>;
  onTokenRefresh(listener: (token: string) => void): () => void;
  onMessage(listener: (message: PushMessage) => void): () => void;
  onOpened(listener: (message: PushMessage) => void): () => void;
  getInitialNotification(): Promise<PushMessage | null>;
}

export function recommendationFromPush(message: PushMessage, userId: string) {
  const data = message.data;
  if (
    data?.type !== 'recommendation_completed' || data.userId !== userId ||
    typeof data.sessionId !== 'string' || !data.sessionId ||
    !['success', 'failed', 'timeout'].includes(String(data.status))
  ) return null;
  return { sessionId: data.sessionId, status: String(data.status) };
}
