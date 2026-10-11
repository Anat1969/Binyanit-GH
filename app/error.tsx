"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="wrap section stack">
      <div className="state bad" role="alert">
        <b>אירעה שגיאה</b>
        הדף לא נטען כראוי.
      </div>
      <button className="btn" type="button" onClick={reset} style={{ alignSelf: "flex-start" }}>ניסיון נוסף</button>
    </div>
  );
}
