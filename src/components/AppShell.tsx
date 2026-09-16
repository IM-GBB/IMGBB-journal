"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/", label: "Day View" },
    { href: "/notebook", label: "Notebook" },
    { href: "/progress", label: "Progress" },
    { href: "/stock", label: "Stock Journal" },
  ];

  function active(href: string) {
    if (href === "/") return path === "/" || path.startsWith("/journal");
    return path === href || path.startsWith(href);
  }

  return (
    <div className="min-h-dvh">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="menu"
        className="fixed left-3 top-3 z-40 rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-sm"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed left-0 top-0 z-40 h-full w-60 border-r border-[#e5e7eb] bg-white p-3 pt-14 shadow-xl">
            <div className="mb-3 px-3 text-sm font-semibold tracking-wide">IMGBB</div>
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`mb-1 block rounded-lg px-3 py-2 text-sm ${
                  active(it.href) ? "bg-[#efeaff] text-[#5b45e0]" : "text-[#374151] hover:bg-[#f3f4f6]"
                }`}
              >
                {it.label}
              </Link>
            ))}
          </aside>
        </>
      ) : null}

      <div className="pt-2">{children}</div>
    </div>
  );
}