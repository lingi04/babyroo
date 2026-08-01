export type ChildGender = 'female' | 'male' | 'unknown';

export type Child = {
  id: string;
  nickname: string;
  birthDate: string;
  gender: ChildGender;
};

export type User = {
  id: string;
  displayName: string;
  children: Child[];
  activeChildIds: string[];
  homeRegion: string;
  preferredLocalities: string[];
};

export type UserProfileInput = {
  id: string;
  displayName?: string;
};

export const currentUser: User = {
  id: 'local-parent-001',
  displayName: '',
  children: [],
  activeChildIds: [],
  homeRegion: '서울',
  preferredLocalities: [],
};

export function createUserProfile({
  displayName = '',
  id,
}: UserProfileInput): User {
  return {
    ...currentUser,
    id,
    displayName,
  };
}

export function isUserProfileComplete(user: User) {
  return user.displayName.trim().length > 0 && user.children.length > 0;
}

export function getSelectedChildren(user: User) {
  const selectedChildren = user.children.filter(child =>
    user.activeChildIds.includes(child.id),
  );

  return selectedChildren.length > 0 ? selectedChildren : user.children;
}
