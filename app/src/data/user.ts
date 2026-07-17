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

export const currentUser: User = {
  id: 'local-parent-001',
  displayName: '움빠둠빠',
  children: [
    {
      id: 'child-001',
      nickname: '첫째',
      birthDate: '2024-06-17',
      gender: 'male',
    },
    {
      id: 'child-002',
      nickname: '둘째',
      birthDate: '2025-07-17',
      gender: 'female',
    },
  ],
  activeChildIds: ['child-001', 'child-002'],
  homeRegion: '서울',
  preferredLocalities: ['중구', '광진구', '영등포구'],
};

export function getSelectedChildren(user: User) {
  const selectedChildren = user.children.filter(child => user.activeChildIds.includes(child.id));

  return selectedChildren.length > 0 ? selectedChildren : user.children;
}
