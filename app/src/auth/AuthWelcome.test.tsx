import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { AuthWelcome } from './AuthWelcome';

test('renders the approved Login copy with real line breaks', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <AuthWelcome
        bottomPadding={24}
        onSignIn={async () => {}}
        onBrowse={() => {}}
      />,
    );
  });
  const text = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(text).toEqual(
    expect.arrayContaining([
      'babyroo',
      '우리 아이들에게 맞는\n나들이를 찾아볼까요?',
      '아이의 나이와 관심사에 맞춰\n갈 만한 곳을 함께 골라드려요.',
      'Google로 계속하기',
      '로그인 없이 둘러보기',
    ]),
  );
  await act(async () => {
    renderer.unmount();
  });
});

test.each([false, true])(
  'guards repeat Google requests and restores the action after cancellation (guest=%s)',
  async recommendation => {
    let finish!: () => void;
    const onSignIn = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AuthWelcome
          recommendation={recommendation}
          bottomPadding={24}
          onSignIn={onSignIn}
        />,
      );
    });
    const label = recommendation
      ? 'Sign in for personalization'
      : 'Continue with Google';
    const button = () =>
      renderer.root.findByProps({ accessibilityLabel: label });
    const press = button().props.onPress;
    let first!: Promise<void>;
    await act(async () => {
      first = press();
      await press();
    });
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(button().props.disabled).toBe(true);
    expect(button().props.accessibilityState.busy).toBe(true);
    await act(async () => {
      finish();
      await first;
    });
    expect(button().props.disabled).toBe(false);
    await act(async () => {
      renderer.unmount();
    });
  },
);

test.each([false, true])(
  'handles an unexpected sign-in failure and allows retry (guest=%s)',
  async recommendation => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onSignIn = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AuthWelcome
          recommendation={recommendation}
          bottomPadding={24}
          onSignIn={onSignIn}
        />,
      );
    });
    const button = () =>
      renderer.root.findByProps({
        accessibilityLabel: recommendation
          ? 'Sign in for personalization'
          : 'Continue with Google',
      });
    await act(async () => {
      await expect(button().props.onPress()).resolves.toBeUndefined();
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(
      '로그인 실패',
      '로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(button().props.disabled).toBe(false);
    await act(async () => {
      await button().props.onPress();
    });
    expect(onSignIn).toHaveBeenCalledTimes(2);
    expect(alert).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.unmount();
    });
    alert.mockRestore();
  },
);

test('does not show a stale failure after leaving the sign-in screen', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let fail!: (error: Error) => void;
  const onSignIn = () =>
    new Promise<void>((_resolve, reject) => {
      fail = reject;
    });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <AuthWelcome bottomPadding={24} onSignIn={onSignIn} />,
    );
  });
  let request!: Promise<void>;
  await act(async () => {
    request = renderer.root
      .findByProps({ accessibilityLabel: 'Continue with Google' })
      .props.onPress();
  });
  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    fail(new Error('storage failed'));
    await expect(request).resolves.toBeUndefined();
  });
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});
