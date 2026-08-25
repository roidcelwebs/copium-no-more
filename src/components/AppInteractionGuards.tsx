import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable="true"]') !== null
  );
}

export function AppInteractionGuards() {
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => {
      if (!isEditableTarget(event.target)) event.preventDefault();
    };
    const preventDrag = (event: DragEvent) => event.preventDefault();
    const preventAuxiliaryLinkOpen = (event: MouseEvent) => {
      if (event.button === 1 && event.target instanceof Element && event.target.closest("a")) {
        event.preventDefault();
      }
    };
    const preventModifiedLinkOpen = (event: MouseEvent) => {
      if (
        (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) &&
        event.target instanceof Element &&
        event.target.closest("a")
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("auxclick", preventAuxiliaryLinkOpen);
    document.addEventListener("click", preventModifiedLinkOpen, true);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("auxclick", preventAuxiliaryLinkOpen);
      document.removeEventListener("click", preventModifiedLinkOpen, true);
    };
  }, []);

  return null;
}
