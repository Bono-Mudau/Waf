export default function Label({ text, For, htmlFor, children, ...props }) {
  return (
    <label {...props} htmlFor={htmlFor || For}>
      {children || text}
    </label>
  );
}
