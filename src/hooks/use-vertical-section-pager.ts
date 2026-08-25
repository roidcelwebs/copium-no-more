import { useCallback, useEffect, useRef, useState } from "react";
import {
  LANDING_SCROLL_EDGE_EPSILON,
  resolveLandingSectionDrag,
  resolveLandingSectionWheel,
} from "@/lib/landing-section-scroll";

const SWIPE_DISTANCE = 36;
const SWIPE_VELOCITY = 500;

type Point = { y: number; time: number };

type DragState = {
  pointerId: number;
  startY: number;
  startPosition: number;
  history: Point[];
  scrollElement: HTMLElement | null;
  startScrollTop: number;
};

export function useVerticalSectionPager(
  sectionCount: number,
  canNavigate?: (fromIndex: number, toIndex: number) => boolean,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const positionRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const wheelLockedRef = useRef(false);
  const wheelTimerRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const [index, setIndexState] = useState(0);

  const viewportHeight = useCallback(
    () => viewportRef.current?.clientHeight ?? window.innerHeight,
    [],
  );

  const setPosition = useCallback((position: number) => {
    // Round to avoid subpixel sliver visible between sections
    const rounded = Math.round(position);
    positionRef.current = rounded;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(0, ${rounded}px, 0)`;
    }
  }, []);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const springTo = useCallback(
    (target: number, initialVelocity = 0) => {
      stopAnimation();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPosition(target);
        return;
      }

      let position = positionRef.current;
      let velocity = initialVelocity;
      let previousTime = performance.now();
      const stiffness = 210;
      const damping = 29;

      const frame = (time: number) => {
        const deltaSeconds = Math.min(0.032, Math.max(0.001, (time - previousTime) / 1000));
        previousTime = time;
        const displacement = position - target;
        const acceleration = -stiffness * displacement - damping * velocity;
        velocity += acceleration * deltaSeconds;
        position += velocity * deltaSeconds;
        setPosition(position);

        if (Math.abs(position - target) < 0.35 && Math.abs(velocity) < 4) {
          setPosition(target);
          frameRef.current = null;
          return;
        }
        frameRef.current = window.requestAnimationFrame(frame);
      };
      frameRef.current = window.requestAnimationFrame(frame);
    },
    [setPosition, stopAnimation],
  );

  const goTo = useCallback(
    (requestedIndex: number, velocity = 0) => {
      const currentIndex = indexRef.current;
      const singleStepRequest =
        Math.abs(requestedIndex - currentIndex) > 1
          ? currentIndex + Math.sign(requestedIndex - currentIndex)
          : requestedIndex;
      const nextIndex = Math.max(0, Math.min(sectionCount - 1, singleStepRequest));
      if (nextIndex !== currentIndex && canNavigate && !canNavigate(currentIndex, nextIndex)) {
        springTo(-currentIndex * viewportHeight());
        return;
      }
      indexRef.current = nextIndex;
      setIndexState(nextIndex);
      springTo(-nextIndex * viewportHeight(), velocity);
      window.requestAnimationFrame(() => viewportRef.current?.focus({ preventScroll: true }));
    },
    [canNavigate, sectionCount, springTo, viewportHeight],
  );

  useEffect(() => {
    const resize = () => {
      stopAnimation();
      setPosition(-indexRef.current * viewportHeight());
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [setPosition, stopAnimation, viewportHeight]);

  useEffect(
    () => () => {
      stopAnimation();
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
    },
    [stopAnimation],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragRef.current) return;
    stopAnimation();
    didDragRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const scrollElement = findSectionScroller(event.target);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: positionRef.current,
      history: [{ y: event.clientY, time: performance.now() }],
      scrollElement,
      startScrollTop: scrollElement?.scrollTop ?? 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rawDelta = event.clientY - drag.startY;
    if (Math.abs(rawDelta) > 10) didDragRef.current = true;
    drag.history.push({ y: event.clientY, time: performance.now() });
    if (drag.history.length > 5) drag.history.shift();

    if (drag.scrollElement) {
      const maxScrollTop = Math.max(
        0,
        drag.scrollElement.scrollHeight - drag.scrollElement.clientHeight,
      );
      const resolution = resolveLandingSectionDrag(drag.startScrollTop, maxScrollTop, rawDelta);
      drag.scrollElement.scrollTop = resolution.scrollTop;
      if (!resolution.handToPager) {
        setPosition(drag.startPosition);
        return;
      }
    }

    const height = viewportHeight();
    let delta = rawDelta;
    const atFirst = indexRef.current === 0 && delta > 0;
    const atLast = indexRef.current === sectionCount - 1 && delta < 0;
    if (atFirst || atLast) delta = rubberband(delta, height);
    setPosition(drag.startPosition + delta);
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const delta = event.clientY - drag.startY;
    const isLastPage = indexRef.current === sectionCount - 1;
    const isFirstPage = indexRef.current === 0;

    // Last page scrollable handling: two-swipe to go back
    if (drag.scrollElement) {
      const maxScroll = Math.max(0, drag.scrollElement.scrollHeight - drag.scrollElement.clientHeight);
      const noScroll = maxScroll <= LANDING_SCROLL_EDGE_EPSILON;
      // If no scroll needed (big screen), single swipe up (drag down) should go to previous
      if (noScroll) {
        if (delta > 20 || (delta > 0 && releaseVelocity(drag.history) > 200)) {
          if (!isFirstPage) {
            goTo(indexRef.current - 1, releaseVelocity(drag.history));
            return;
          }
        }
        // Drag up on last page (trying to go next) should stay with rubberband
        if (isLastPage && delta < 0) {
          goTo(indexRef.current);
          return;
        }
      } else {
        // Scrollable last page: first swipe from bottom to top should stay, second swipe from top should go previous
        if (drag.startScrollTop > LANDING_SCROLL_EDGE_EPSILON) {
          // Started not at top -> always stay on current, just scroll inside
          goTo(indexRef.current);
          return;
        }
        // Started at top
        if (delta < 0) {
          // Drag up trying to go next from last page -> stay (rubberband)
          if (isLastPage) {
            goTo(indexRef.current);
            return;
          }
        }
        // For previous page, require smaller threshold on last page for easier back navigation
        if (isLastPage && delta > 12) {
          goTo(indexRef.current - 1, releaseVelocity(drag.history));
          return;
        }
      }
    }

    if (drag.scrollElement && (drag.startScrollTop > LANDING_SCROLL_EDGE_EPSILON || delta < 0)) {
      goTo(indexRef.current);
      return;
    }

    const velocity = releaseVelocity(drag.history);
    if (delta < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) {
      goTo(indexRef.current + 1, velocity);
    } else if (delta > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) {
      goTo(indexRef.current - 1, velocity);
    } else {
      goTo(indexRef.current, velocity);
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const deltaY = normalizedWheelDelta(event);
    const scrollElement = findSectionScroller(event.target);

    if (scrollElement) {
      const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      const resolution = resolveLandingSectionWheel(scrollElement.scrollTop, maxScrollTop, deltaY);
      scrollElement.scrollTop = resolution.scrollTop;
      if (!resolution.handToPager) return;
    }

    if (wheelLockedRef.current || Math.abs(deltaY) < 6) return;
    wheelLockedRef.current = true;
    goTo(indexRef.current + (deltaY > 0 ? 1 : -1), -deltaY * 7);
    if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = window.setTimeout(() => {
      wheelLockedRef.current = false;
    }, 700);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) return;

    const scrollElement = currentSectionScroller(trackRef.current, indexRef.current);
    const maxScrollTop = scrollElement
      ? Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
      : 0;
    const isDownKey = ["ArrowDown", "PageDown", " "].includes(event.key);
    const isUpKey = ["ArrowUp", "PageUp"].includes(event.key);

    if (scrollElement && isDownKey && scrollElement.scrollTop < maxScrollTop - 1) {
      event.preventDefault();
      scrollElement.scrollBy({
        top: keyScrollDistance(event.key, scrollElement.clientHeight),
        behavior: preferredScrollBehavior(),
      });
      return;
    }
    if (scrollElement && isUpKey && scrollElement.scrollTop > LANDING_SCROLL_EDGE_EPSILON) {
      event.preventDefault();
      scrollElement.scrollBy({
        top: -keyScrollDistance(event.key, scrollElement.clientHeight),
        behavior: preferredScrollBehavior(),
      });
      return;
    }

    if (isDownKey) {
      event.preventDefault();
      goTo(indexRef.current + 1);
    } else if (isUpKey) {
      event.preventDefault();
      goTo(indexRef.current - 1);
    }
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!didDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    didDragRef.current = false;
  };

  return {
    index,
    viewportRef,
    trackRef,
    goTo,
    interactionProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      onWheel,
      onKeyDown,
      onClickCapture,
    },
  };
}

function findSectionScroller(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-section-scroll]") : null;
}

function currentSectionScroller(track: HTMLDivElement | null, index: number): HTMLElement | null {
  const section = track?.children.item(index);
  if (!(section instanceof HTMLElement)) return null;
  if (section.matches("[data-section-scroll]")) return section;
  return section.querySelector<HTMLElement>("[data-section-scroll]");
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, textarea, select, [contenteditable='true']"))
  );
}

function normalizedWheelDelta(event: React.WheelEvent<HTMLDivElement>): number {
  if (event.deltaMode === 1) return event.deltaY * 24;
  if (event.deltaMode === 2) return event.deltaY * event.currentTarget.clientHeight;
  return event.deltaY;
}

function keyScrollDistance(key: string, viewport: number): number {
  return key === "ArrowDown" || key === "ArrowUp" ? 72 : viewport * 0.82;
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function releaseVelocity(history: Point[]): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  const first = history[Math.max(0, history.length - 4)];
  const elapsed = Math.max(1, last.time - first.time);
  return ((last.y - first.y) / elapsed) * 1000;
}

function rubberband(distance: number, dimension: number, constant = 0.55): number {
  return (distance * dimension * constant) / (dimension + constant * Math.abs(distance));
}
