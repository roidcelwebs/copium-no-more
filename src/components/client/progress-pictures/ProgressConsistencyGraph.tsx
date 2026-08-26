import { Flame } from "lucide-react";
import {
  type ProgressPictureBatch,
  calculateProgressPictureConsistency,
} from "@/lib/progress-pictures";
import { Badge } from "@/components/ui/badge";

export function ProgressConsistencyGraph({
  batches,
}: {
  batches: readonly ProgressPictureBatch[];
}) {
  const consistency = calculateProgressPictureConsistency(batches);

  // Hidden for new users who have never uploaded a progress picture
  if (!consistency.hasUploadedAny) {
    return null;
  }

  // 7 horizontal grid levels (y-coordinates in SVG viewBox 0 0 320 110)
  // Level 0 (bottom floor) -> y = 98
  // Level 1 -> y = 84
  // Level 2 -> y = 70
  // Level 3 -> y = 56
  // Level 4 -> y = 42
  // Level 5 -> y = 28
  // Level 6 -> y = 16
  // Level 7 (top line) -> y = 6
  const getYForLevel = (level: number) => {
    const clamped = Math.max(0, Math.min(7, level));
    const levelYMap = [98, 84, 70, 56, 42, 28, 16, 6];
    return levelYMap[clamped];
  };

  const getXForIndex = (index: number) => {
    // 7 points spaced evenly across width 320 with 20px padding on left/right
    const startX = 20;
    const endX = 300;
    const step = (endX - startX) / 6;
    return startX + index * step;
  };

  const coords = consistency.points.map((p, idx) => ({
    x: getXForIndex(idx),
    y: getYForLevel(p.level),
  }));

  // Build SVG path using smooth cubic beziers
  let pathD = "";
  let areaD = "";
  if (coords.length > 0) {
    pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    areaD = `${pathD} L ${lastX} 102 L ${firstX} 102 Z`;
  }

  const latestCoord = coords[coords.length - 1];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[1.125rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {consistency.isStreakMode
              ? "Daily Progress Picture Streak"
              : "Progress Picture Consistency"}
          </h3>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">
            {consistency.isStreakMode
              ? "Keep uploading daily to maintain your active streak"
              : "Upload daily to level up"}
          </p>
        </div>

        {consistency.isStreakMode ? (
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E50910]/40 bg-[#E50910]/10 px-3 py-1.5">
            <Flame className="h-5 w-5 fill-[#E50910] text-[#E50910]" aria-hidden="true" />
            <span className="text-[1rem] font-bold tabular-nums text-[#E50910]">
              {consistency.streakDays} {consistency.streakDays === 1 ? "day" : "days"}
            </span>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="shrink-0 border-primary/40 bg-primary/10 text-primary text-[0.75rem] font-semibold"
          >
            Level {consistency.currentLevel} / 7
          </Badge>
        )}
      </div>

      {/* 7-Level Minimalist Graph */}
      <div className="relative mt-4 h-28 w-full overflow-hidden rounded-lg bg-black/40">
        <svg
          viewBox="0 0 320 110"
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="consistencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E50910" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#E50910" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* 7 Horizontal Reference Lines */}
          {[6, 16, 28, 42, 56, 70, 84, 98].map((yVal, i) => (
            <line
              key={i}
              x1="12"
              y1={yVal}
              x2="308"
              y2={yVal}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray={i === 0 || i === 7 ? "none" : "2 3"}
            />
          ))}

          {/* Shaded Area Under Curve */}
          {areaD && <path d={areaD} fill="url(#consistencyGradient)" />}

          {/* Netflix Red Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#E50910"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Level Data Dots */}
          {coords.map((coord, i) => (
            <circle
              key={i}
              cx={coord.x}
              cy={coord.y}
              r={i === coords.length - 1 ? "4.5" : "2.5"}
              fill={i === coords.length - 1 ? "#E50910" : "rgba(255, 255, 255, 0.35)"}
              stroke={i === coords.length - 1 ? "#ffffff" : "none"}
              strokeWidth="1.5"
            />
          ))}

          {/* Active Pulsing Dot on Latest Point */}
          {latestCoord && (
            <circle
              cx={latestCoord.x}
              cy={latestCoord.y}
              r="7"
              fill="none"
              stroke="#E50910"
              strokeWidth="1.5"
              opacity="0.6"
              className="animate-ping origin-center"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
