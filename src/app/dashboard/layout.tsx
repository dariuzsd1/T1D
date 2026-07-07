import { AppNav } from "@/components/layout/AppNav";
import { RiskAlertBanner } from "@/components/layout/RiskAlertBanner";
import { QuickActionHub } from "@/components/dashboard/QuickActionHub";
import { PreferencesHydrator } from "@/components/PreferencesHydrator";
import { ProfileProvider } from "@/components/profile/ProfileProvider";
import { PreferenceSync } from "@/components/profile/PreferenceSync";
import { AutoDepleteSync } from "@/components/dashboard/AutoDepleteSync";

// ToastProvider now lives in the root layout (app/layout.tsx) so toasts work on
// every route; it's intentionally not duplicated here.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <PreferencesHydrator />
      <PreferenceSync />
      <AutoDepleteSync />
      <div className="flex flex-col min-h-screen bg-canvas text-ink">
        <RiskAlertBanner />
        <div className="flex flex-1">
          <AppNav />
          <main className="flex-1 overflow-y-auto">
            {/* pb-28 leaves room for the mobile bottom nav + FAB on small screens */}
            <div className="max-w-7xl mx-auto p-5 pb-28 sm:p-8 lg:p-12 lg:pb-12">
              {children}
            </div>
          </main>
        </div>
        <QuickActionHub />
      </div>
    </ProfileProvider>
  );
}
