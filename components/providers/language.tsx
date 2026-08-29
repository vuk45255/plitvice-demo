"use client";

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  LANG_STORAGE_KEY,
  messages,
  resolveCaption,
  type Caption,
  type Lang,
  type MessageKey,
} from "@/lib/i18n";

/* The stored choice is the single source of truth, read the same way the theme
   is: as an external store rather than state copied into an effect. Serbian is
   what the server renders and what an unset visitor gets. */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  /* Another tab switching language should switch this one too. */
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Lang {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) === "en" ? "en" : "sr";
  } catch {
    return "sr";
  }
}

function getServerSnapshot(): Lang {
  return "sr";
}

function writeLang(next: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {}
  listeners.forEach((listener) => listener());
}

type LanguageValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  /* Plain string. A dictionary key, a sentence already resolved into both
     languages, or the club's own words straight off an event row — see
     `Caption` in lib/i18n.ts. Every existing call passes a key and is
     unaffected. */
  t: (value: Caption) => string;
  /* Same string, with *starred* words rendered as <em>. Emphasis is a thing the
     SITE does to its own copy, so this one still takes a key. */
  tRich: (key: MessageKey) => React.ReactNode;
};

const LanguageContext = createContext<LanguageValue>({
  lang: "sr",
  setLang: () => {},
  t: (value) => resolveCaption(value, "sr"),
  tRich: (key) => messages.sr[key],
});

export function useLang() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLang = useCallback((next: Lang) => writeLang(next), []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageValue>(() => {
    const t = (value: Caption) => resolveCaption(value, lang);

    const tRich = (key: MessageKey) =>
      /* Odd segments sit between the asterisks — those are the emphasis. */
      t(key)
        .split("*")
        .map((part, i) =>
          i % 2 === 1 ? (
            <em key={i}>{part}</em>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        );

    return { lang, setLang, t, tRich };
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
