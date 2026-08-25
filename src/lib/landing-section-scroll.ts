export const LANDING_SCROLL_EDGE_EPSILON = 1;

export type LandingSectionScrollResolution = {
  scrollTop: number;
  handToPager: boolean;
};

/**
 * Resolve a finger drag that started inside the landing page's internally
 * scrollable final section. A drag that begins away from the top remains owned
 * by the section until release, even if that drag reaches the top edge.
 */
export function resolveLandingSectionDrag(
  startScrollTop: number,
  maxScrollTop: number,
  fingerDeltaY: number,
): LandingSectionScrollResolution {
  if (startScrollTop > LANDING_SCROLL_EDGE_EPSILON || fingerDeltaY < 0) {
    return {
      scrollTop: clamp(startScrollTop - fingerDeltaY, 0, maxScrollTop),
      handToPager: false,
    };
  }

  return { scrollTop: startScrollTop, handToPager: true };
}

/**
 * Downward wheel/trackpad movement always belongs to final-section content.
 * Upward movement returns to the pager only when the content was already at
 * its top edge before that event.
 */
export function resolveLandingSectionWheel(
  scrollTop: number,
  maxScrollTop: number,
  deltaY: number,
): LandingSectionScrollResolution {
  if (deltaY > 0 || scrollTop > LANDING_SCROLL_EDGE_EPSILON) {
    return {
      scrollTop: clamp(scrollTop + deltaY, 0, maxScrollTop),
      handToPager: false,
    };
  }

  return { scrollTop, handToPager: true };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
