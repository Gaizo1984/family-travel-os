import Link from "next/link";
import { Users, Compass, MessageSquare, BookOpenCheck, Images, ChevronRight, type LucideIcon } from "lucide-react";

interface MoreLink {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const MORE_LINKS: MoreLink[] = [
  { href: "/family", label: "Familie", description: "Reiseprofile & Vorlieben", Icon: Users },
  { href: "/discover", label: "Entdecken", description: "Ideen & Inspiration", Icon: Compass },
  { href: "/buchungsportal", label: "Buchungsportal", description: "Hotels, Flüge & Restaurants im Vergleich", Icon: BookOpenCheck },
  { href: "/memories", label: "Travel Memory", description: "Eure gemeinsame Reisegalerie", Icon: Images },
  { href: "/concierge", label: "Concierge", description: "Persönliche Reiseberatung", Icon: MessageSquare },
];

export default function MehrPage() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-16 max-w-4xl w-full mx-auto">
        <header className="pt-9 pb-9">
          <h1
            className="text-2xl font-light mb-1"
            style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
          >
            Mehr
          </h1>
          <p
            className="text-xs"
            style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}
          >
            Weitere Bereiche von Family Travel OS
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {MORE_LINKS.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-xl px-5 py-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center justify-center shrink-0 rounded-full"
                style={{ width: "40px", height: "40px", background: "var(--accent-subtle)" }}
              >
                <Icon size={18} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{label}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.72rem", letterSpacing: "0.02em" }}>
                  {description}
                </div>
              </div>
              <ChevronRight size={16} strokeWidth={1.5} style={{ color: "var(--muted)", flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
