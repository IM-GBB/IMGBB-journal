"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const items = [
    { href: "/", label: "OKX Journal", active: path === "/" || path.startsWith("/journal") },
    { href: "/trades", label: "Trade View", active: path.startsWith("/trades") },
    { href: "/reports", label: "Reports", active: path.startsWith("/reports") },
    { href: "/progress", label: "Progress", active: path.startsWith("/progress") },
    { href: "/strategies", label: "Strategies", active: path.startsWith("/strategies") },
    { href: "/stock", label: "Stock Journal", active: path.startsWith("/stock") },
  ];

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
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`mt-1 block rounded-lg px-3 py-2 text-sm first:mt-0 ${
                it.active ? "bg-[#e8edf4] text-[#0b0d10]" : "text-[#c5ccd6]"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </aside>
      ) : null}
      {children}
    </div>
  );
}