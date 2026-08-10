import { User } from '../../../domain/user.entity';

export const UPSERT_USER_FROM_AUTH_USE_CASE = Symbol('UPSERT_USER_FROM_AUTH_USE_CASE');

export interface UpsertUserFromAuthUseCase {
  upsertFromAuth(id: string, displayName?: string): Promise<User>;
}

