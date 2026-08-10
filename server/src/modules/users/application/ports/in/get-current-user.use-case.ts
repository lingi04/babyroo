import { User } from '../../../domain/user.entity';

export const GET_CURRENT_USER_USE_CASE = Symbol('GET_CURRENT_USER_USE_CASE');

export interface GetCurrentUserUseCase {
  getRequiredUser(id: string): Promise<User>;
}

