import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { LayoutWrapper } from "@/components/shell/LayoutWrapper";
import { appConfig } from "@/lib/app-config";

export default async function LocaleLayout({
  children,
  params
}: Readonly<{ children: React.ReactNode; params: { locale: string } }>): Promise<JSX.Element> {
  const locale = appConfig.app.locales.includes(params.locale) ? params.locale : appConfig.app.locale;
  const messages = (await import(`../../messages/${locale}.json`)).default as Record<string, string>;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-background text-zinc-50">
        <LayoutWrapper locale={locale}>{children}</LayoutWrapper>
        <Toaster theme="dark" position="bottom-right" richColors />
      </div>
    </NextIntlClientProvider>
  );
}
