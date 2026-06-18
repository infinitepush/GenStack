import { RuntimeSummary } from "@/components/summary/RuntimeSummary";

interface SummaryPageProps {
  params: {
    locale: string;
  };
}

export default function SummaryPage({ params }: SummaryPageProps): JSX.Element {
  return <RuntimeSummary locale={params.locale} />;
}
