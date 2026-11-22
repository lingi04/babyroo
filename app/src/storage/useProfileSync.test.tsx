import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { updateCurrentUserInBabyrooApi } from '../api/babyrooApi';
import { currentUser } from '../data/user';
import { useProfileSync } from './useProfileSync';

jest.mock('../api/babyrooApi', () => ({
  updateCurrentUserInBabyrooApi: jest.fn(),
}));
const update = jest.mocked(updateCurrentUserInBabyrooApi);
let enqueue: ReturnType<typeof useProfileSync>['enqueue'];
let save: ReturnType<typeof useProfileSync>['save'];
let renderer: TestRenderer.ReactTestRenderer;
function Harness({ token }: { token?: string }) {
  const sync = useProfileSync(token);
  enqueue = sync.enqueue;
  save = sync.save;
  return null;
}
beforeEach(async () => {
  jest.useFakeTimers();
  update.mockReset().mockResolvedValue(currentUser);
  await act(async () => {
    renderer = TestRenderer.create(<Harness token="first" />);
  });
});
afterEach(async () => {
  await act(async () => {
    renderer.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('coalesces rapid selections and merges other profile edits into one latest patch', async () => {
  enqueue({ activeChildIds: ['a'] });
  enqueue({ displayName: '보호자' });
  enqueue({ activeChildIds: ['a', 'b'] });
  enqueue({ activeChildIds: ['b'] });
  await act(async () => {
    jest.advanceTimersByTime(249);
  });
  expect(update).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith({
    accessToken: 'first',
    user: { displayName: '보호자', activeChildIds: ['b'] },
  });
});

test('serializes writes and sends the latest queued selection after a slow response', async () => {
  let finish!: () => void;
  update.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = () => resolve(currentUser);
      }),
  );
  enqueue({ activeChildIds: ['a'] });
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  enqueue({ activeChildIds: ['a', 'b'] });
  enqueue({ activeChildIds: ['b'] });
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls[1][0]).toEqual({
    accessToken: 'first',
    user: { activeChildIds: ['b'] },
  });
});

test('does not send an old session queued patch after account change', async () => {
  let finish!: () => void;
  update.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = () => resolve(currentUser);
      }),
  );
  enqueue({ activeChildIds: ['a'] });
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  enqueue({ activeChildIds: ['old-account-child'] });
  await act(async () => {
    renderer.update(<Harness token="second" />);
  });
  await act(async () => {
    finish();
    jest.advanceTimersByTime(250);
  });
  expect(update).toHaveBeenCalledTimes(1);
  enqueue({ activeChildIds: ['new-account-child'] });
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(update.mock.calls[1][0]).toEqual({
    accessToken: 'second',
    user: { activeChildIds: ['new-account-child'] },
  });
});

test('cancels a pending debounce on sign-out', async () => {
  enqueue({ activeChildIds: ['a'] });
  await act(async () => {
    renderer.update(<Harness />);
  });
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(update).not.toHaveBeenCalled();
});

test('explicit save replaces a queued selection and waits for the server', async () => {
  let finish!: () => void;
  update.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = () => resolve(currentUser);
      }),
  );
  enqueue({ activeChildIds: ['older'] });
  enqueue({ displayName: '보호자' });
  let done = false;
  const request = save({ activeChildIds: ['chosen'] }).then(() => {
    done = true;
  });
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith({
    accessToken: 'first',
    user: { displayName: '보호자', activeChildIds: ['chosen'] },
  });
  expect(done).toBe(false);
  await act(async () => {
    finish();
    await request;
    jest.advanceTimersByTime(250);
  });
  expect(done).toBe(true);
  expect(update).toHaveBeenCalledTimes(1);
});

test('explicit save propagates failure for the screen retry state', async () => {
  update.mockRejectedValueOnce(new Error('offline'));
  await expect(save({ activeChildIds: ['chosen'] })).rejects.toThrow('offline');
  update.mockResolvedValueOnce(currentUser);
  await expect(save({ activeChildIds: ['chosen'] })).resolves.toBeUndefined();
  expect(update).toHaveBeenCalledTimes(2);
});
