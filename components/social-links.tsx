import { site } from "@/lib/site";

/* Instagram and Facebook, drawn the same way: one rounded frame, one mark
   inside, hairline weight. Same language as the rails and the button borders —
   nothing on the page shouts, and neither do these. */

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.1" cy="6.9" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M13.6 7.4v6.9a2.5 2.5 0 1 1-2.5-2.5" />
      <path d="M13.6 8.6a3.4 3.4 0 0 0 3 2.2" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M14.7 8.3h-1.2a1.9 1.9 0 0 0-1.9 1.9v1.7m0 0H9.8m1.8 0h2.4m-2.4 0v5.8" />
    </svg>
  );
}

type SocialLinksProps = {
  className?: string;
  /* Always-night sections need their own tone. */
  tone?: "ink" | "night";
};

export function SocialLinks({ className, tone = "ink" }: SocialLinksProps) {
  const base =
    tone === "night"
      ? "text-night-ink/60 hover:text-gold focus-visible:text-gold"
      : "text-ink-muted hover:text-accent focus-visible:text-accent";

  const links = [
    { href: site.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: site.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: site.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
  ];

  return (
    <ul className={`flex items-center gap-4 ${className ?? ""}`}>
      {links.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Plitvice na ${label}`}
            className={`block h-9 w-9 transition-[color,transform] duration-300 ease-out hover:-translate-y-0.5 ${base}`}
          >
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );
}
