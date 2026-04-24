import { Badge } from "@/components/ui/badge";
import { Clock, CreditCard, Wrench, Truck, CheckCircle2, XCircle, Package } from "lucide-react";
import type { OrderStatus } from "@/hooks/use-orders";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  payment_confirmed: "Pagamento confirmado",
  preparing: "Em preparação",
  shipped: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_ICONS: Record<OrderStatus, typeof Package> = {
  pending_payment: Clock,
  payment_confirmed: CreditCard,
  preparing: Wrench,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  pending_payment: "bg-muted text-muted-foreground border-border",
  payment_confirmed: "bg-primary/10 text-primary border-primary/30",
  preparing: "bg-accent/10 text-accent border-accent/30",
  shipped: "bg-accent/10 text-accent border-accent/30",
  delivered: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export const OrderStatusBadge = ({ status, className = "" }: { status: OrderStatus; className?: string }) => {
  const Icon = ORDER_STATUS_ICONS[status] ?? Package;
  const label = ORDER_STATUS_LABELS[status] ?? status;
  const cls = ORDER_STATUS_CLASSES[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`gap-1 ${cls} ${className}`}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
};
