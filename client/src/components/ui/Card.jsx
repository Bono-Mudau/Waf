export default function Card({ heading, children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {heading && <h2>{heading}</h2>}
      {children}
    </div>
  );
}
