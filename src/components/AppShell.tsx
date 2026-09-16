"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const stock = path.startsWith("/stock");
  const reports = path.startsWith("/reports");

  return (
    <div className="min-h-dvh">
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-30 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
      >
        {open ? "메뉴 닫기" : "메뉴"}
      </button>

      {open ? (
        <aside className="fixed left-3 top-14 z-30 w-52 rounded-xl border border-[#2a313c] bg-[#14181e] p-2">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm ${!stock && !reports ? "bg-[#e8edf4] text-[#0b0d10]" : "text-[#c5ccd6]"}`}
          >
            OKX Journal
          </Link>
          <Link
            href="/reports"
            onClick={() => setOpen(false)}
            className={`mt-1 block rounded-lg px-3 py-2 text-sm ${reports ? "bg-[#e8edf4] text-[#0b0d10]" : "text-[#c5ccd6]"}`}
          >
            Reports
          </Link>
          <Link
            href="/stock"
            onClick={() => setOpen(false)}
            className={`mt-1 block rounded-lg px-3 py-2 text-sm ${stock ? "bg-[#e8edf4] text-[#0b0d10]" : "text-[#c5ccd6]"}`}
          >
            Stock Journal
          </Link>
        </aside>
      ) : null}

      {children}
    </div>
  );
}