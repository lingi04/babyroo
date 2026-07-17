import { clearSavedUser, loadUser, saveUser } from './userStorage';
import { User } from '../data/user';

const userWithAddedChild: User = {
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
      id: 'child-added',
      nickname: '셋째',
      birthDate: '2026-01-10',
      gender: 'female',
    },
  ],
  activeChildIds: ['child-001', 'child-added'],
  homeRegion: '서울',
  preferredLocalities: ['중구'],
};

afterEach(async () => {
  await clearSavedUser();
});

test('loads a previously saved user with added children', async () => {
  await saveUser(userWithAddedChild);

  const loadedUser = await loadUser();

  expect(loadedUser.children).toHaveLength(2);
  expect(loadedUser.children[1]).toMatchObject({
    id: 'child-added',
    nickname: '셋째',
    birthDate: '2026-01-10',
    gender: 'female',
  });
  expect(loadedUser.activeChildIds).toContain('child-added');
});
