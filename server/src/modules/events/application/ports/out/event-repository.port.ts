import { BabyrooEvent } from '../../../domain/event.entity';

export const EVENT_REPOSITORY_PORT = Symbol('EVENT_REPOSITORY_PORT');

export interface EventRepositoryPort {
  list(): Promise<BabyrooEvent[]>;
  findById(id: string): Promise<BabyrooEvent | null>;
}

