import { BabyrooEvent } from '../../../domain/event.entity';

export const GET_EVENT_DETAIL_USE_CASE = Symbol('GET_EVENT_DETAIL_USE_CASE');

export interface GetEventDetailUseCase {
  getById(id: string): Promise<BabyrooEvent>;
}

