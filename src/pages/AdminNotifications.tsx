import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Check, CheckCheck, Loader2, ShoppingBag, AlertTriangle, Package, MessageSquare, Info } from "lucide-react";
import { useAdminNotifications, type AdminNotification, type AdminNotificationType } from "@/hooks/use-admin-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const typeMeta: Record<AdminNotificationType, { label: string; icon: typeof Bell; color: string }> = {
  new_order: { label: "Pedido", icon: ShoppingBag, color: "text-primary" },
  payment_confirmed: { label: "Pagamento", icon: ShoppingBag, color: "text-primary" },
  new_dispute: { label: "Devolução", icon: MessageSquare, color: "text-amber-600" },
  low_stock: { label: "Estoque baixo", icon: Package, color: "text-amber-600" },
  out_of_stock: { label: "Esgotado", icon: AlertTriangle, color: "text-destructive" },
  sla_breach: { label: "SLA", icon: AlertTriangle, color: "text-destructive" },
  system: { label: "Sistema", icon: Info, color: "text-muted-foreground" },
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { data, isLoading, unreadCount, markRead, markAllRead } = useAdminNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = useMemo(() => {
    if (filter === "unread") return data.filter((n) => !n.read_at);
    return data;
  }, [data, filter]);

  const handleClick = (n: AdminNotification) => {
    if (!n.read_at) markRead.mutate([n.id]);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar">
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg sm:text-xl flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notificações
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground" aria-label={`${unreadCount} não lidas`}>
                  {unreadCount}
                </Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {unreadCount === 0 ? "Tudo em dia" : `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
            className="gap-1"
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Marcar tudo como lido</span>
          </Button>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">Todas ({data.length})</TabsTrigger>
              <TabsTrigger value="unread">Não lidas ({unreadCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {filter === "unread" ? "Nenhuma notificação não lida." : "Sem novas notificações."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2" role="list">
            {filtered.map((n) => {
              const meta = typeMeta[n.type] ?? typeMeta.system;
              const Icon = meta.icon;
              const unread = !n.read_at;
              return (
                <li key={n.id}>
                  <div
                    className={cn(
                      "group rounded-lg border p-3 sm:p-4 transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer flex gap-3",
                      unread ? "bg-primary/5 border-primary/30" : "bg-card",
                    )}
                    onClick={() => handleClick(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick(n);
                      }
                    }}
                    aria-label={`${unread ? "Não lida: " : ""}${n.title}`}
                  >
                    <div className={cn("shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center", meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm flex items-center gap-2">
                            {n.title}
                            {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden />}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <Badge variant="outline" className="text-[10px] py-0 h-5">{meta.label}</Badge>
                        {unread && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); markRead.mutate([n.id]); }}
                          >
                            <Check className="h-3 w-3" /> Marcar como lida
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default AdminNotifications;
