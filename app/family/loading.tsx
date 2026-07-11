import { Skeleton } from "@/components/Skeleton";

export default function FamilyLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-16 max-w-4xl w-full mx-auto">
        <div className="pt-9 pb-7">
          <Skeleton className="mb-2" style={{ width: 160, height: 22 }} />
          <Skeleton style={{ width: 220, height: 14 }} />
        </div>
        <Skeleton className="mb-8" style={{ height: 220, borderRadius: 12 }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton style={{ height: 100, borderRadius: 12 }} />
          <Skeleton style={{ height: 100, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
