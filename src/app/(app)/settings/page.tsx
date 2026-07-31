import { SettingsView } from "./settings-view";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ qbo_connected?: string; qbo_error?: string }>;
}) {
  const params = await searchParams;
  return <SettingsView connected={params.qbo_connected === "1"} error={params.qbo_error} />;
}
