import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OKX Journal",
  description: "개인 선물 매매일지",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
