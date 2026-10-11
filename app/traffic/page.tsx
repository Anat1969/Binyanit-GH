import type { Metadata } from "next";
import Link from "next/link";
import { TRAFFIC_COPY, TRAFFIC_DOC } from "@/content/traffic";
import TrafficMap from "./TrafficMap";

export const metadata: Metadata = {
  title: "רחובות ותנועה | התחדשות בניינית אשדוד",
  description: "רחובות עם חזית פעילה, צירי הסעת המונים ורשת הרחובות לפי נספח התנועה של תכנית 603-0972307.",
};

export default function Page() {
  return (
    <div className="wrap section">
      <header className="story-head stack">
        <div className="label">{TRAFFIC_COPY.kicker}</div>
        <h1 className="h2">{TRAFFIC_COPY.title}</h1>
        <p className="lead">{TRAFFIC_COPY.deck}</p>
        <div className="row-gap muted" style={{ fontSize: 13 }}>
          <span>עורך: {TRAFFIC_DOC.editor}</span>
          <span>תאריך: <span className="num">{TRAFFIC_DOC.date}</span></span>
          <span>קנ&quot;מ <span className="num">{TRAFFIC_DOC.scale}</span></span>
          <span className="chip">{TRAFFIC_DOC.status}</span>
          <span>{TRAFFIC_DOC.stamp}</span>
        </div>
      </header>

      <TrafficMap />

      <section className="grid grid-3" style={{ marginTop: 32 }} aria-label="איך לקרוא את המפה">
        {TRAFFIC_COPY.read.map((r) => (
          <article key={r.title} className="card stack">
            <h2 className="h3">{r.title}</h2>
            <p style={{ margin: 0 }}>{r.text}</p>
            <span className="cite">{r.sources}</span>
          </article>
        ))}
      </section>

      <section className="grid grid-2" style={{ marginTop: 24, alignItems: "start" }}>
        <div className="state warn">
          <b>מה המפה לא עושה</b>
          <ul className="plain" style={{ marginTop: 6 }}>
            {TRAFFIC_COPY.limits.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
        <div className="card stack">
          <h2 className="h3">הרחוב של בניין מסוים</h2>
          <p style={{ margin: 0 }} className="muted">
            בבדיקת הכתובת סיווג הרחוב נקרא משכבות התשריט. כשהוא לא נמצא, בוחרים אותו ידנית, ואפשר להיעזר במפה הזו.
          </p>
          <div className="row-gap">
            <Link href="/check" className="btn small">לבדיקת כתובת</Link>
            <Link href="/qa" className="btn small ghost">שאלות על התכנית</Link>
          </div>
          <p style={{ margin: 0 }} className="muted">{TRAFFIC_COPY.next}</p>
          <span className="cite">מקור: {TRAFFIC_DOC.file}</span>
        </div>
      </section>
    </div>
  );
}
