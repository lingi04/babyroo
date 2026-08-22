export const RECOMMENDATION_JOB_DISPATCHER_PORT = Symbol(
  'RECOMMENDATION_JOB_DISPATCHER_PORT',
);

export type RecommendationJob = {
  userId: string;
  sessionId: string;
};

export interface RecommendationJobDispatcherPort {
  dispatch(job: RecommendationJob): Promise<void>;
}
