import { NotFoundError } from '../../../../common/application-error';
import { debugLog } from '../../../../common/debug-log';
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
    debugLog('users.upsertFromAuth.start', {
      userId: id,
      hasDisplayName: Boolean(displayName),
    });
    return this.users.upsertFromAuth({ id, displayName });
  }

  async getRequiredUser(id: string): Promise<User> {
    debugLog('users.getRequired.start', { userId: id });
    const user = await this.users.findById(id);
    if (!user) {
      debugLog('users.getRequired.notFound', { userId: id });
      throw new NotFoundError('User not found');
    }
    debugLog('users.getRequired.success', {
      userId: id,
      childCount: user.children.length,
    });
    return user;
  }

  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User> {
    debugLog('users.updateProfile.start', {
      userId,
      hasDisplayName: input.displayName !== undefined,
      hasHomeRegion: input.homeRegion !== undefined,
      activeChildCount: input.activeChildIds?.length,
    });
    return this.users.updateProfile(userId, input);
  }

  deleteUser(userId: string): Promise<void> {
    debugLog('users.delete.start', { userId });
    return this.users.deleteUser(userId);
  }

  createChild(userId: string, input: CreateChildInput): Promise<Child> {
    debugLog('users.createChild.start', {
      userId,
      nickname: input.nickname,
    });
    return this.users.createChild(userId, input);
  }

  updateChild(userId: string, childId: string, input: UpdateChildInput): Promise<Child> {
    debugLog('users.updateChild.start', {
      userId,
      childId,
      hasNickname: input.nickname !== undefined,
      hasBirthDate: input.birthDate !== undefined,
    });
    return this.users.updateChild(userId, childId, input);
  }

  deleteChild(userId: string, childId: string): Promise<void> {
    debugLog('users.deleteChild.start', { userId, childId });
    return this.users.deleteChild(userId, childId);
  }
}
