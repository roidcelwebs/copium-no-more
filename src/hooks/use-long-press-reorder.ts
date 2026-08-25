import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

const ACTIVATION_DELAY_MS = 1_000;
const MOVE_TOLERANCE_PX = 10;

type ReorderOptions = {
  itemIds: string[];
  onReorder: (activeId: string, overId: string) => void;
};

export function useLongPressReorder({ itemIds, onReorder }: ReorderOptions) {
  const itemIdsRef = useRef(itemIds);
  const itemElementsRef = useRef(new Map<string, HTMLElement>());
  const timerRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const overIdRef = useRef<string | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const offsetYRef = useRef(0);
  const pendingClientYRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  itemIdsRef.current = itemIds;

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearDrag = () => {
    cancelTimer();
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const activeElement = activeIdRef.current
      ? itemElementsRef.current.get(activeIdRef.current)
      : undefined;
    if (activeElement) activeElement.style.transform = "";
    activeIdRef.current = null;
    overIdRef.current = null;
    pointerIdRef.current = null;
    offsetYRef.current = 0;
    setActiveId(null);
    setOverId(null);
  };

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const activate = (id: string) => {
    activeIdRef.current = id;
    overIdRef.current = id;
    offsetYRef.current = 0;
    setActiveId(id);
    setOverId(id);
    const index = itemIdsRef.current.indexOf(id);
    setAnnouncement(`Picked up exercise ${index + 1} of ${itemIdsRef.current.length}.`);
    navigator.vibrate?.(20);
  };

  const nearestItem = (clientY: number): string | null => {
    let nearest: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const id of itemIdsRef.current) {
      const element = itemElementsRef.current.get(id);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - clientY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = id;
      }
    }
    return nearest;
  };

  const finishPointerDrag = () => {
    const active = activeIdRef.current;
    const over = overIdRef.current;
    if (active && over && active !== over) {
      onReorder(active, over);
      setAnnouncement(`Exercise moved to position ${itemIdsRef.current.indexOf(over) + 1}.`);
    } else if (active) {
      setAnnouncement("Exercise position unchanged.");
    }
    clearDrag();
  };

  const getHandleProps = (id: string, exerciseName: string) => ({
    type: "button" as const,
    "aria-label": `Reorder ${exerciseName}. Hold for one second and drag, or press Space then use arrow keys.`,
    "aria-pressed": activeId === id,
    style: { touchAction: "none" } as CSSProperties,
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      cancelTimer();
      pointerIdRef.current = event.pointerId;
      startYRef.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      timerRef.current = window.setTimeout(() => activate(id), ACTIVATION_DELAY_MS);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      if (!activeIdRef.current) {
        if (Math.abs(event.clientY - startYRef.current) > MOVE_TOLERANCE_PX) cancelTimer();
        return;
      }
      event.preventDefault();
      pendingClientYRef.current = event.clientY;
      offsetYRef.current = event.clientY - startYRef.current;
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null;
          const activeElement = activeIdRef.current
            ? itemElementsRef.current.get(activeIdRef.current)
            : undefined;
          if (activeElement) {
            activeElement.style.transform = `translate3d(0, ${offsetYRef.current}px, 0) scale(1.025)`;
          }
        });
      }
      const nearest = nearestItem(pendingClientYRef.current);
      if (nearest && nearest !== overIdRef.current) {
        overIdRef.current = nearest;
        setOverId(nearest);
      }
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      if (activeIdRef.current) finishPointerDrag();
      else clearDrag();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: () => clearDrag(),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (activeIdRef.current === id) {
          setAnnouncement("Exercise dropped.");
          clearDrag();
        } else {
          clearDrag();
          activate(id);
        }
        return;
      }
      if (event.key === "Escape" && activeIdRef.current === id) {
        event.preventDefault();
        setAnnouncement("Reorder cancelled.");
        clearDrag();
        return;
      }
      if (activeIdRef.current !== id || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
        return;
      }
      event.preventDefault();
      const ids = itemIdsRef.current;
      const current = ids.indexOf(id);
      const target = current + (event.key === "ArrowUp" ? -1 : 1);
      if (target < 0 || target >= ids.length) return;
      onReorder(id, ids[target]);
      setAnnouncement(`Exercise moved to position ${target + 1}.`);
    },
  });

  const registerItem = (id: string) => (element: HTMLLIElement | null) => {
    if (element) itemElementsRef.current.set(id, element);
    else itemElementsRef.current.delete(id);
  };

  const getItemStyle = (id: string): CSSProperties | undefined => {
    if (activeId !== id) return undefined;
    return {
      position: "relative",
      zIndex: 30,
      transform: `translate3d(0, ${offsetYRef.current}px, 0) scale(1.025)`,
      transition: "box-shadow 120ms ease",
      willChange: "transform",
    };
  };

  return {
    activeId,
    overId,
    announcement,
    getHandleProps,
    registerItem,
    getItemStyle,
  };
}
