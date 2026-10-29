import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./CSS/Dialogs.css";

// App-wide confirmations and notices, drawn in the binder's style instead of the browser's own boxes. Any screen
// calls confirmAction() or notify(); DialogHost, mounted once in App, shows them.

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  // Destructive: the confirm button is drawn as a warning and Cancel gets the focus, so Enter doesn't destroy.
  danger?: boolean;
  // For what can't be undone at all: the confirm button only works once this is typed (case and spaces aside).
  requireText?: string;
};

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

// A short message at the foot of the screen, e.g. "Verbete movido para a Lixeira", with an optional action
// such as "Desfazer".
type Notice = { id: number; text: string; action?: { label: string; run: () => void } };

let pending: PendingConfirm | null = null;
let notice: Notice | null = null;
let noticeCount = 0;
let snapshot: { pending: PendingConfirm | null; notice: Notice | null } = { pending, notice };
const listeners = new Set<() => void>();

function changed() {
  snapshot = { pending, notice };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Resolves to whether the user confirmed. A second call while one is open cancels the first.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false);
  return new Promise(resolve => {
    pending = { ...options, resolve };
    // A notice would sit over the dialog's buttons on a phone, and its action no longer fits the moment.
    notice = null;
    changed();
  });
}

function settle(confirmed: boolean) {
  const current = pending;
  pending = null;
  changed();
  current?.resolve(confirmed);
}

export function notify(text: string, action?: Notice["action"]) {
  notice = { id: ++noticeCount, text, action };
  changed();
}

function dismissNotice(id: number) {
  if (notice?.id !== id) return;
  notice = null;
  changed();
}

export function isDialogOpen() {
  return pending !== null;
}

// For the Android back button: closes an open confirmation (as a cancel) and says whether there was one.
export function closeOpenDialog() {
  if (!pending) return false;
  settle(false);
  return true;
}

// How long a notice stays; one with an action stays longer, to give time to use it.
const NOTICE_MS = 5000;
const NOTICE_WITH_ACTION_MS = 9000;

const typedKey = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

function ConfirmDialog({ dialog }: { dialog: PendingConfirm }) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const canConfirm = !dialog.requireText || typedKey(typed) === typedKey(dialog.requireText);

  // Focus goes into the dialog and back to where it was once the dialog closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (dialog.requireText ? inputRef : dialog.danger ? cancelRef : confirmRef).current?.focus();
    return () => previous?.focus?.();
  }, [dialog]);

  // Tab and Shift+Tab go round the dialog's own controls and never leave it.
  const trapTab = (event: React.KeyboardEvent) => {
    const stops = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? []);
    if (!stops.length) return;
    event.preventDefault();
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const next = (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
    stops[next]!.focus();
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => settle(false)}>
      <section
        ref={dialogRef}
        className={`dialog${dialog.danger ? " dialog--danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={dialog.message ? "dialog-message" : undefined}
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            settle(false);
          } else if (event.key === "Tab") {
            trapTab(event);
          }
        }}
      >
        <h2 id="dialog-title" className="dialog__title">
          {dialog.title}
        </h2>
        {dialog.message && (
          <p id="dialog-message" className="dialog__message">
            {dialog.message}
          </p>
        )}
        {dialog.requireText && (
          <label className="dialog__field">
            Para confirmar, digite <strong>{dialog.requireText}</strong>
            <input
              ref={inputRef}
              className="dialog__input"
              value={typed}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && canConfirm) settle(true);
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          </label>
        )}
        <div className="dialog__actions">
          <button ref={cancelRef} type="button" className="dialog__button" onClick={() => settle(false)}>
            {dialog.cancelLabel ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="dialog__button dialog__button--confirm"
            disabled={!canConfirm}
            onClick={() => settle(true)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function NoticeBar({ notice }: { notice: Notice }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissNotice(notice.id), notice.action ? NOTICE_WITH_ACTION_MS : NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="notice">
      <span className="notice__text">{notice.text}</span>
      {notice.action && (
        <button
          type="button"
          className="notice__action"
          onClick={() => {
            dismissNotice(notice.id);
            notice.action!.run();
          }}
        >
          {notice.action.label}
        </button>
      )}
      <button type="button" className="notice__close" aria-label="Fechar aviso" onClick={() => dismissNotice(notice.id)}>
        ×
      </button>
    </div>
  );
}

export function DialogHost() {
  const { pending, notice } = useSyncExternalStore(subscribe, () => snapshot);
  return (
    <>
      {/* Always in the page, so screen readers announce a notice as it appears. */}
      <div className="notice-region" role="status" aria-live="polite">
        {notice && <NoticeBar key={notice.id} notice={notice} />}
      </div>
      {pending && <ConfirmDialog dialog={pending} />}
    </>
  );
}
