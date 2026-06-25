import LandingPageContent from "../LandingPageContent";

export default function LocaleIndex({
  params
}: {
  params: { locale: string };
}): JSX.Element {
  return <LandingPageContent locale={params.locale} />;
}
