export const PUSH_NOTIFICATION_PORT = Symbol('PUSH_NOTIFICATION_PORT');

export type RecommendationCompletion = {
  userId: string;
  sessionId: string;
  status: 'success' | 'failed' | 'timeout';
};

export interface PushNotificationPort {
  sendRecommendationCompleted(completion: RecommendationCompletion): Promise<void>;
}
