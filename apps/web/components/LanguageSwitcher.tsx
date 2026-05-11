"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { appConfig } from "@/lib/app-config";

const localeNames: Record<string, string> = {
  en: "EN",
  hi: "HI",
  fr: "FR"
};

const localeFlags: Record<string, string> = {
  en: "US",
  hi: "IN",
  fr: "FR"
};

export function LanguageSwitcher(): JSX.Element {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();

  const switchLocale = (nextLocale: string): void => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      router.push(`/${nextLocale}`);
    } else {
      segments[0] = nextLocale;
      router.push(`/${segments.join("/")}`);
    }
    window.localStorage.setItem("genstack-locale", nextLocale);
  };

  return (
    <label className="block">
      <span className="sr-only">{t("nav_system")}</span>
      <select
        value={locale}
        onChange={(event) => switchLocale(event.target.value)}
        className="w-full rounded-md border border-line bg-black/40 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-electric"
      >
        {appConfig.app.locales.map((item) => (
          <option value={item} key={item}>
            {localeNames[item] ?? item.toUpperCase()} {localeFlags[item] ?? ""}
          </option>
        ))}
      </select>
    </label>
  );
}
