import { Skeleton } from "@/components/Skeleton";

export default function TodayLoading() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9 w-full">
        <Skeleton className="mb-2" style={{ width: 140, height: 14 }} />
        <Skeleton className="mb-6" style={{ width: 220, height: 24 }} />
        <div className="space-y-3">
          <Skeleton style={{ height: 90, borderRadius: 12 }} />
          <Skeleton style={{ height: 90, borderRadius: 12 }} />
          <Skeleton style={{ height: 90, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
