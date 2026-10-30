import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Gadget } from "../lib/gadgets";

type GadgetMenuProps = {
  // Where it opens: the pointer, or under the button that opened it.
  x: number;
  y: number;
  gadgets: Gadget[];
  onPick: (gadget: Gadget) => void;
  onClose: () => void;
};

// The note's own right-click menu: what can be inserted under the line that was clicked. Arrows move through it,
// Enter picks, Esc or a click anywhere else closes it.
export default function GadgetMenu({ x, y, gadgets, onPick, onClose }: GadgetMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Kept inside the window: opens up or to the left when there's no room below or to the right.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const margin = 8;
    setPosition({
      left: x + width + margin > window.innerWidth ? Math.max(margin, x - width) : x,
      top: y + height + margin > window.innerHeight ? Math.max(margin, y - height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();

    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const close = () => onClose();
    window.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", closeOutside, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      // Back where the cursor was, unless picking something moved it on.
      if (document.activeElement === document.body || menuRef.current?.contains(document.activeElement)) previous?.focus?.();
    };
  }, []);

  const handleKey = (event: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="gadget-menu"
      role="menu"
      aria-label="Inserir no verbete"
      style={{ left: position.left, top: position.top }}
      onKeyDown={handleKey}
      onContextMenu={event => event.preventDefault()}
    >
      <p className="gadget-menu__heading" aria-hidden="true">
        Inserir
      </p>
      {gadgets.map(gadget => (
        <button key={gadget.id} type="button" role="menuitem" className="gadget-menu__item" onClick={() => onPick(gadget)}>
          {gadget.label}
        </button>
      ))}
    </div>
  );
}
