"use client";

import { useLang } from "@/components/providers/language";
import { languages } from "@/lib/i18n";

/* SR | EN. The whole page reads from the same provider, so a click here
   changes the copy everywhere at once. */
export function LanguageSwitcher({ tone = "ink" }: { tone?: "ink" | "night" }) {
  const { lang, setLang, t } = useLang();

  const idle = tone === "night" ? "text-night-ink/45" : "text-ink-muted";
  const active = tone === "night" ? "text-gold" : "text-accent";

  return (
    <div
      className="flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.24em]"
      role="group"
      aria-label={t("common.language")}
    >
      {languages.map((code, i) => (
        <span key={code} className="flex items-center gap-2">
          {i > 0 && <span className="h-3 w-px bg-line" aria-hidden="true" />}
          <button
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            className={`transition-colors duration-300 hover:text-accent ${
              lang === code ? active : idle
            }`}
          >
            {code}
          </button>
        </span>
      ))}
    </div>
  );
}
