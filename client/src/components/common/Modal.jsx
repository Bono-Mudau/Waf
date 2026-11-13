import { useEffect, useId, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import Button from '../ui/Button';

export default function Modal({
  open,
  title,
  onClose,
  busy = false,
  children,
}) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <FiX />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  busy,
  error,
  confirmText = 'Delete',
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} busy={busy}>
      <div className="confirm-content">{children}</div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" busy={busy} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
