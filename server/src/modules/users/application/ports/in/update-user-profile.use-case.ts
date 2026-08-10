import { UpdateUserProfileInput, User } from '../../../domain/user.entity';

export const UPDATE_USER_PROFILE_USE_CASE = Symbol('UPDATE_USER_PROFILE_USE_CASE');

export interface UpdateUserProfileUseCase {
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User>;
}

