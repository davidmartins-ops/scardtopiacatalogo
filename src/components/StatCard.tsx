import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accentClass?: string;
}

const StatCard = ({ title, value, subtitle, icon: Icon, accentClass = "text-primary" }: StatCardProps) => (
  <div className="glass-card glow-hover p-6 group">
    <div className="absolute inset-0 foil-shimmer rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-sm font-body text-muted-foreground">{title}</p>
        <p className={`mt-2 text-3xl font-display font-bold ${accentClass}`}>{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="rounded-xl bg-muted/50 p-3 border border-border/50 group-hover:border-primary/20 transition-colors duration-300">
        <Icon className={`h-5 w-5 ${accentClass}`} />
      </div>
    </div>
  </div>
);

export default StatCard;
