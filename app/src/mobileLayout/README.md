# mobileLayout

Reusable React Native layout helpers for apps with bottom navigation, phone safe
areas, and horizontally swipeable tab screens.

## What To Use

Use `MobileLayoutProvider` once near the root of the app. It installs the safe
area provider used by the rest of this module.

Use `SwipeableTabs` when a screen has peer tabs that should move with horizontal
swipes. It owns the animated strip, swipe responder, pane sizing, and swipe
state.

Use `useTabSwipePressGuard(onPress)` inside pressable content rendered by
`SwipeableTabs`. It lets horizontal swipes pass through to tab navigation instead
of accidentally firing the press action.

Use `useBottomSafeAreaInset()` plus helpers like `bottomTabsSafeArea()` or
`bottomInsetPadding()` when fixed UI needs to sit above the phone home indicator.

## Safe Area

Wrap the app once:

```tsx
import { MobileLayoutProvider } from './src/mobileLayout';

export function App() {
  return (
    <MobileLayoutProvider>
      <YourApp />
    </MobileLayoutProvider>
  );
}
```

Apply the bottom inset to fixed UI:

```tsx
import { bottomInsetPadding, bottomTabsSafeArea, useBottomSafeAreaInset } from './src/mobileLayout';

function Screen() {
  const bottomInset = useBottomSafeAreaInset();

  return (
    <>
      <View style={bottomInsetPadding(bottomInset, 24)} />
      <View style={[styles.bottomTabs, bottomTabsSafeArea(bottomInset)]} />
    </>
  );
}
```

## Swipeable Tabs

Render the tabs with one component:

```tsx
import { SwipeableTabs } from './src/mobileLayout';

type Tab = 'home' | 'explore' | 'saved';

const TAB_ORDER: Tab[] = ['home', 'explore', 'saved'];

function Screen() {
  const [tab, setTab] = useState<Tab>('explore');

  return (
    <SwipeableTabs
      activeTab={tab}
      onChangeTab={setTab}
      renderBottomNavigation={({ activeTab, navigateToTab }) => (
        <BottomTabs activeTab={activeTab} onChange={navigateToTab} />
      )}
      renderTab={(tab, { navigateToTab }) =>
        renderTab(tab, navigateToTab)
      }
      tabOrder={TAB_ORDER}
    />
  );
}
```

Inside pressable content rendered by `SwipeableTabs`, use
`useTabSwipePressGuard(onPress)` so horizontal swipes do not trigger the item
press.

```tsx
import { Pressable } from 'react-native';
import { useTabSwipePressGuard } from './src/mobileLayout';

function EventCard({ onPress }: { onPress: () => void }) {
  const pressGuard = useTabSwipePressGuard(onPress);

  return (
    <Pressable
      onPress={pressGuard.onPress}
      onTouchEnd={pressGuard.onTouchEnd}
      onTouchMove={pressGuard.onTouchMove}
      onTouchStart={pressGuard.onTouchStart}
    />
  );
}
```
