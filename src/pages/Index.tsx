import { useMemo } from "react";
import { Package, DollarSign, Layers, Sparkles, Loader2 } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";
import { useInventory } from "@/hooks/use-inventory";
import StatCard from "@/components/StatCard";
import InventoryTable from "@/components/InventoryTable";
import CategoryChart from "@/components/CategoryChart";

const Index = () => {
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
        <div className="relative z-10 flex items-end h-full px-6 pb-6 max-w-7xl mx-auto">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              Spencer's <span className="text-primary">Cardtopia</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">DROPS</p>
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
