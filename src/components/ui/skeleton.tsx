import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer relative overflow-hidden rounded-lg bg-muted/60",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
