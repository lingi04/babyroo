export const DELETE_USER_USE_CASE = Symbol('DELETE_USER_USE_CASE');

export interface DeleteUserUseCase {
  deleteUser(userId: string): Promise<void>;
}

