import { DynamicPage } from "@/components/DynamicPage";

interface RuntimePageProps {
  params: {
    runtime: string[];
  };
}

export default function RuntimePage({ params }: RuntimePageProps): JSX.Element {
  return <DynamicPage route={`/${params.runtime.join("/")}`} />;
}
