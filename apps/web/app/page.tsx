import { redirect } from "next/navigation";
import { appConfig } from "@/lib/app-config";

export default function Home(): never {
  redirect(`/${appConfig.app.locale}/dashboard`);
}
