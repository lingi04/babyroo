import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { createId } from '../../../../common/id';
import { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import {
  Child,
  CreateChildInput,
  UpdateChildInput,
  UpdateUserProfileInput,
  UpsertUserInput,
  User,
  UserHomeAddress,
} from '../../domain/user.entity';
import { UserRepositoryPort } from '../../application/ports/out/user-repository.port';

type UserWithChildren = Prisma.UserGetPayload<{
  include: { children: { orderBy: { createdAt: 'asc' } } };
}>;

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  private readonly prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: process.env.DATABASE_URL ?? '',
    }),
  });

  async upsertFromAuth(input: UpsertUserInput): Promise<User> {
    const user = await this.prisma.user.upsert({
      where: { id: input.id },
      update:
        input.displayName === undefined
          ? {}
          : {
              displayName: input.displayName,
            },
      create: {
        id: input.id,
        displayName: input.displayName ?? '',
        homeRegion: '서울',
        activeChildIds: [],
        preferredLocalities: [],
      },
      include: this.includeChildren(),
    });

    return this.toDomainUser(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.includeChildren(),
    });

    return user ? this.toDomainUser(user) : null;
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User> {
    const existing = await this.requireUser(userId);
    const childIds = new Set(existing.children.map(child => child.id));
    const activeChildIds = input.activeChildIds?.filter(id => childIds.has(id));

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        homeRegion: input.homeRegion,
        homeAddress:
          input.homeAddress === undefined
            ? undefined
            : (input.homeAddress as Prisma.InputJsonValue),
        preferredLocalities: input.preferredLocalities,
        activeChildIds,
      },
      include: this.includeChildren(),
    });

    return this.toDomainUser(user);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async createChild(userId: string, input: CreateChildInput): Promise<Child> {
    const user = await this.requireUser(userId);
    const child = await this.prisma.child.create({
      data: {
        id: createId('child'),
        userId,
        nickname: input.nickname,
        birthDate: input.birthDate,
        gender: input.gender ?? 'unknown',
      },
    });

    if (user.activeChildIds.length === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { activeChildIds: [child.id] },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { activeChildIds: [...user.activeChildIds, child.id] },
      });
    }

    return this.toDomainChild(child);
  }

  async updateChild(
    userId: string,
    childId: string,
    input: UpdateChildInput,
  ): Promise<Child> {
    await this.requireChild(userId, childId);

    const child = await this.prisma.child.update({
      where: { id: childId },
      data: {
        birthDate: input.birthDate,
        gender: input.gender,
        nickname: input.nickname,
      },
    });

    return this.toDomainChild(child);
  }

  async deleteChild(userId: string, childId: string): Promise<void> {
    const user = await this.requireUser(userId);
    await this.requireChild(userId, childId);

    await this.prisma.child.delete({
      where: { id: childId },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeChildIds: user.activeChildIds.filter(id => id !== childId),
      },
    });
  }

  private includeChildren() {
    return {
      children: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    } satisfies Prisma.UserInclude;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async requireChild(userId: string, childId: string): Promise<void> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child || child.userId !== userId) {
      throw new NotFoundException('Child not found');
    }
  }

  private toDomainUser(user: UserWithChildren): User {
    return {
      id: user.id,
      displayName: user.displayName,
      children: user.children.map(child => this.toDomainChild(child)),
      activeChildIds: user.activeChildIds,
      homeRegion: user.homeRegion,
      homeAddress: this.toHomeAddress(user.homeAddress),
      preferredLocalities: user.preferredLocalities,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private toDomainChild(child: {
    id: string;
    nickname: string;
    birthDate: string;
    gender: string;
  }): Child {
    return {
      id: child.id,
      nickname: child.nickname,
      birthDate: child.birthDate,
      gender:
        child.gender === 'female' || child.gender === 'male'
          ? child.gender
          : 'unknown',
    };
  }

  private toHomeAddress(value: Prisma.JsonValue): UserHomeAddress | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as UserHomeAddress;
  }
}
