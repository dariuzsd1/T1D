import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n/shared";
import { ThemeProvider } from "@/lib/theme";
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme/shared";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { QueryProvider } from "@/components/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "T1D Supply Hub",
  description: "Track your Type 1 Diabetes supplies, forecast refills, and stay ahead of shortages.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the saved language server-side so the first paint is already correct
  // (no English→French flash) and <html lang> matches the rendered content.
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get(LANG_COOKIE)?.value);
  // Same idea for theme: read it server-side so <html data-theme> is already
  // right on first paint (no light→dark flash). "system" sets no attribute at
  // all, leaving the OS-preference media query in globals.css in charge.
  const theme = normalizeTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang={lang}
      data-theme={theme === "system" ? undefined : theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes on <body> before React hydrates; this only silences that
          one-level attribute diff, not real mismatches in our own markup. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* ToastProvider lives at the root so accessible toasts work on EVERY
            route (scan, login, public pages), not just under the dashboard
            layout. The StarterKitModal's useToast() crashed on /scan before this. */}
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLang={lang}>
            <QueryProvider>
              <ToastProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </ToastProvider>
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
