import { DynamicPage } from "@/components/DynamicPage";

interface RuntimePageProps {
  params: {
    locale: string;
    runtime: string[];
  };
}

export default function RuntimePage({ params }: RuntimePageProps): JSX.Element {
  return <DynamicPage locale={params.locale} route={`/${params.runtime.join("/")}`} />;
}
