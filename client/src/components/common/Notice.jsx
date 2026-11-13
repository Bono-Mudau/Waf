import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import Button from '../ui/Button';

export default function Notice({
  children,
  type = 'error',
  onRetry,
  onDismiss,
}) {
  if (!children) return null;
  const Icon =
    type === 'error'
      ? FiAlertCircle
      : type === 'success'
        ? FiCheckCircle
        : FiInfo;
  return (
    <div
      className={`notice notice-${type}`}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" />
      <div>{children}</div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
      {onDismiss && (
        <button
          className="icon-button"
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}
