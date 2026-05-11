import { getRequestConfig } from "next-intl/server";
import { appConfig } from "@/lib/app-config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && appConfig.app.locales.includes(requested) ? requested : appConfig.app.locale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default as Record<string, string>
  };
});
