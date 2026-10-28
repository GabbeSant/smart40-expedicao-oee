import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
  fallbackFocusId,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  fallbackFocusId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
      else if (fallbackFocusId)
        document.getElementById(fallbackFocusId)?.focus();
    };
  }, [fallbackFocusId]);
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="dialog-title">
      <div className="modal-heading">
        <span className="eyebrow">SMART 4.0 · DEMONSTRAÇÃO</span>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Fechar janela"
        >
          ×
        </button>
      </div>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}
