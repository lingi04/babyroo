import {
  type RecommendationCtaScrollState,
  updateRecommendationCtaScroll,
} from './recommendationCtaScroll';

function scroll(
  offsets: number[],
  state: RecommendationCtaScrollState = { visible: false, anchorOffset: 0 },
  maxOffset = 2000,
) {
  return offsets.reduce(
    (current, offset) =>
      updateRecommendationCtaScroll(current, offset, maxOffset),
    state,
  );
}

test('starts hidden and shows only beyond 420dp', () => {
  expect(scroll([0, 200, 420]).visible).toBe(false);
  expect(scroll([0, 200, 420, 421]).visible).toBe(true);
});

test('hides at 48dp upward and shows again at 48dp downward', () => {
  const visible = scroll([600]);
  expect(scroll([553], visible).visible).toBe(true);
  const hidden = scroll([552], visible);
  expect(hidden.visible).toBe(false);
  expect(scroll([599], hidden).visible).toBe(false);
  expect(scroll([600], hidden).visible).toBe(true);
});

test('accumulates movement across pauses and separate small scrolls', () => {
  expect(scroll([600, 580, 580, 560, 560]).visible).toBe(true);
  expect(scroll([600, 580, 580, 560, 550]).visible).toBe(false);
  expect(scroll([600, 552, 572, 572, 592, 600]).visible).toBe(true);
});

test('small oscillations do not accumulate into visibility changes', () => {
  expect(scroll([600, 580, 595, 570, 590, 560]).visible).toBe(true);
  expect(scroll([600, 552, 572, 557, 582, 562, 592]).visible).toBe(false);
});

test('uses the latest high or low point as the anchor', () => {
  expect(scroll([600, 650, 603]).visible).toBe(true);
  expect(scroll([600, 650, 602]).visible).toBe(false);
  expect(scroll([600, 552, 500, 548]).visible).toBe(true);
});

test('hides at the cutoff and resets when returning to the top', () => {
  expect(scroll([450, 420]).visible).toBe(false);
  expect(scroll([600, 0, -40, 0, 420]).visible).toBe(false);
  expect(scroll([600, 0, 421]).visible).toBe(true);
});

test('ignores bottom overscroll and cannot show on short lists', () => {
  expect(scroll([600, 700, 650, 600], undefined, 600).visible).toBe(true);
  expect(
    scroll([650, 600, 552], { visible: false, anchorOffset: 552 }, 552)
      .visible,
  ).toBe(false);
  expect(scroll([100, 500], undefined, 300).visible).toBe(false);
});
