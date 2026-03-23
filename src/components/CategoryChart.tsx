import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { type InventoryItem } from "@/data/inventory";

const COLORS = [
  "hsl(45, 80%, 55%)",
  "hsl(270, 50%, 45%)",
  "hsl(200, 60%, 50%)",
  "hsl(150, 60%, 40%)",
  "hsl(0, 70%, 50%)",
  "hsl(300, 60%, 60%)",
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
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="font-display font-semibold text-foreground mb-4">Valor por Categoria</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: "hsl(240, 5%, 55%)", fontSize: 12, fontFamily: "Inter" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "hsl(45, 20%, 90%)", fontSize: 13, fontFamily: "Cinzel" }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(240, 10%, 12%)",
              border: "1px solid hsl(240, 8%, 20%)",
              borderRadius: "8px",
              fontFamily: "Inter",
            }}
            formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Valor Total"]}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryChart;
