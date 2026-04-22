import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Package, DollarSign, Layers, Sparkles, Loader2, LogOut, Search, BarChart3, Image as ImageIcon, Shield, ShoppingBag } from "lucide-react";
import logo from "@/assets/logo.png";
import heroBanner from "@/assets/hero-banner.jpg";
import { useInventory } from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Index = () => {
  const { signOut } = useAuth();
  const { data: inventoryData = [], isLoading, error } = useInventory();

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
            <Link to="/catalogo">
              <img src={logo} alt="Spencer's Cardtopia" className="h-20 sm:h-28 md:h-36 lg:h-44 drop-shadow-2xl hover:scale-105 transition-transform cursor-pointer" />
            </Link>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground tracking-[0.25em] uppercase font-medium">Painel de Gerenciamento</p>
          </div>
          <div className="flex items-center gap-2 animate-fade-in flex-wrap justify-end" style={{ animationDelay: '0.2s' }}>
            <ScryfallSearchDialog />
            <AddItemDialog />
            <Button
              variant="outline"
              size="icon"
              onClick={signOut}
              className="glass-card hover:border-destructive/40 hover:text-destructive hover:shadow-lg hover:shadow-destructive/10 transition-all duration-300"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-3 sm:px-4 md:px-6 -mt-4 relative z-20 space-y-4 sm:space-y-6 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
            <StatCard title="Produtos Únicos" value={String(stats.uniqueProducts)} icon={Package} />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <StatCard title="Total em Estoque" value={String(stats.totalItems)} subtitle="unidades" icon={Layers} />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
            <StatCard
              title="Valor Total"
              value={`R$ ${stats.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
            <StatCard title="Itens Foil" value={String(stats.foilCount)} subtitle="unidades" icon={Sparkles} />
          </div>
        </div>

        {/* Chart + Tabs with Table */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 animate-fade-in-up" style={{ animationDelay: '0.5s', opacity: 0 }}>
          <div className="xl:col-span-1">
            <CategoryChart data={inventoryData} />
          </div>
          <div className="xl:col-span-3">
            <Tabs defaultValue="drops" className="w-full">
              <TabsList className="w-full max-w-lg mb-4 bg-muted/50 backdrop-blur-sm flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="drops" className="flex-1 font-display text-xs sm:text-sm">Drops ({drops.length})</TabsTrigger>
                <TabsTrigger value="singles" className="flex-1 font-display text-xs sm:text-sm">Singles ({singles.length})</TabsTrigger>
                <TabsTrigger value="banners" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <ImageIcon className="h-3.5 w-3.5" /> Banners
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Analytics
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex-1 font-display text-xs sm:text-sm gap-1">
                  <ShoppingBag className="h-3.5 w-3.5" /> Pedidos
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
              <TabsContent value="analytics">
                <div><AnalyticsDashboard /></div>
              </TabsContent>
              <TabsContent value="orders">
                <div><AdminOrdersPanel /></div>
              </TabsContent>
              <TabsContent value="admins">
                <div><AdminRolesManager /></div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
