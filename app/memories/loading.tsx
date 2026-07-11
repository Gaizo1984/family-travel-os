import { Skeleton } from "@/components/Skeleton";

export default function MemoriesLoading() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">
        <Skeleton className="mb-2" style={{ width: 160, height: 22 }} />
        <Skeleton className="mb-8" style={{ width: 260, height: 14 }} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} style={{ aspectRatio: "1/1", borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
