export default function Loading() {
  return (
    <div className="wrap section stack" aria-busy="true" aria-label="טוען">
      <div className="skeleton" style={{ height: 36, width: "40%" }} />
      <div className="skeleton" style={{ height: 96 }} />
      <div className="skeleton" style={{ height: 420 }} />
    </div>
  );
}
