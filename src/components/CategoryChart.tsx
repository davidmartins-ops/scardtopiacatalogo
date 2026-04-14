import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { type InventoryItem } from "@/data/inventory";

const COLORS = [
  "hsl(43, 74%, 49%)",
  "hsl(30, 80%, 55%)",
  "hsl(50, 70%, 45%)",
  "hsl(20, 65%, 50%)",
  "hsl(40, 60%, 40%)",
  "hsl(35, 75%, 55%)",
];

const CategoryChart = ({ data }: { data: InventoryItem[] }) => {
  const chartData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    data.forEach((item) => {
      const existing = map.get(item.category) || { name: item.category, value: 0, count: 0 };
      existing.value += item.price * item.quantity;
      existing.count += item.quantity;
      map.set(item.category, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [data]);

  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  return (
    <div className="glass-card p-4 sm:p-5">
      <h3 className="font-display font-semibold text-foreground text-sm sm:text-base mb-3">Valor por Categoria</h3>
      <div className="premium-divider mb-3" />
      <div className="space-y-2">
        {chartData.map((item, i) => {
          const pct = (item.value / maxVal) * 100;
          return (
            <div key={item.name} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium truncate max-w-[120px]" title={item.name}>{item.name}</span>
                <span className="text-primary font-semibold tabular-nums shrink-0 ml-2">
                  R$ {(item.value / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {chartData.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
      )}
    </div>
  );
};

export default CategoryChart;