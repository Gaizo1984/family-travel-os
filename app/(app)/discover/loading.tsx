import { Skeleton } from "@/components/Skeleton";

export default function DiscoverLoading() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto w-full px-5 md:px-8 pb-20">
        <div className="pt-9 pb-7">
          <Skeleton className="mb-2" style={{ width: 160, height: 22 }} />
          <Skeleton style={{ width: 240, height: 14 }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton style={{ height: 160, borderRadius: 12 }} />
          <Skeleton style={{ height: 160, borderRadius: 12 }} />
          <Skeleton style={{ height: 160, borderRadius: 12 }} />
          <Skeleton style={{ height: 160, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
