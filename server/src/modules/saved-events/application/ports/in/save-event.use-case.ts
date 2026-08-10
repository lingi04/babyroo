import { SavedEvent } from '../../../domain/saved-event.entity';

export const SAVE_EVENT_USE_CASE = Symbol('SAVE_EVENT_USE_CASE');

export interface SaveEventUseCase {
  save(userId: string, eventId: string): Promise<SavedEvent>;
}

