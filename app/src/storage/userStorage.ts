import AsyncStorage from '@react-native-async-storage/async-storage';

import { Child, currentUser, User } from '../data/user';

const USER_STORAGE_KEY = '@babyroo/user';

export async function loadUser(): Promise<User> {
  const rawUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

  if (!rawUser) {
    return currentUser;
  }

  try {
    return normalizeUser(JSON.parse(rawUser) as User);
  } catch {
    return currentUser;
  }
}

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export async function clearSavedUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_STORAGE_KEY);
}

function normalizeUser(user: User): User {
  return {
    ...user,
    children: user.children.map(normalizeChild),
  };
}

function normalizeChild(child: Child & { ageMonths?: number }): Child {
  if (child.birthDate) {
    return child;
  }

  return {
    id: child.id,
    nickname: child.nickname,
    birthDate: birthDateFromAgeMonths(child.ageMonths ?? 0),
    gender: child.gender,
  };
}

function birthDateFromAgeMonths(ageMonths: number) {
  const today = new Date();
  const birthDate = new Date(today.getFullYear(), today.getMonth() - ageMonths, today.getDate());
  const year = birthDate.getFullYear();
  const month = String(birthDate.getMonth() + 1).padStart(2, '0');
  const day = String(birthDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
