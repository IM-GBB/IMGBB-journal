"use client";

import { useEffect, useRef } from "react";

export function looksHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export function asHtml(s: string) {
  if (!s) return "";
  if (looksHtml(s)) return s;
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

export function RichText({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  function cmd(name: string, arg?: string) {
    document.execCommand(name, false, arg);
    onChange(ref.current?.innerHTML || "");
    ref.current?.focus();
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">
        <button type="button" className="rounded border border-[#e5e7eb] px-2 py-1" onClick={() => cmd("bold")}>B</button>
        <button type="button" className="rounded border border-[#e5e7eb] px-2 py-1 italic" onClick={() => cmd("italic")}>I</button>
        <button type="button" className="rounded border border-[#e5e7eb] px-2 py-1 underline" onClick={() => cmd("underline")}>U</button>
        <button type="button" className="rounded border border-[#e5e7eb] px-2 py-1" onClick={() => cmd("fontSize", "2")}>작게</button>
        <button type="button" className="rounded border border-[#e5e7eb] px-2 py-1" onClick={() => cmd("fontSize", "3")}>보통</button>
        <button type="button" className="rounded border border-[#e5e7eb] px-2 py-1" onClick={() => cmd("fontSize", "5")}>크게</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`min-h-24 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none ${className}`}
        onInput={() => onChange(ref.current?.innerHTML || "")}
      />
    </div>
  );
}
