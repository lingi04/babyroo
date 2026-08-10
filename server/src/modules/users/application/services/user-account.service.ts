import { NotFoundError } from '../../../../common/application-error';
import {
  Child,
  CreateChildInput,
  UpdateChildInput,
  UpdateUserProfileInput,
  User,
} from '../../domain/user.entity';
import { DeleteUserUseCase } from '../ports/in/delete-user.use-case';
import { GetCurrentUserUseCase } from '../ports/in/get-current-user.use-case';
import { ManageChildrenUseCase } from '../ports/in/manage-children.use-case';
import { UpdateUserProfileUseCase } from '../ports/in/update-user-profile.use-case';
import { UpsertUserFromAuthUseCase } from '../ports/in/upsert-user-from-auth.use-case';
import {
  USER_REPOSITORY_PORT,
  UserRepositoryPort,
} from '../ports/out/user-repository.port';

export class UserAccountService
  implements
    UpsertUserFromAuthUseCase,
    GetCurrentUserUseCase,
    UpdateUserProfileUseCase,
    DeleteUserUseCase,
    ManageChildrenUseCase
{
  constructor(
    private readonly users: UserRepositoryPort,
  ) {}

  upsertFromAuth(id: string, displayName?: string): Promise<User> {
    return this.users.upsertFromAuth({ id, displayName });
  }

  async getRequiredUser(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User> {
    return this.users.updateProfile(userId, input);
  }

  deleteUser(userId: string): Promise<void> {
    return this.users.deleteUser(userId);
  }

  createChild(userId: string, input: CreateChildInput): Promise<Child> {
    return this.users.createChild(userId, input);
  }

  updateChild(userId: string, childId: string, input: UpdateChildInput): Promise<Child> {
    return this.users.updateChild(userId, childId, input);
  }

  deleteChild(userId: string, childId: string): Promise<void> {
    return this.users.deleteChild(userId, childId);
  }
}
