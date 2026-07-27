import { useCallback, useMemo, useRef } from 'react';
import { ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

export type TabSwipeDirection = 'previous' | 'next';

export type TabSwipeHandlers = {
  onStart: (event: GestureResponderEvent) => void;
  onMove: (event: GestureResponderEvent) => void;
  onEnd: (event: GestureResponderEvent) => void;
};

export const TAB_SWIPE = {
  activationDistance: 12,
  commitDistance: 48,
  horizontalRatio: 1.35,
  transitionDistance: Dimensions.get('window').width,
  transitionDurationMs: 180,
} as const;

type SwipeableTabsOptions<TabId extends string> = {
  activeTab: TabId;
  tabOrder: readonly TabId[];
  onChangeTab: (tab: TabId) => void;
  activationDistance?: number;
  commitDistance?: number;
  horizontalRatio?: number;
  transitionDistance?: number;
  transitionDurationMs?: number;
};

export type SwipeableTabsController<TabId extends string> = {
  navigateToTab: (nextTab: TabId) => void;
  tabSwipeHandlers: TabSwipeHandlers;
  tabSwipePanHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  tabTranslateX: Animated.Value;
  transitionDistance: number;
};

type SwipeableTabViewProps<TabId extends string> = {
  activeTab: TabId;
  controller: SwipeableTabsController<TabId>;
  paneStyle?: StyleProp<ViewStyle>;
  renderTab: (tab: TabId, tabSwipeHandlers: TabSwipeHandlers) => ReactNode;
  stripAccessibilityLabel?: string;
  stripStyle?: StyleProp<ViewStyle>;
  tabOrder: readonly TabId[];
  viewportAccessibilityLabel?: string;
  viewportStyle?: StyleProp<ViewStyle>;
};

export function useSwipeableTabs<TabId extends string>({
  activeTab,
  tabOrder,
  onChangeTab,
  activationDistance = TAB_SWIPE.activationDistance,
  commitDistance = TAB_SWIPE.commitDistance,
  horizontalRatio = TAB_SWIPE.horizontalRatio,
  transitionDistance = TAB_SWIPE.transitionDistance,
  transitionDurationMs = TAB_SWIPE.transitionDurationMs,
}: SwipeableTabsOptions<TabId>): SwipeableTabsController<TabId> {
  const tabSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const tabSwipeActiveRef = useRef(false);
  const tabTransitionInProgressRef = useRef(false);
  const tabTranslateX = useRef(
    new Animated.Value(
      tabTranslateOffset(activeTab, tabOrder, transitionDistance),
    ),
  ).current;

  const animateTabTranslateX = useCallback(
    (toValue: number, onComplete?: () => void) => {
      if (isTestEnvironment()) {
        tabTranslateX.setValue(toValue);
        onComplete?.();
        return;
      }

      Animated.timing(tabTranslateX, {
        toValue,
        duration: transitionDurationMs,
        useNativeDriver: true,
      }).start(() => onComplete?.());
    },
    [tabTranslateX, transitionDurationMs],
  );

  const navigateToTab = useCallback(
    (nextTab: TabId) => {
      if (nextTab === activeTab || tabTransitionInProgressRef.current) {
        return;
      }

      const currentIndex = tabOrder.indexOf(activeTab);
      const nextIndex = tabOrder.indexOf(nextTab);

      if (nextIndex < 0 || currentIndex < 0) {
        return;
      }

      tabTransitionInProgressRef.current = true;
      animateTabTranslateX(
        tabTranslateOffset(nextTab, tabOrder, transitionDistance),
        () => {
          onChangeTab(nextTab);
          tabTransitionInProgressRef.current = false;
        },
      );
    },
    [activeTab, animateTabTranslateX, onChangeTab, tabOrder, transitionDistance],
  );

  const finishTabSwipeByDistance = useCallback(
    (dx: number, dy: number) => {
      if (tabTransitionInProgressRef.current) {
        return;
      }

      const direction = tabSwipeDirection(dx, dy, {
        commitDistance,
        horizontalRatio,
      });
      const nextTab = direction
        ? adjacentTab(activeTab, direction, tabOrder)
        : undefined;

      if (direction && nextTab) {
        tabTransitionInProgressRef.current = true;
        animateTabTranslateX(
          tabTranslateOffset(nextTab, tabOrder, transitionDistance),
          () => {
            onChangeTab(nextTab);
            tabTransitionInProgressRef.current = false;
          },
        );
        return;
      }

      animateTabTranslateX(
        tabTranslateOffset(activeTab, tabOrder, transitionDistance),
      );
    },
    [
      activeTab,
      animateTabTranslateX,
      commitDistance,
      horizontalRatio,
      onChangeTab,
      tabOrder,
      transitionDistance,
    ],
  );

  const moveTabSwipeByDistance = useCallback(
    (dx: number, dy: number) => {
      if (tabTransitionInProgressRef.current) {
        return;
      }

      if (
        tabSwipeActiveRef.current ||
        isHorizontalTabSwipe(dx, dy, {
          minimumDistance: activationDistance,
          horizontalRatio,
        })
      ) {
        tabSwipeActiveRef.current = true;
        tabTranslateX.setValue(
          constrainTabSwipeOffset(activeTab, dx, tabOrder, transitionDistance),
        );
      }
    },
    [
      activationDistance,
      activeTab,
      horizontalRatio,
      tabOrder,
      tabTranslateX,
      transitionDistance,
    ],
  );

  const startTabSwipe = useCallback(
    (event: GestureResponderEvent) => {
      tabSwipeStartRef.current = {
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      };
      tabSwipeActiveRef.current = false;
      tabTranslateX.stopAnimation();
    },
    [tabTranslateX],
  );

  const moveTabSwipe = useCallback(
    (event: GestureResponderEvent) => {
      const start = tabSwipeStartRef.current;

      if (!start) {
        return;
      }

      moveTabSwipeByDistance(
        event.nativeEvent.pageX - start.x,
        event.nativeEvent.pageY - start.y,
      );
    },
    [moveTabSwipeByDistance],
  );

  const finishTabSwipe = useCallback(
    (event: GestureResponderEvent) => {
      const start = tabSwipeStartRef.current;
      tabSwipeStartRef.current = null;

      if (!start) {
        return;
      }

      const dx = event.nativeEvent.pageX - start.x;
      const dy = event.nativeEvent.pageY - start.y;
      const wasActive = tabSwipeActiveRef.current;
      tabSwipeActiveRef.current = false;

      if (
        wasActive ||
        tabSwipeDirection(dx, dy, { commitDistance, horizontalRatio })
      ) {
        finishTabSwipeByDistance(dx, dy);
      }
    },
    [commitDistance, finishTabSwipeByDistance, horizontalRatio],
  );

  const tabSwipeHandlers = useMemo<TabSwipeHandlers>(
    () => ({
      onStart: startTabSwipe,
      onMove: moveTabSwipe,
      onEnd: finishTabSwipe,
    }),
    [finishTabSwipe, moveTabSwipe, startTabSwipe],
  );

  const tabSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          isHorizontalTabSwipe(gestureState.dx, gestureState.dy, {
            minimumDistance: activationDistance,
            horizontalRatio,
          }),
        onPanResponderGrant: (_, gestureState) => {
          tabSwipeStartRef.current = {
            x: gestureState.x0,
            y: gestureState.y0,
          };
          tabSwipeActiveRef.current = false;
          tabTranslateX.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) =>
          moveTabSwipeByDistance(gestureState.dx, gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          tabSwipeStartRef.current = null;
          tabSwipeActiveRef.current = false;
          finishTabSwipeByDistance(gestureState.dx, gestureState.dy);
        },
        onPanResponderTerminate: (_, gestureState) => {
          tabSwipeStartRef.current = null;
          tabSwipeActiveRef.current = false;
          finishTabSwipeByDistance(gestureState.dx, gestureState.dy);
        },
      }),
    [
      activationDistance,
      finishTabSwipeByDistance,
      horizontalRatio,
      moveTabSwipeByDistance,
      tabTranslateX,
    ],
  );

  return {
    navigateToTab,
    tabSwipeHandlers,
    tabSwipePanHandlers: tabSwipeResponder.panHandlers,
    tabTranslateX,
    transitionDistance,
  };
}

