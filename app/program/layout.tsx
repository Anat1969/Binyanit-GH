import "@fontsource/heebo/300.css";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/heebo/700.css";

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  return <div className="program-root">{children}</div>;
}
