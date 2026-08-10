import { BabyrooEvent } from '../../../domain/event.entity';

export const GET_EVENTS_BY_IDS_USE_CASE = Symbol('GET_EVENTS_BY_IDS_USE_CASE');

export interface GetEventsByIdsUseCase {
  getManyByIds(ids: string[]): Promise<BabyrooEvent[]>;
}

