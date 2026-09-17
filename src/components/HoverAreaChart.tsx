"use client";

import { useId, useMemo, useState } from "react";
import { money } from "@/lib/format";

type Pt = { label: string; value: number };

function niceStep(span: number) {
  const raw = span / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function niceTicks(min: number, max: number) {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  const step = niceStep(hi - lo || 1);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.01; v += step) ticks.push(Number(v.toFixed(8)));
  return { ticks, min: start, max: end };
}

function lab(v: number) {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1000000) return `${sign}$${(a / 1000000).toFixed(a >= 10000000 ? 0 : 1)}m`;
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

export default function HoverAreaChart({
  points,
  baseline = 0,
  height = 160,
}: {
  points: Pt[];
  baseline?: number;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const w = 400;
  const h = height;
  const pad = 10;

  const layout = useMemo(() => {
    if (!points.length) return null;
    const rawMin = Math.min(baseline, ...points.map((p) => p.value));
    const rawMax = Math.max(baseline, ...points.map((p) => p.value));
    const { ticks, min, max } = niceTicks(rawMin, rawMax);
    const span = Math.max(1e-9, max - min);
    const coords = points.map((p, i) => {
      const x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
      const y = pad + ((max - p.value) / span) * (h - pad * 2);
      return { ...p, x, y };
    });
    const zeroY = pad + ((max - baseline) / span) * (h - pad * 2);
    const line = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area = `${line} L${coords[coords.length - 1].x},${zeroY} L${coords[0].x},${zeroY} Z`;
    return {
      coords,
      zeroY,
      line,
      area,
      ticks: ticks.map((v) => ({ v, y: pad + ((max - v) / span) * (h - pad * 2) })),
    };
  }, [points, baseline, h]);

  if (!layout) return <p className="py-8 text-center text-sm text-[#6b7280]">no data</p>;
  const hi = hover == null ? null : layout.coords[hover];

  return (
    <div className="flex items-stretch gap-2">
      <div className="relative w-14 shrink-0 text-right text-xs font-semibold text-[#4b5563]" style={{ height }}>
        {layout.ticks.map((t) => (
          <div key={t.v} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: t.y }}>
            {lab(t.v)}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          style={{ height, width: "100%" }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - box.left) / box.width) * w;
            let best = 0;
            let dist = Infinity;
            layout.coords.forEach((p, i) => {
              const d = Math.abs(p.x - x);
              if (d < dist) {
                dist = d;
                best = i;
              }
            });
            setHover(best);
          }}
        >
          <defs>
            <linearGradient id={`${uid}up`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`${uid}dn`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={`${uid}a`}>
              <rect x="0" y="0" width={w} height={Math.max(0, layout.zeroY)} />
            </clipPath>
            <clipPath id={`${uid}b`}>
              <rect x="0" y={layout.zeroY} width={w} height={Math.max(0, h - layout.zeroY)} />
            </clipPath>
          </defs>
          {layout.ticks.map((t) => (
            <line key={t.v} x1={0} y1={t.y} x2={w} y2={t.y} stroke="#f3f4f6" />
          ))}
          <path d={layout.area} fill={`url(#${uid}up)`} clipPath={`url(#${uid}a)`} />
          <path d={layout.area} fill={`url(#${uid}dn)`} clipPath={`url(#${uid}b)`} />
          <path d={layout.line} fill="none" stroke="#6d5cff" strokeWidth="2.2" />
          {hi ? (
            <>
              <line x1={hi.x} y1={pad} x2={hi.x} y2={h - pad} stroke="#d1d5db" strokeDasharray="3 3" />
              <circle cx={hi.x} cy={hi.y} r="3.5" fill="#6d5cff" />
            </>
          ) : null}
        </svg>
        {hi ? (
          <div className="pointer-events-none absolute right-1 top-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs shadow-sm">
            <div className="text-[#6b7280]">{hi.label}</div>
            <div className="font-medium">{money(hi.value)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}