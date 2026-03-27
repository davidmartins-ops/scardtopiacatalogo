import { useMemo } from "react";
import { Package, DollarSign, Layers, Sparkles, Loader2, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import heroBanner from "@/assets/hero-banner.jpg";
import { useInventory } from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import InventoryTable from "@/components/InventoryTable";
import CategoryChart from "@/components/CategoryChart";
import AddItemDialog from "@/components/AddItemDialog";

const Index = () => {
  const { signOut } = useAuth();
  const { data: inventoryData = [], isLoading, error } = useInventory();

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
    <div className="min-h-screen bg-background font-body">
      {/* Hero */}
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        <div className="relative z-10 flex items-end justify-between h-full px-6 pb-6 max-w-full mx-auto">
          <div className="animate-fade-in">
            <img src={logo} alt="Spencer's Cardtopia" className="h-36 sm:h-44 drop-shadow-2xl" />
            <p className="mt-1 text-xs text-muted-foreground tracking-[0.25em] uppercase font-medium">Painel de Gerenciamento</p>
          </div>
          <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
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

      <div className="max-w-full mx-auto px-4 sm:px-6 -mt-4 relative z-20 space-y-6 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Chart + Table */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-in-up" style={{ animationDelay: '0.5s', opacity: 0 }}>
          <div className="xl:col-span-1">
            <CategoryChart data={inventoryData} />
          </div>
          <div className="xl:col-span-3">
            <InventoryTable data={inventoryData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
