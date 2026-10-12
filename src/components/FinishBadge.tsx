import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { finishLabel, finishMeta } from "@/lib/finish";

/** Full badge with icon — used on order detail pages. */
export const FinishBadge = ({ value, className = "" }: { value?: string | null; className?: string }) => {
  const label = finishLabel(value);
  if (!label) return null;
  const meta = finishMeta(value);
  const Icon = meta?.icon ?? Circle;
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-[10px] font-medium ${meta?.className ?? "bg-muted/40 text-muted-foreground border-border"} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
};

/** Compact colored text — used inside dense order item rows. */
export const FinishText = ({ value, className = "" }: { value?: string | null; className?: string }) => {
  const label = finishLabel(value);
  if (!label) return null;
  const meta = finishMeta(value);
  return (
    <span className={`shrink-0 font-medium ${meta?.textClass ?? "text-muted-foreground"} ${className}`}>
      {label}
    </span>
  );
};
