import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accentClass?: string;
}

const StatCard = ({ title, value, subtitle, icon: Icon, accentClass = "text-primary" }: StatCardProps) => (
  <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 group">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-sm font-body text-muted-foreground">{title}</p>
        <p className={`mt-2 text-3xl font-display font-bold ${accentClass}`}>{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="rounded-lg bg-muted p-3">
        <Icon className={`h-5 w-5 ${accentClass}`} />
      </div>
    </div>
  </div>
);

export default StatCard;
