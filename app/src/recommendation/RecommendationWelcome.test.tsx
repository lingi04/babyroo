import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RecommendationWelcome } from './RecommendationWelcome';

test('shows every selected child with their age and one shared edit action', () => {
  const onEditChildren = jest.fn();
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      <RecommendationWelcome
        children={[
          { id: 'one', name: '링구', age: '18개월' },
          { id: 'two', name: '서준', age: '54개월' },
        ]}
        label="추천 시작하기"
        loading={false}
        onEditChildren={onEditChildren}
        onStart={jest.fn()}
        onCredits={jest.fn()}
      />,
    );
  });
  try {
    const root = renderer!.root;
    expect(root.findByProps({ children: '링구 · 18개월' })).toBeTruthy();
    expect(root.findByProps({ children: '서준 · 54개월' })).toBeTruthy();
    const hero = root.findByType(Image);
    // Explicit dimensions prevent the source PNG's native height from sizing the row.
    expect(StyleSheet.flatten(hero.props.style)).toMatchObject({
      width: '100%', height: '100%',
    });
    expect(StyleSheet.flatten(hero.parent!.props.style).aspectRatio).toBe(2.3);
    act(() =>
      root
        .findByProps({ accessibilityLabel: 'Edit recommendation children' })
        .props.onPress(),
    );
    expect(onEditChildren).toHaveBeenCalledTimes(1);
  } finally {
    act(() => renderer!.unmount());
  }
});
