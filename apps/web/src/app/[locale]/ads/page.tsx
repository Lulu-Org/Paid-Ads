import { ADS_HOME } from "@/config/navigation";
import { redirect } from "@/i18n/navigation";

export default async function AdsIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: ADS_HOME, locale });
}
