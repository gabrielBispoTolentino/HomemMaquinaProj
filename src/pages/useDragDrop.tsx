import { useEffect, useRef, useState, type ReactNode } from "react";

// Drag and drop for the listing and the corkboard, built on pointer events so it works with a mouse and on touch
// screens (where HTML drag and drop is patchy). A mouse drag starts after moving a few pixels; a touch drag starts
// with a long press, so a normal swipe still scrolls.
//
// Drop targets are elements with a data-drop attribute; `resolve` turns the one under the pointer into an intent
// (what dropping there would do), or null where the item can't go.

export type DragSource = { kind: "note" | "subgroup"; id: string; label: string };

type Options<Intent> = {
  resolve: (source: DragSource, target: HTMLElement, x: number, y: number) => Intent | null;
  onDrop: (source: DragSource, intent: Intent) => void;
};

type DragState<Intent> = { source: DragSource; x: number; y: number; intent: Intent | null };

const MOUSE_THRESHOLD = 5;
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 350;
// Within this distance of a scrolling container's edge, dragging scrolls it.
const EDGE = 48;

export function useDragDrop<Intent>({ resolve, onDrop }: Options<Intent>) {
  const [drag, setDrag] = useState<DragState<Intent> | null>(null);
  // The handlers are attached once per gesture, so they read the latest options and state through refs.
  const options = useRef({ resolve, onDrop });
  options.current = { resolve, onDrop };
  const current = useRef<DragState<Intent> | null>(null);
  // Set when a drag ends, so the click that follows the pointerup doesn't also open the item.
  const suppressClick = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const update = (next: DragState<Intent> | null) => {
    current.current = next;
    setDrag(next);
  };

  const begin = (event: React.PointerEvent<HTMLElement>, source: DragSource) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cleanup.current?.();

    const startX = event.clientX;
    const startY = event.clientY;
    const touch = event.pointerType !== "mouse";
    const scroller = event.currentTarget.closest<HTMLElement>("[data-drag-scroll]");
    let started = false;
    let pointer = { x: startX, y: startY };
    let frame = 0;
    let pressTimer: ReturnType<typeof setTimeout> | undefined;

    const locate = () => {
      const element = document.elementFromPoint(pointer.x, pointer.y);
      const target = element?.closest<HTMLElement>("[data-drop]");
      const intent = target ? options.current.resolve(source, target, pointer.x, pointer.y) : null;
      update({ source, x: pointer.x, y: pointer.y, intent });
    };

    // Keeps scrolling while the pointer rests near an edge.
    const autoScroll = () => {
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const speed =
          pointer.y < rect.top + EDGE ? -(rect.top + EDGE - pointer.y) / 3 : pointer.y > rect.bottom - EDGE ? (pointer.y - rect.bottom + EDGE) / 3 : 0;
        if (speed) {
          scroller.scrollTop += speed;
          locate();
        }
      }
      frame = requestAnimationFrame(autoScroll);
    };

    const start = () => {
      started = true;
      document.body.classList.add("is-dragging");
      if (touch) navigator.vibrate?.(10);
      locate();
      frame = requestAnimationFrame(autoScroll);
    };

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      pointer = { x: move.clientX, y: move.clientY };
      const distance = Math.hypot(pointer.x - startX, pointer.y - startY);

      if (!started) {
        if (touch && distance > TOUCH_SLOP) finish(); // moved before the long press: it's a scroll
        else if (!touch && distance > MOUSE_THRESHOLD) start();
        return;
      }
      locate();
    };

    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== event.pointerId) return;
      const state = current.current;
      if (started) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        if (state?.intent) options.current.onDrop(source, state.intent);
      }
      finish();
    };

    // While dragging on a touch screen, the finger moves the item instead of scrolling the page.
    const onTouchMove = (touchMove: TouchEvent) => {
      if (started) touchMove.preventDefault();
    };

    const onKey = (key: KeyboardEvent) => {
      if (key.key === "Escape") finish();
    };

    function finish() {
      clearTimeout(pressTimer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-dragging");
      cleanup.current = null;
      update(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    if (touch) pressTimer = setTimeout(start, LONG_PRESS_MS);
    cleanup.current = finish;
  };

  // Spread onto anything that can be dragged.
  const dragHandle = (source: DragSource) => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => begin(event, source),
    onClickCapture: (event: React.MouseEvent) => {
      if (suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    // A long press on touch screens would otherwise open the context menu.
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  // The label that follows the pointer while dragging.
  const ghost: ReactNode = drag && (
    <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
      {drag.source.label}
    </div>
  );

  return { drag, dragHandle, ghost };
}
