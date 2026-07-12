import { Skeleton } from "@/components/Skeleton";

export default function ConciergeLoading() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        <Skeleton className="mb-2" style={{ width: 200, height: 22 }} />
        <Skeleton className="mb-8" style={{ width: 240, height: 14 }} />
        <div className="space-y-3">
          <Skeleton style={{ height: 100, borderRadius: 12 }} />
          <Skeleton style={{ height: 100, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
