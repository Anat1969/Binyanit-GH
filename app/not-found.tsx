import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap section stack">
      <div className="label">404</div>
      <h1 className="h2">הדף לא נמצא</h1>
      <Link className="btn" href="/" style={{ alignSelf: "flex-start" }}>חזרה לדף הראשי</Link>
    </div>
  );
}
