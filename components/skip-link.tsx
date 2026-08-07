"use client";

import { useLang } from "@/components/providers/language";

export function SkipLink() {
  const { t } = useLang();

  return (
    <a href="#main" className="skip-link">
      {t("common.skip")}
    </a>
  );
}
