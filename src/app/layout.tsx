import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "OKX Journal",
  description: "개인 선물/주식 매매일지",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}