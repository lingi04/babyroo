import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../common/auth.guard';
import { CurrentUser, RequestUser } from '../../../../common/current-user.decorator';
import { CreateChildInput, UpdateChildInput, UpdateUserProfileInput } from '../../domain/user.entity';
import {
  DELETE_USER_USE_CASE,
  DeleteUserUseCase,
} from '../../application/ports/in/delete-user.use-case';
import {
  GET_CURRENT_USER_USE_CASE,
  GetCurrentUserUseCase,
} from '../../application/ports/in/get-current-user.use-case';
import {
  MANAGE_CHILDREN_USE_CASE,
  ManageChildrenUseCase,
} from '../../application/ports/in/manage-children.use-case';
import {
  UPDATE_USER_PROFILE_USE_CASE,
  UpdateUserProfileUseCase,
} from '../../application/ports/in/update-user-profile.use-case';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    @Inject(GET_CURRENT_USER_USE_CASE)
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    @Inject(UPDATE_USER_PROFILE_USE_CASE)
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    @Inject(DELETE_USER_USE_CASE)
    private readonly deleteUserUseCase: DeleteUserUseCase,
    @Inject(MANAGE_CHILDREN_USE_CASE)
    private readonly manageChildrenUseCase: ManageChildrenUseCase,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.getCurrentUserUseCase.getRequiredUser(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() body: UpdateUserProfileInput) {
    return this.updateUserProfileUseCase.updateProfile(user.id, body);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: RequestUser) {
    return this.deleteUserUseCase.deleteUser(user.id);
  }

  @Post('me/children')
  createChild(@CurrentUser() user: RequestUser, @Body() body: CreateChildInput) {
    return this.manageChildrenUseCase.createChild(user.id, body);
  }

  @Patch('me/children/:childId')
  updateChild(
    @CurrentUser() user: RequestUser,
    @Param('childId') childId: string,
    @Body() body: UpdateChildInput,
  ) {
    return this.manageChildrenUseCase.updateChild(user.id, childId, body);
  }

  @Delete('me/children/:childId')
  deleteChild(@CurrentUser() user: RequestUser, @Param('childId') childId: string) {
    return this.manageChildrenUseCase.deleteChild(user.id, childId);
  }
}
