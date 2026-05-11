import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { Sidebar } from "@/components/shell/Sidebar";
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
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
          <Sidebar locale={locale} />
          <main className="min-w-0 px-5 py-6 lg:px-8">{children}</main>
        </div>
        <Toaster theme="dark" position="bottom-right" richColors />
      </div>
    </NextIntlClientProvider>
  );
}
