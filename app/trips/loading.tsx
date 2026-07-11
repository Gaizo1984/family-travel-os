import { Skeleton } from "@/components/Skeleton";

export default function TripsLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-14 max-w-4xl w-full mx-auto">
        <div className="pt-9 pb-7">
          <Skeleton className="mb-2" style={{ width: 180, height: 22 }} />
          <Skeleton style={{ width: 220, height: 14 }} />
        </div>
        <div className="flex gap-4 mb-11 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <Skeleton style={{ width: 60, height: 16 }} />
          <Skeleton style={{ width: 60, height: 16 }} />
          <Skeleton style={{ width: 60, height: 16 }} />
        </div>
        <div className="space-y-4">
          <Skeleton style={{ height: 420, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
