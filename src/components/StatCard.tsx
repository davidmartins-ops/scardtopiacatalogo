import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accentClass?: string;
}

const StatCard = ({ title, value, subtitle, icon: Icon, accentClass = "text-primary" }: StatCardProps) => (
  <div className="glass-card glow-hover p-3 sm:p-4 md:p-6 group">
    <div className="absolute inset-0 foil-shimmer rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    <div className="relative flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-xs md:text-sm font-body text-muted-foreground truncate">{title}</p>
        <p className={`mt-1 sm:mt-2 text-lg sm:text-xl md:text-2xl lg:text-3xl font-display font-bold ${accentClass} truncate`}>{value}</p>
        {subtitle && <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="rounded-lg sm:rounded-xl bg-muted/50 p-2 sm:p-3 border border-border/50 group-hover:border-primary/20 transition-colors duration-300 shrink-0">
        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${accentClass}`} />
      </div>
    </div>
  </div>
);

export default StatCard;
