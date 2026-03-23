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
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        <div className="relative z-10 flex items-end justify-between h-full px-6 pb-6 max-w-7xl mx-auto">
          <div>
            <img src={logo} alt="Spencer's Cardtopia" className="h-40 sm:h-48" />
            <p className="mt-1 text-sm text-muted-foreground">DROPS</p>
          </div>
          <div className="flex items-center gap-3">
            <AddItemDialog />
            <Button
              variant="outline"
              size="icon"
              onClick={signOut}
              className="border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 space-y-6 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Produtos Únicos" value={String(stats.uniqueProducts)} icon={Package} />
          <StatCard title="Total em Estoque" value={String(stats.totalItems)} subtitle="unidades" icon={Layers} />
          <StatCard
            title="Valor Total"
            value={`R$ ${stats.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
          />
          <StatCard title="Itens Foil" value={String(stats.foilCount)} subtitle="unidades" icon={Sparkles} />
        </div>

        {/* Chart + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <CategoryChart data={inventoryData} />
          </div>
          <div className="lg:col-span-2">
            <InventoryTable data={inventoryData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
