import useSEO from "@/hooks/use-seo";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useSpecialOrders, SPECIAL_ORDER_STATUS_LABELS } from "@/hooks/use-special-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ShoppingBag, Plus, ChevronRight, Package } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const statusBadgeVariant: Record<string, string> = {
  requested: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  quoted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  approved: "bg-green-500/10 text-green-500 border-green-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  ordered: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  received: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  shipped: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const CustomerSpecialOrders = () => {
  useSEO({ title: "Minhas encomendas", canonical: "https://www.spencerscardtopia.com.br/conta/encomendas", noindex: true });
  const navigate = useNavigate();
  const { user, loading } = useCustomerAuth();
  const { orders, isLoading } = useSpecialOrders();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    navigate("/conta/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/conta" className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Minha conta
          </Link>
          <Link to="/encomendas"><img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" /></Link>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: '0.05em' }}>
            <span className="text-gradient">Minhas Encomendas</span>
          </h1>
          <Link to="/conta/encomendas/nova">
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma encomenda ainda.</p>
            <Link to="/conta/encomendas/nova"><Button variant="outline" className="mt-4 gap-1"><Plus className="h-4 w-4" /> Solicitar encomenda</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link to={`/conta/encomendas/${order.id}`} key={order.id} className="glass-card p-4 block hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={statusBadgeVariant[order.status] || ""}>
                      {SPECIAL_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary font-display">
                      R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Status: {SPECIAL_ORDER_STATUS_LABELS[order.status]} — total estimado sujeito à cotação final.
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSpecialOrders;
