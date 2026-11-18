const VISIBILITY_OFFSET = 420;
const DIRECTION_DISTANCE = 48;

export type RecommendationCtaScrollState = {
  visible: boolean;
  anchorOffset: number;
};

export function updateRecommendationCtaScroll(
  state: RecommendationCtaScrollState,
  offset: number,
  maxOffset: number,
): RecommendationCtaScrollState {
  const y = Math.max(0, Math.min(offset, Math.max(0, maxOffset)));

  if (y <= VISIBILITY_OFFSET) {
    return {
      visible: false,
      anchorOffset: state.visible ? y : Math.min(state.anchorOffset, y),
    };
  }

  const anchorOffset = state.visible
    ? Math.max(state.anchorOffset, y)
    : Math.min(state.anchorOffset, y);
  const distance = state.visible ? anchorOffset - y : y - anchorOffset;

  if (distance >= DIRECTION_DISTANCE) {
    return { visible: !state.visible, anchorOffset: y };
  }

  return { visible: state.visible, anchorOffset };
}
