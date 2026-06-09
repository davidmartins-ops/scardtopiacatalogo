import useSEO from "@/hooks/use-seo";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, DollarSign, Layers, Sparkles, Loader2, LogOut, Search, BarChart3, Image as ImageIcon, Shield, ShoppingBag, ClipboardList, TrendingUp, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import heroBanner from "@/assets/hero-banner.jpg";
import { useInventory } from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import InventoryTable from "@/components/InventoryTable";
import CategoryChart from "@/components/CategoryChart";
import AddItemDialog from "@/components/AddItemDialog";
import ScryfallSearchDialog from "@/components/ScryfallSearchDialog";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import BannerManager from "@/components/BannerManager";
import AdminRolesManager from "@/components/AdminRolesManager";
import AdminOrdersPanel from "@/components/AdminOrdersPanel";
import AdminDisputesPanel from "@/components/AdminDisputesPanel";
import InventoryAuditPanel from "@/components/InventoryAuditPanel";
import SalesDashboard from "@/components/SalesDashboard";
import OrderAuditPanel from "@/components/OrderAuditPanel";
import SlaRulesPanel from "@/components/SlaRulesPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Index = () => {
  useSEO({ title: "Painel administrativo", canonical: "https://www.spencerscardtopia.com.br/admin", noindex: true });
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: inventoryData = [], isLoading, error } = useInventory();
  const { unreadCount: notifUnread } = useAdminNotifications();
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Live count of orders awaiting action (pending_payment + payment_confirmed)
  useEffect(() => {
    let mounted = true;
    const fetchPending = async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_payment", "payment_confirmed"]);
      if (mounted) setPendingCount(count ?? 0);
    };
    fetchPending();
    const channel = supabase
      .channel("admin-pending-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        fetchPending();
        if (payload.eventType === "INSERT") {
          const total = Number((payload.new as any)?.total ?? 0);
          toast.success(`🛒 Novo pedido — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, { duration: 6000 });
        }
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const drops = useMemo(() => inventoryData.filter((i) => (i.product_type ?? "drop") === "drop"), [inventoryData]);
  const singles = useMemo(() => inventoryData.filter((i) => i.product_type === "single"), [inventoryData]);

  const stats = useMemo(() => {
    const totalItems = inventoryData.reduce((s, i) => s + i.quantity, 0);
    const totalValue = inventoryData.reduce((s, i) => s + i.price * i.quantity, 0);
    const uniqueProducts = inventoryData.length;
    const foilCount = inventoryData.filter((i) => i.description === "Foil").reduce((s, i) => s + i.quantity, 0);
    return { totalItems, totalValue, uniqueProducts, foilCount };
  }, [inventoryData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive font-body">Erro ao carregar inventário.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      {/* Hero */}
      <div className="relative h-40 sm:h-48 md:h-56 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        <div className="relative z-10 flex items-end justify-between h-full px-4 sm:px-6 pb-4 sm:pb-6 max-w-full mx-auto">
          <div className="animate-fade-in shrink-0">
            <Link to="/">
              <img src={logo} alt="Spencer's Cardtopia" className="h-20 sm:h-28 md:h-36 lg:h-44 drop-shadow-2xl hover:scale-105 transition-transform cursor-pointer" />
            </Link>
            <h1 className="sr-only">Painel de Gerenciamento — Spencer's Cardtopia</h1>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground tracking-[0.25em] uppercase font-medium" aria-hidden="true">Painel de Gerenciamento</p>
          </div>
          <div className="flex items-center gap-2 animate-fade-in flex-wrap justify-end" style={{ animationDelay: '0.2s' }}>
            <ScryfallSearchDialog />
            <AddItemDialog />
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="glass-card hover:border-primary/40 hover:text-primary transition-all duration-300"
                title={`${notifUnread} notificação(ões) não lida(s)`}
                aria-label={`${notifUnread} notificações não lidas`}
                onClick={() => navigate("/admin/notificacoes")}
              >
                <Bell className="h-4 w-4" />
              </Button>
              {notifUnread > 0 && (
                <Badge
                  role="status"
                  aria-live="polite"
                  className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full text-[10px] bg-primary text-primary-foreground border-2 border-background"
                >
                  {notifUnread > 99 ? "99+" : notifUnread}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={signOut}
              className="glass-card hover:border-destructive/40 hover:text-destructive hover:shadow-lg hover:shadow-destructive/10 transition-all duration-300"
              title="Sair"
              aria-label="Sair da conta"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Sair</span>
            </Button>
          </div>
        </div>
      </div>

      <main id="main-content" className="max-w-full mx-auto px-3 sm:px-4 md:px-6 -mt-4 relative z-20 space-y-4 sm:space-y-6 pb-12">
        {/* Stats */}
        <section aria-labelledby="dashboard-stats-heading">
          <h2 id="dashboard-stats-heading" className="sr-only">Estatísticas gerais</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
            <StatCard title="Produtos Únicos" value={String(stats.uniqueProducts)} subtitle="itens" icon={Package} />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <StatCard title="Total em Estoque" value={String(stats.totalItems)} subtitle="unidades" icon={Layers} />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
            <StatCard
              title="Valor Total"
              value={`R$ ${stats.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              subtitle="em estoque"
              icon={DollarSign}
            />

          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
            <StatCard title="Itens Foil" value={String(stats.foilCount)} subtitle="unidades" icon={Sparkles} />
          </div>
          </div>
        </section>

        {/* Chart + Tabs with Table */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 animate-fade-in-up" style={{ animationDelay: '0.5s', opacity: 0 }}>
          <section className="xl:col-span-1" aria-labelledby="dashboard-categories-heading">
            <h2 id="dashboard-categories-heading" className="sr-only">Distribuição por categoria</h2>
            <CategoryChart data={inventoryData} />
          </section>
          <section className="xl:col-span-3" aria-labelledby="dashboard-inventory-heading">
            <h2 id="dashboard-inventory-heading" className="sr-only">Inventário e gestão</h2>
            <Tabs defaultValue="drops" className="w-full">
              <TabsList className="w-full mb-4 bg-muted/50 backdrop-blur-sm flex flex-wrap h-auto gap-1 p-1 justify-start">
                <TabsTrigger value="drops" className="flex-1 font-display text-xs sm:text-sm">Drops ({drops.length})</TabsTrigger>
                <TabsTrigger value="singles" className="flex-1 font-display text-xs sm:text-sm">Singles ({singles.length})</TabsTrigger>
                <TabsTrigger value="banners" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <ImageIcon className="h-3.5 w-3.5" /> Banners
                </TabsTrigger>
                <TabsTrigger value="sales" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Vendas
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Analytics
                </TabsTrigger>
                <TabsTrigger value="orders" data-tab-orders className="flex-1 font-display text-xs sm:text-sm gap-1 relative">
                  <ShoppingBag className="h-3.5 w-3.5" /> Pedidos
                  {pendingCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] bg-primary text-primary-foreground">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="disputes" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <ShoppingBag className="h-3.5 w-3.5" /> Devoluções
                </TabsTrigger>
                <TabsTrigger value="audit" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> Auditoria
                </TabsTrigger>
                <TabsTrigger value="order-audit" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> Hist. Pedidos
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex-1 font-display text-xs sm:text-sm gap-1" asChild>
                  <Link to="/admin/relatorios"><ClipboardList className="h-3.5 w-3.5" /> Relatórios</Link>
                </TabsTrigger>
                <TabsTrigger value="admins" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <Shield className="h-3.5 w-3.5" /> Admins
                </TabsTrigger>
              </TabsList>

              <TabsContent value="drops">
                <div><InventoryTable data={drops} /></div>
              </TabsContent>
              <TabsContent value="singles">
                <div><InventoryTable data={singles} /></div>
              </TabsContent>
              <TabsContent value="banners">
                <div><BannerManager /></div>
              </TabsContent>
              <TabsContent value="sales">
                <div><SalesDashboard /></div>
              </TabsContent>
              <TabsContent value="analytics">
                <div><AnalyticsDashboard /></div>
              </TabsContent>
              <TabsContent value="orders">
                <div><AdminOrdersPanel /></div>
              </TabsContent>
              <TabsContent value="disputes">
                <div><AdminDisputesPanel /></div>
              </TabsContent>
              <TabsContent value="audit">
                <div><InventoryAuditPanel /></div>
              </TabsContent>
              <TabsContent value="order-audit">
                <div className="space-y-4">
                  <SlaRulesPanel />
                  <OrderAuditPanel />
                </div>
              </TabsContent>
              <TabsContent value="admins">
                <div><AdminRolesManager /></div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
