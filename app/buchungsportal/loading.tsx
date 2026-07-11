import { Skeleton } from "@/components/Skeleton";

export default function BuchungsportalLoading() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 pt-9">
        <Skeleton className="mb-2" style={{ width: 160, height: 22 }} />
        <Skeleton className="mb-8" style={{ width: 280, height: 14 }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton style={{ height: 220, borderRadius: 12 }} />
          <Skeleton style={{ height: 220, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
