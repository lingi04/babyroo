import { Injectable, NotFoundException } from '@nestjs/common';
import { createId } from '../../../../common/id';
import {
  Child,
  CreateChildInput,
  UpdateChildInput,
  UpdateUserProfileInput,
  UpsertUserInput,
  User,
} from '../../domain/user.entity';
import { UserRepositoryPort } from '../../application/ports/out/user-repository.port';

@Injectable()
export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly users = new Map<string, User>();

  async upsertFromAuth(input: UpsertUserInput): Promise<User> {
    const existing = this.users.get(input.id);
    const now = new Date().toISOString();

    if (existing) {
      const updated = {
        ...existing,
        displayName: input.displayName ?? existing.displayName,
        updatedAt: now,
      };
      this.users.set(input.id, updated);
      return updated;
    }

    const user: User = {
      id: input.id,
      displayName: input.displayName ?? '',
      children: [],
      activeChildIds: [],
      homeRegion: '서울',
      preferredLocalities: [],
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User> {
    const user = this.requireUser(userId);
    const childIds = new Set(user.children.map(child => child.id));
    const activeChildIds = input.activeChildIds?.filter(id => childIds.has(id));
    const updated: User = {
      ...user,
      ...input,
      activeChildIds: activeChildIds ?? user.activeChildIds,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
  }

  async createChild(userId: string, input: CreateChildInput): Promise<Child> {
    const user = this.requireUser(userId);
    const child: Child = {
      id: createId('child'),
      nickname: input.nickname,
      birthDate: input.birthDate,
      gender: input.gender ?? 'unknown',
    };
    const updated: User = {
      ...user,
      children: [...user.children, child],
      activeChildIds:
        user.activeChildIds.length === 0
          ? [child.id]
          : [...user.activeChildIds, child.id],
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, updated);
    return child;
  }

  async updateChild(
    userId: string,
    childId: string,
    input: UpdateChildInput,
  ): Promise<Child> {
    const user = this.requireUser(userId);
    const child = user.children.find(item => item.id === childId);
    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const updatedChild: Child = { ...child, ...input };
    const updated: User = {
      ...user,
      children: user.children.map(item => (item.id === childId ? updatedChild : item)),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, updated);
    return updatedChild;
  }

  async deleteChild(userId: string, childId: string): Promise<void> {
    const user = this.requireUser(userId);
    const children = user.children.filter(child => child.id !== childId);
    const updated: User = {
      ...user,
      children,
      activeChildIds: user.activeChildIds.filter(id => id !== childId),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, updated);
  }

  private requireUser(userId: string): User {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
