import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressPictureTile({
  imageUrl,
  alt,
  footer,
  className,
  imageClassName,
  eager = false,
}: {
  imageUrl?: string;
  alt: string;
  footer?: React.ReactNode;
  className?: string;
  imageClassName?: string;
  eager?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex aspect-[17/23] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={cn("h-full w-full object-cover", imageClassName)}
          />
        ) : (
          <div
            className="flex h-full min-h-20 items-center justify-center text-muted-foreground/70"
            role="img"
            aria-label={alt}
          >
            <ImageIcon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
        )}
      </div>
      {footer && <div className="shrink-0 border-t border-border bg-card p-2">{footer}</div>}
    </div>
  );
}
