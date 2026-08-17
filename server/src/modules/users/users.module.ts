import { Module } from '@nestjs/common';
import { getDatabaseUrl } from '../../common/database-url';
import { InMemoryUserRepository } from './adapters/out/in-memory-user.repository';
import { PrismaUserRepository } from './adapters/out/prisma-user.repository';
import { UsersController } from './adapters/in/users.controller';
import { DELETE_USER_USE_CASE } from './application/ports/in/delete-user.use-case';
import { GET_CURRENT_USER_USE_CASE } from './application/ports/in/get-current-user.use-case';
import { MANAGE_CHILDREN_USE_CASE } from './application/ports/in/manage-children.use-case';
import { UPDATE_USER_PROFILE_USE_CASE } from './application/ports/in/update-user-profile.use-case';
import { UPSERT_USER_FROM_AUTH_USE_CASE } from './application/ports/in/upsert-user-from-auth.use-case';
import { USER_REPOSITORY_PORT } from './application/ports/out/user-repository.port';
import { UserAccountService } from './application/services/user-account.service';

@Module({
  controllers: [UsersController],
  providers: [
    {
      provide: USER_REPOSITORY_PORT,
      useClass: getDatabaseUrl()
        ? PrismaUserRepository
        : InMemoryUserRepository,
    },
    {
      provide: UserAccountService,
      useFactory: repository => new UserAccountService(repository),
      inject: [USER_REPOSITORY_PORT],
    },
    {
      provide: UPSERT_USER_FROM_AUTH_USE_CASE,
      useExisting: UserAccountService,
    },
    {
      provide: GET_CURRENT_USER_USE_CASE,
      useExisting: UserAccountService,
    },
    {
      provide: UPDATE_USER_PROFILE_USE_CASE,
      useExisting: UserAccountService,
    },
    {
      provide: DELETE_USER_USE_CASE,
      useExisting: UserAccountService,
    },
    {
      provide: MANAGE_CHILDREN_USE_CASE,
      useExisting: UserAccountService,
    },
  ],
  exports: [UPSERT_USER_FROM_AUTH_USE_CASE, GET_CURRENT_USER_USE_CASE],
})
export class UsersModule {}
