import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-start justify-between gap-4 px-7 md:px-10 pt-9 pb-7">
        <div>
          <Skeleton className="mb-2" style={{ width: 180, height: 22 }} />
          <Skeleton style={{ width: 220, height: 14 }} />
        </div>
        <Skeleton style={{ width: 110, height: 32, borderRadius: 20 }} />
      </header>
      <div className="flex-1 px-5 md:px-8 pb-10 space-y-7">
        <Skeleton style={{ height: 440, borderRadius: 12 }} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton style={{ height: 68 }} />
          <Skeleton style={{ height: 68 }} />
          <Skeleton style={{ height: 68 }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton style={{ height: 190, borderRadius: 12 }} />
          <Skeleton style={{ height: 190, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
