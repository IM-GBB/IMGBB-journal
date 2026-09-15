import Link from "next/link";
import { daysInMonth, kstDateKey } from "@/lib/kst";

export default function Home() {
  const today = kstDateKey();
  const [y, m] = today.split("-").map(Number);
  const count = daysInMonth(y, m);
  const first = new Date(`${y}-${String(m).padStart(2, "0")}-01T12:00:00+09:00`);
  const pad = (first.getDay() + 6) % 7;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-[#8b95a5]">OKX Journal</p>
      <h1 className="mt-1 text-3xl font-semibold">
        {y}년 {m}월
      </h1>
      <p className="mt-2 text-sm text-[#8b95a5]">날짜를 열어 그 날만 동기화합니다. 오늘은 {today}.</p>
      <Link href={`/journal/${today}`} className="mt-4 inline-block rounded-lg bg-[#e8edf4] px-4 py-2 text-sm text-[#0b0d10]">
        오늘 표 열기
      </Link>
      <div className="mt-8 grid grid-cols-7 gap-2 text-center text-xs text-[#8b95a5]">
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
          <div key={d}>{d}</div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: count }).map((_, i) => {
          const day = String(i + 1).padStart(2, "0");
          const key = `${y}-${String(m).padStart(2, "0")}-${day}`;
          const isToday = key === today;
          return (
            <Link
              key={key}
              href={`/journal/${key}`}
              className={`rounded-lg border px-2 py-3 text-sm ${
                isToday ? "border-[#e8edf4] text-[#e8edf4]" : "border-[#2a313c] text-[#c5ccd6]"
              }`}
            >
              {i + 1}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
