/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BackHandler, Linking } from 'react-native';
import App from '../App';
import { eventsNewestFirst } from '../src/data/events';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('opens the source URL from the event detail CTA', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: `Open ${eventsNewestFirst[0].title}` })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Open source or reservation page' })
      .props.onPress();
  });

  expect(openURL).toHaveBeenCalledWith(eventsNewestFirst[0].sourceUrl);
});

test('hardware back closes the event detail screen before exiting the app', async () => {
  let hardwareBackPress: (() => boolean) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((event, handler) => {
      if (event === 'hardwareBackPress') {
        hardwareBackPress = () => handler({} as never) === true;
      }

      return { remove: jest.fn() };
    });

  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: `Open ${eventsNewestFirst[0].title}` })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Open source or reservation page',
    }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    expect(hardwareBackPress?.()).toBe(true);
  });

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Open source or reservation page',
    }),
  ).toHaveLength(0);
});
