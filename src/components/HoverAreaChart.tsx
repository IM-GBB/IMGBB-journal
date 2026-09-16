"use client";

import { useMemo, useState } from "react";

type Pt = { label: string; value: number };

function fmt(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function HoverAreaChart({
  points,
  baseline = 0,
}: {
  points: Pt[];
  baseline?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = 180;
  const pad = 12;

  const layout = useMemo(() => {
    if (!points.length) return null;
    const min = Math.min(baseline, ...points.map((p) => p.value));
    const max = Math.max(baseline, ...points.map((p) => p.value));
    const span = Math.max(1e-9, max - min);
    const coords = points.map((p, i) => {
      const x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
      return { ...p, x, y };
    });
    const zeroY = h - pad - ((baseline - min) / span) * (h - pad * 2);
    const line = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area = `${line} L${coords[coords.length - 1].x},${zeroY} L${coords[0].x},${zeroY} Z`;
    const last = coords[coords.length - 1].value;
    return { coords, zeroY, line, area, last };
  }, [points, baseline]);

  if (!layout) {
    return <p className="py-10 text-center text-sm text-[#8b95a5]">no data</p>;
  }

  const hi = hover == null ? null : layout.coords[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-44 w-full"
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
          <linearGradient id="eqUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3dd68c" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3dd68c" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="eqDn" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f07178" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f07178" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="eqAbove">
            <rect x="0" y="0" width={w} height={Math.max(0, layout.zeroY)} />
          </clipPath>
          <clipPath id="eqBelow">
            <rect x="0" y={layout.zeroY} width={w} height={Math.max(0, h - layout.zeroY)} />
          </clipPath>
        </defs>
        <line x1="0" y1={layout.zeroY} x2={w} y2={layout.zeroY} stroke="#2a313c" />
        <path d={layout.area} fill="url(#eqUp)" clipPath="url(#eqAbove)" />
        <path d={layout.area} fill="url(#eqDn)" clipPath="url(#eqBelow)" />
        <path
          d={layout.line}
          fill="none"
          stroke={layout.last >= baseline ? "#3dd68c" : "#f07178"}
          strokeWidth="2"
        />
        {hi ? (
          <>
            <line x1={hi.x} y1={pad} x2={hi.x} y2={h - pad} stroke="#8b95a5" strokeDasharray="3 3" />
            <circle cx={hi.x} cy={hi.y} r="3.5" fill="#e8edf4" />
          </>
        ) : null}
      </svg>
      {hi ? (
        <div className="pointer-events-none absolute left-3 top-2 rounded-md border border-[#2a313c] bg-[#0b0d10] px-2 py-1 text-xs">
          <div className="text-[#8b95a5]">{hi.label}</div>
          <div className={hi.value >= baseline ? "text-[#3dd68c]" : "text-[#f07178]"}>{fmt(hi.value)}</div>
        </div>
      ) : null}
    </div>
  );
}