export function SwipeableTabView<TabId extends string>({
  activeTab,
  controller,
  paneStyle,
  renderTab,
  stripAccessibilityLabel = 'Tab strip',
  stripStyle,
  tabOrder,
  viewportAccessibilityLabel = 'Tab swipe area',
  viewportStyle,
}: SwipeableTabViewProps<TabId>) {
  const {
    tabSwipeHandlers,
    tabSwipePanHandlers,
    tabTranslateX,
    transitionDistance,
  } = controller;

  return (
    <View
      style={viewportStyle}
      accessibilityLabel={viewportAccessibilityLabel}
      onTouchStart={tabSwipeHandlers.onStart}
      onTouchMove={tabSwipeHandlers.onMove}
      onTouchEnd={tabSwipeHandlers.onEnd}
      {...tabSwipePanHandlers}
    >
      <Animated.View
        style={[
          stripStyle,
          {
            width: transitionDistance * tabOrder.length,
            transform: [{ translateX: tabTranslateX }],
          },
        ]}
        accessibilityLabel={stripAccessibilityLabel}
      >
        {tabOrder.map(tab => (
          <View
            key={tab}
            style={[paneStyle, { width: transitionDistance }]}
            pointerEvents={tab === activeTab ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== activeTab}
            importantForAccessibility={
              tab === activeTab ? 'auto' : 'no-hide-descendants'
            }
          >
            {renderTab(tab, tabSwipeHandlers)}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export function useTabSwipePressGuard(
  onPress: () => void,
  tabSwipeHandlers?: TabSwipeHandlers,
) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeCommittedRef = useRef(false);

  const handleTouchStart = (touchEvent: GestureResponderEvent) => {
    touchStartRef.current = {
      x: touchEvent.nativeEvent.pageX,
      y: touchEvent.nativeEvent.pageY,
    };
    swipeCommittedRef.current = false;
    tabSwipeHandlers?.onStart(touchEvent);
  };

  const handleTouchMove = (touchEvent: GestureResponderEvent) => {
    const start = touchStartRef.current;

    if (!start) {
      return;
    }

    const dx = touchEvent.nativeEvent.pageX - start.x;
    const dy = touchEvent.nativeEvent.pageY - start.y;

    if (
      isHorizontalTabSwipe(dx, dy, {
        minimumDistance: TAB_SWIPE.activationDistance,
      })
    ) {
      swipeCommittedRef.current = true;
    }

    tabSwipeHandlers?.onMove(touchEvent);
  };

  const handleTouchEnd = (touchEvent: GestureResponderEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start) {
      return;
    }

    const dx = touchEvent.nativeEvent.pageX - start.x;
    const dy = touchEvent.nativeEvent.pageY - start.y;
    const direction = tabSwipeDirection(dx, dy);

    if (direction) {
      swipeCommittedRef.current = true;
    }

    tabSwipeHandlers?.onEnd(touchEvent);
  };

  const handlePress = () => {
    if (swipeCommittedRef.current) {
      swipeCommittedRef.current = false;
      return;
    }

    onPress();
  };

  return {
    onPress: handlePress,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onTouchStart: handleTouchStart,
  };
}

function adjacentTab<TabId extends string>(
  tab: TabId,
  direction: TabSwipeDirection,
  tabOrder: readonly TabId[],
) {
  const currentIndex = tabOrder.indexOf(tab);
  const nextIndex =
    direction === 'next' ? currentIndex + 1 : currentIndex - 1;

  return tabOrder[nextIndex];
}

function tabTranslateOffset<TabId extends string>(
  tab: TabId,
  tabOrder: readonly TabId[],
  transitionDistance: number,
) {
  return -tabOrder.indexOf(tab) * transitionDistance;
}

function constrainTabSwipeOffset<TabId extends string>(
  tab: TabId,
  dx: number,
  tabOrder: readonly TabId[],
  transitionDistance: number,
) {
  const baseOffset = tabTranslateOffset(tab, tabOrder, transitionDistance);

  if (dx > 0 && !adjacentTab(tab, 'previous', tabOrder)) {
    return baseOffset;
  }

  if (dx < 0 && !adjacentTab(tab, 'next', tabOrder)) {
    return baseOffset;
  }

  return Math.max(
    tabTranslateOffset(
      tabOrder[tabOrder.length - 1],
      tabOrder,
      transitionDistance,
    ),
    Math.min(
      tabTranslateOffset(tabOrder[0], tabOrder, transitionDistance),
      baseOffset + dx,
    ),
  );
}

type HorizontalSwipeOptions = {
  minimumDistance: number;
  horizontalRatio?: number;
};

export function isHorizontalTabSwipe(
  dx: number,
  dy: number,
  {
    minimumDistance,
    horizontalRatio = TAB_SWIPE.horizontalRatio,
  }: HorizontalSwipeOptions,
) {
  const horizontalDistance = Math.abs(dx);
  const verticalDistance = Math.abs(dy);

  return (
    horizontalDistance >= minimumDistance &&
    horizontalDistance > verticalDistance * horizontalRatio
  );
}

type TabSwipeDirectionOptions = {
  commitDistance?: number;
  horizontalRatio?: number;
};

export function tabSwipeDirection(
  dx: number,
  dy: number,
  {
    commitDistance = TAB_SWIPE.commitDistance,
    horizontalRatio = TAB_SWIPE.horizontalRatio,
  }: TabSwipeDirectionOptions = {},
): TabSwipeDirection | null {
  if (
    !isHorizontalTabSwipe(dx, dy, {
      minimumDistance: commitDistance,
      horizontalRatio,
    })
  ) {
    return null;
  }

  return dx < 0 ? 'next' : 'previous';
}

function isTestEnvironment() {
  return (
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV === 'test'
  );
}
