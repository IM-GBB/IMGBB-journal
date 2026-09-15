import { notFound } from "next/navigation";
import DayJournal from "@/components/DayJournal";
import { isValidDateKey } from "@/lib/kst";

export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateKey(date)) notFound();
  return <DayJournal date={date} />;
}
