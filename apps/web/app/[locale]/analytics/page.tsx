import { DynamicPage } from "@/components/DynamicPage";

interface AnalyticsPageProps {
  params: {
    locale: string;
  };
}

export default function AnalyticsPage({ params }: AnalyticsPageProps): JSX.Element {
  return <DynamicPage locale={params.locale} route="/analytics" />;
}
