export default function Loader({ text = 'Loading…', fullPage = false }) {
  return (
    <div className={`loader ${fullPage ? 'loader-page' : ''}`} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
