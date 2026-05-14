import { DynamicPage } from "@/components/DynamicPage";

interface DashboardPageProps {
  params: {
    locale: string;
  };
}

export default function DashboardPage({ params }: DashboardPageProps): JSX.Element {
  return <DynamicPage locale={params.locale} route="/dashboard" />;
}
