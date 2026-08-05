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

jest.mock('react-native', () => {
  const React = require('react');
  const ReactNative = jest.requireActual('react-native');

  const renderListComponent = Component => {
    if (!Component) {
      return null;
    }

    if (React.isValidElement(Component)) {
      return Component;
    }

    return React.createElement(Component);
  };

  const FlatList = ({
    data = [],
    keyExtractor,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    contentContainerStyle,
    onScroll,
    scrollEventThrottle,
  }) =>
    React.createElement(
      ReactNative.ScrollView,
      { contentContainerStyle, onScroll, scrollEventThrottle },
      [
        React.createElement(
          React.Fragment,
          { key: 'list-header' },
          renderListComponent(ListHeaderComponent),
        ),
        data.length === 0
          ? React.createElement(
              React.Fragment,
              { key: 'list-empty' },
              renderListComponent(ListEmptyComponent),
            )
          : data.map((item, index) =>
              React.createElement(
                React.Fragment,
                {
                  key: keyExtractor
                    ? keyExtractor(item, index)
                    : item?.id ?? String(index),
                },
                renderItem({
                  item,
                  index,
                  separators: {
                    highlight: jest.fn(),
                    unhighlight: jest.fn(),
                    updateProps: jest.fn(),
                  },
                }),
              ),
            ),
      ],
    );

  Object.defineProperty(ReactNative, 'FlatList', {
    configurable: true,
    value: FlatList,
  });

  return ReactNative;
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() =>
      Promise.resolve({
        type: 'success',
        data: {
          user: {
            id: 'google-user-001',
            name: 'Google Parent',
            email: 'parent@example.com',
            photo: null,
          },
          scopes: ['email', 'profile'],
          idToken: 'mock-id-token',
          serverAuthCode: null,
        },
      }),
    ),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, right: 0, bottom: 34, left: 0 },
    },
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
  };
});
