import React, { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

export const SAFE_AREA_LAYOUT = {
  bottomNavigationHeight: 82,
  screenBottomPadding: 112,
  floatingActionBottomOffset: 96,
} as const;

export const TAB_BAR_HEIGHT = SAFE_AREA_LAYOUT.bottomNavigationHeight;
export const TAB_SCREEN_BOTTOM_PADDING = SAFE_AREA_LAYOUT.screenBottomPadding;
export const FLOATING_RECOMMENDATION_BOTTOM =
  SAFE_AREA_LAYOUT.floatingActionBottomOffset;

type SafeAreaFrameProps = {
  children: ReactNode;
};

export function MobileLayoutProvider({ children }: SafeAreaFrameProps) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {children}
    </SafeAreaProvider>
  );
}

export const SafeAreaFrame = MobileLayoutProvider;

export function useBottomSafeAreaInset() {
  return useSafeAreaInsets().bottom;
}

export function tabScreenBottomPadding(bottomInset: number): ViewStyle {
  return bottomInsetPadding(bottomInset, TAB_SCREEN_BOTTOM_PADDING);
}

export function floatingRecommendationBottomOffset(
  bottomInset: number,
): ViewStyle {
  return bottomInsetOffset(bottomInset, FLOATING_RECOMMENDATION_BOTTOM);
}

export function detailContentBottomPadding(bottomInset: number): ViewStyle {
  return bottomInsetPadding(bottomInset, TAB_SCREEN_BOTTOM_PADDING);
}

export function bottomInsetPadding(
  bottomInset: number,
  basePaddingBottom = 0,
): ViewStyle {
  return {
    paddingBottom: basePaddingBottom + bottomInset,
  };
}

export function bottomInsetOffset(
  bottomInset: number,
  baseBottom = 0,
): ViewStyle {
  return {
    bottom: baseBottom + bottomInset,
  };
}

export function bottomInsetHeight(
  bottomInset: number,
  baseHeight: number,
): ViewStyle {
  return {
    height: baseHeight + bottomInset,
  };
}

export function bottomTabsSafeArea(bottomInset: number): ViewStyle {
  return {
    ...bottomInsetHeight(bottomInset, TAB_BAR_HEIGHT),
    paddingBottom: bottomInset,
  };
}
