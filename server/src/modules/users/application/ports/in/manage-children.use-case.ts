import {
  Child,
  CreateChildInput,
  UpdateChildInput,
} from '../../../domain/user.entity';

export const MANAGE_CHILDREN_USE_CASE = Symbol('MANAGE_CHILDREN_USE_CASE');

export interface ManageChildrenUseCase {
  createChild(userId: string, input: CreateChildInput): Promise<Child>;
  updateChild(userId: string, childId: string, input: UpdateChildInput): Promise<Child>;
  deleteChild(userId: string, childId: string): Promise<void>;
}

