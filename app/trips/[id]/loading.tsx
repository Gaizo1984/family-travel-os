import { Skeleton } from "@/components/Skeleton";

export default function TripDetailLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <Skeleton style={{ height: 450, borderRadius: 0 }} />
      <div className="px-5 md:px-8 py-8 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton style={{ height: 72, borderRadius: 10 }} />
          <Skeleton style={{ height: 72, borderRadius: 10 }} />
          <Skeleton style={{ height: 72, borderRadius: 10 }} />
          <Skeleton style={{ height: 72, borderRadius: 10 }} />
        </div>
        <Skeleton style={{ height: 200, borderRadius: 12 }} />
      </div>
    </div>
  );
}
