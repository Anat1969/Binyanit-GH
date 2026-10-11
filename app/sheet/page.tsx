import type { Metadata } from "next";
import {
  DEMOLISH_ADD_FLOORS,
  DISCLAIMER,
  PROTECTION_BASE_FULL_FLOORS,
  PUBLIC_ALLOCATION,
  RETROFIT_BASE_FULL_FLOORS,
  SEC,
} from "@/engine/config";
import { PLAN } from "@/content/plan-meta";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { PAGE } from "@/content/site";
import SheetClient from "./SheetClient";
import "./sheet.css";

export const metadata: Metadata = {
  title: "מפת התשריט | התחדשות בניינית אשדוד",
  description: `שכבות נספח העזר הגרפי לתשריט תכנית ${PLAN.number}: חזית פעילה, ציר מתע"ן, הפרשות לצורכי ציבור ותחומים להתחדשות עירונית.`,
};

const d = DEMOLISH_ADD_FLOORS;

export default function Page() {
  return (
    <div className="wrap section stack">
      <PageHead
        href={PAGE.sheet.href}
        kicker="נספח עזר גרפי לתשריט"
        title="מפת התשריט בשכבות"
        lead="לחיצה על המפה מציגה אילו שכבות של התכנית חלות במקום, ומה המשמעות למבנה."
      />

      <SheetClient />

      <div className="grid grid-2" style={{ marginTop: 8 }}>
        <section className="card stack">
          <div className="label">מי נכנס לתכנית</div>
          <h2 className="h3">מבנה טעון חיזוק</h2>
          <ul className="sheet-list">
            <li>היתר הבנייה ניתן לפני 1984</li>
            <li>אינו עומד בתקן לרעידות אדמה</li>
            <li>2 קומות לפחות, 4 יח&quot;ד ומעלה</li>
            <li>לפחות 70% משטחי הבנייה למגורים</li>
          </ul>
          <p className="muted sheet-small">מבנה שעומד בתקן אך חסר מיגון קומתי נכנס למסלול מיגון בלבד.</p>
        </section>

        <section className="card stack">
          <div className="label">השפעת השכבות על הזכויות</div>
          <h2 className="h3">תוספת קומות לפי מסלול</h2>
          <div className="sheet-tbl">
            <table>
              <thead>
                <tr>
                  <th>מסלול</th>
                  <th>רחבי העיר</th>
                  <th>חזית פעילה / ציר מתע&quot;ן</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>הריסה ובנייה (קיים 2 / 3 / 4-5 קומות)</td>
                  <td className="num">
                    +{d.cityWide["2"]} / +{d.cityWide["3"]} / +{d.cityWide["4-5"]}
                  </td>
                  <td className="num">
                    +{d.activeOrTransit["2"]} / +{d.activeOrTransit["3"]} / +{d.activeOrTransit["4-5"]}
                  </td>
                </tr>
                <tr>
                  <td>חיזוק, מיגון ותוספות</td>
                  <td className="num">+{RETROFIT_BASE_FULL_FLOORS} וגג חלקי</td>
                  <td className="num">+{RETROFIT_BASE_FULL_FLOORS + 1} וגג חלקי</td>
                </tr>
                <tr>
                  <td>מיגון ותוספות</td>
                  <td className="num">+{PROTECTION_BASE_FULL_FLOORS} וגג חלקי</td>
                  <td className="num">+{PROTECTION_BASE_FULL_FLOORS} וגג חלקי</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted sheet-small">
            התוספת ברחובות פעילים ובצירי מתע&quot;ן מותנית בשימושים פעילים בקומת הקרקע. בתחום הפרשות לצורכי ציבור:{" "}
            {PUBLIC_ALLOCATION.groundFloorPct}% מקומת הקרקע, לפחות {PUBLIC_ALLOCATION.minArea} מ&quot;ר ולא יותר מ־
            {PUBLIC_ALLOCATION.maxPctOfRights}% מהזכויות במגרש. תוספות לפי מצב הבניין מחושבות בבדיקת הכתובת. סעיפים:{" "}
            {SEC.table5}, {SEC.rules}.
          </p>
        </section>
      </div>

      <div className="row-gap">
        <Link href={PAGE.check.href} className="btn small">{PAGE.check.label}</Link>
        <Link href={PAGE.traffic.href} className="btn small ghost">{PAGE.traffic.label}</Link>
      </div>
      <p className="muted sheet-small">
        בדיקה גרפית על בסיס הנספח בלבד. {DISCLAIMER}
      </p>
    </div>
  );
}
