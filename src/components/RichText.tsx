"use client";

import { useEffect, useRef, useState } from "react";

export function looksHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export function asHtml(s: string) {
  if (!s) return "";
  if (looksHtml(s)) return s;
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n/g, "<br/>");
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        let w = img.width;
        let h = img.height;
        if (w > max) {
          h = Math.round((h * max) / w);
          w = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function RichText({
  value,
  onChange,
  className = "",
  allowImages = false,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  allowImages?: boolean;
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

  async function addImage(file: File) {
    const src = await compressImage(file);
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.style.maxWidth = "160px";
    img.style.maxHeight = "120px";
    img.style.borderRadius = "8px";
    img.style.margin = "6px 6px 0 0";
    img.style.cursor = "pointer";
    ref.current?.appendChild(img);
    onChange(ref.current?.innerHTML || "");
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
        {allowImages ? (
          <label className="cursor-pointer rounded border border-[#e5e7eb] px-2 py-1">
            스크린샷
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addImage(f);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`min-h-24 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none ${className}`}
        onInput={() => onChange(ref.current?.innerHTML || "")}
        onPaste={(e) => {
          if (!allowImages) return;
          const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
          if (!file) return;
          e.preventDefault();
          void addImage(file);
        }}
      />
    </div>
  );
}

export function NoteHtml({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <>
      <div
        className={`[&_img]:mt-2 [&_img]:inline-block [&_img]:h-24 [&_img]:w-auto [&_img]:max-w-[180px] [&_img]:cursor-pointer [&_img]:rounded-lg [&_img]:object-cover [&_b]:font-bold [&_i]:italic [&_u]:underline ${className}`}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "IMG") setZoom((t as HTMLImageElement).src);
        }}
        dangerouslySetInnerHTML={{ __html: asHtml(html) }}
      />
      {zoom ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </div>
      ) : null}
    </>
  );
}
