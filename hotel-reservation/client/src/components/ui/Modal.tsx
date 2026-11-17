import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog>: focus trapping, Esc to close and the backdrop come from the browser. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="modal-title">
      <header className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="modal-body">{open && children}</div>
    </dialog>
  );
}
