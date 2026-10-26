import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <div className="space-y-4"><Skeleton className="h-9 w-56" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>;
}
