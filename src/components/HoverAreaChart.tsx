"use client";

import { useId, useMemo, useState } from "react";
import { money } from "@/lib/format";

type Pt = { label: string; value: number };

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
  const w = 640;
  const h = height;
  const left = 52;
  const pad = 10;

  const layout = useMemo(() => {
    if (!points.length) return null;
    const min = Math.min(baseline, ...points.map((p) => p.value));
    const max = Math.max(baseline, ...points.map((p) => p.value));
    const span = Math.max(1e-9, max - min);
    const coords = points.map((p, i) => {
      const x = left + (i / Math.max(points.length - 1, 1)) * (w - left - pad);
      const y = pad + ((max - p.value) / span) * (h - pad * 2);
      return { ...p, x, y };
    });
    const zeroY = pad + ((max - baseline) / span) * (h - pad * 2);
    const line = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area = `${line} L${coords[coords.length - 1].x},${zeroY} L${coords[0].x},${zeroY} Z`;
    const ticks = [max, (max + baseline) / 2, baseline, (min + baseline) / 2, min]
      .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < span * 0.02) === i)
      .map((v) => ({ v, y: pad + ((max - v) / span) * (h - pad * 2) }));
    return { coords, zeroY, line, area, ticks, min, max };
  }, [points, baseline, h]);

  if (!layout) return <p className="py-8 text-center text-sm text-[#6b7280]">no data</p>;

  const hi = hover == null ? null : layout.coords[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full"
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
          <g key={t.v}>
            <line x1={left} y1={t.y} x2={w} y2={t.y} stroke="#f3f4f6" />
            <text x={4} y={t.y + 4} fontSize="10" fill="#9ca3af">
              {Math.abs(t.v) >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
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
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs shadow-sm">
          <div className="text-[#6b7280]">{hi.label}</div>
          <div className="font-medium">{money(hi.value)}</div>
        </div>
      ) : null}
    </div>
  );
}