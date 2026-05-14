import { redirect } from "next/navigation";
import { appConfig } from "@/lib/app-config";

export default function LocaleIndex(): never {
  redirect(`/${appConfig.app.locale}/ai`);
}
