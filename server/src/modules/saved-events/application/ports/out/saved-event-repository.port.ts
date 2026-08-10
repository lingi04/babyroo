import { SavedEvent } from '../../../domain/saved-event.entity';

export const SAVED_EVENT_REPOSITORY_PORT = Symbol('SAVED_EVENT_REPOSITORY_PORT');

export interface SavedEventRepositoryPort {
  save(userId: string, eventId: string): Promise<SavedEvent>;
  unsave(userId: string, eventId: string): Promise<void>;
  list(userId: string): Promise<SavedEvent[]>;
  isSaved(userId: string, eventId: string): Promise<boolean>;
}

