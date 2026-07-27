import React, { useState } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pressable, Text } from 'react-native';

import {
  MobileLayoutProvider,
  SwipeableTabs,
  useTabSwipePressGuard,
} from '.';

type TestTab = 'first' | 'second';

test('renders swipeable tabs through the public mobileLayout API', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<TestTabs />);
  });

  expect(renderer!.root.findByProps({ children: 'first screen' })).toBeTruthy();
  expect(renderer!.root.findByProps({ children: 'first nav' })).toBeTruthy();
});

test('guards tab item presses while preserving swipe handlers from context', async () => {
  const onPress = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<TestTabs onItemPress={onPress} />);
  });

  const guardedItem = renderer!.root.findAllByProps({
    accessibilityLabel: 'Guarded item',
  })[0];

  await ReactTestRenderer.act(() => {
    guardedItem.props.onTouchStart({
      nativeEvent: { pageX: 200, pageY: 200 },
    });
    guardedItem.props.onTouchMove({
      nativeEvent: { pageX: 140, pageY: 202 },
    });
    guardedItem.props.onTouchEnd({
      nativeEvent: { pageX: 104, pageY: 204 },
    });
    guardedItem.props.onPress();
  });

  expect(onPress).not.toHaveBeenCalled();
  expect(renderer!.root.findByProps({ children: 'second screen' })).toBeTruthy();
});

function TestTabs({ onItemPress = jest.fn() }: { onItemPress?: () => void }) {
  const [tab, setTab] = useState<TestTab>('first');

  return (
    <MobileLayoutProvider>
      <SwipeableTabs
        activeTab={tab}
        onChangeTab={setTab}
        renderBottomNavigation={({ activeTab }) => (
          <Text>{`${activeTab} nav`}</Text>
        )}
        renderTab={currentTab => (
          <>
            <Text>{`${currentTab} screen`}</Text>
            <GuardedItem onPress={onItemPress} />
          </>
        )}
        tabOrder={['first', 'second']}
      />
    </MobileLayoutProvider>
  );
}

function GuardedItem({ onPress }: { onPress: () => void }) {
  const pressGuard = useTabSwipePressGuard(onPress);

  return (
    <Pressable
      accessibilityLabel="Guarded item"
      onPress={pressGuard.onPress}
      onTouchEnd={pressGuard.onTouchEnd}
      onTouchMove={pressGuard.onTouchMove}
      onTouchStart={pressGuard.onTouchStart}
    />
  );
}
