import { AppNav } from "@/components/layout/AppNav";
import { RiskAlertBanner } from "@/components/layout/RiskAlertBanner";
import { QuickActionHub } from "@/components/dashboard/QuickActionHub";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex flex-col min-h-screen bg-[#050505] text-white">
        <RiskAlertBanner />
        <div className="flex flex-1">
          <AppNav />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-8 lg:p-12">
              {children}
            </div>
          </main>
        </div>
        <QuickActionHub />
      </div>
    </ToastProvider>
  );
}
