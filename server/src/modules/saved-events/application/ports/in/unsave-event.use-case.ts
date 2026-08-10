export const UNSAVE_EVENT_USE_CASE = Symbol('UNSAVE_EVENT_USE_CASE');

export interface UnsaveEventUseCase {
  unsave(userId: string, eventId: string): Promise<void>;
}

