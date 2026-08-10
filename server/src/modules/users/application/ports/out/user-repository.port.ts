import {
  Child,
  CreateChildInput,
  UpdateChildInput,
  UpdateUserProfileInput,
  UpsertUserInput,
  User,
} from '../../../domain/user.entity';

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');

export interface UserRepositoryPort {
  upsertFromAuth(input: UpsertUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  createChild(userId: string, input: CreateChildInput): Promise<Child>;
  updateChild(userId: string, childId: string, input: UpdateChildInput): Promise<Child>;
  deleteChild(userId: string, childId: string): Promise<void>;
}

