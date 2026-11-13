import { useId, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function Input({
  id,
  label,
  type = 'text',
  error,
  hint,
  className = '',
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy =
    [hint && `${inputId}-hint`, error && `${inputId}-error`]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={`form-field ${className}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="input-wrap">
        <input
          {...props}
          id={inputId}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={isPassword ? 'password-input' : ''}
        />
        {isPassword && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setVisible((value) => !value)}
            aria-label={`${visible ? 'Hide' : 'Show'} ${label?.toLowerCase() || 'password'}`}
            aria-pressed={visible}
            disabled={props.disabled}
          >
            {visible ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
      {hint && (
        <small id={`${inputId}-hint`} className="field-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${inputId}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
