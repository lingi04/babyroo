import {
  Area,
  ObservedArea,
  Observation,
  ResolvedVenue,
} from '../domain/crowding';

export const CROWDING_STORE = Symbol('CROWDING_STORE');
export const CROWDING_PROVIDER = Symbol('CROWDING_PROVIDER');
export type CatalogInput = {
  id: string;
  name: string;
  boundaryVersion: string;
  boundaryUrl: string;
};
export type SettingsInput = {
  ids: string[] | 'all';
  revisions: Record<string, number>;
  intervalMinutes: number;
  enabled?: boolean;
  active?: boolean;
};
export interface CrowdingStore {
  list(): Promise<ObservedArea[]>;
  get(id: string): Promise<ObservedArea | null>;
  venue(eventId: string): Promise<ResolvedVenue | null>;
  create(input: CatalogInput, actorId: string): Promise<Area>;
  updateCatalog(
    input: CatalogInput,
    revision: number,
    actorId: string,
  ): Promise<Area>;
  settings(input: SettingsInput, actorId: string, now: Date): Promise<void>;
  verify(
    eventId: string,
    areaId: string,
    evidence: string,
    fingerprint: string,
    actorId: string,
  ): Promise<void>;
  unmap(eventId: string, actorId: string): Promise<void>;
  due(now: Date, limit: number): Promise<Area[]>;
  claim(id: string, now: Date, dueOnly: boolean): Promise<Area | null>;
  finish(
    area: Area,
    observation: Observation | null,
    failed: boolean,
    now: Date,
  ): Promise<void>;
}
export interface CrowdingProvider {
  read(area: Area, now: Date): Promise<Observation>;
}
