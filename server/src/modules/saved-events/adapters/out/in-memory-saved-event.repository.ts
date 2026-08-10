import { Injectable } from '@nestjs/common';
import { SavedEventRepositoryPort } from '../../application/ports/out/saved-event-repository.port';
import { SavedEvent } from '../../domain/saved-event.entity';

@Injectable()
export class InMemorySavedEventRepository implements SavedEventRepositoryPort {
  private readonly savedEvents = new Map<string, SavedEvent>();

  async save(userId: string, eventId: string): Promise<SavedEvent> {
    const key = this.key(userId, eventId);
    const existing = this.savedEvents.get(key);
    if (existing) {
      return existing;
    }

    const savedEvent = {
      userId,
      eventId,
      createdAt: new Date().toISOString(),
    };
    this.savedEvents.set(key, savedEvent);
    return savedEvent;
  }

  async unsave(userId: string, eventId: string): Promise<void> {
    this.savedEvents.delete(this.key(userId, eventId));
  }

  async list(userId: string): Promise<SavedEvent[]> {
    return [...this.savedEvents.values()]
      .filter(savedEvent => savedEvent.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async isSaved(userId: string, eventId: string): Promise<boolean> {
    return this.savedEvents.has(this.key(userId, eventId));
  }

  private key(userId: string, eventId: string): string {
    return `${userId}:${eventId}`;
  }
}
