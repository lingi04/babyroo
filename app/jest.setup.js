/* global jest */

const storage = new Map();

const mockAsyncStorage = {
  getItem: jest.fn(key => Promise.resolve(storage.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    storage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn(key => {
    storage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    storage.clear();
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));
