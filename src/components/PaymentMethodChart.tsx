import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { Order } from "@/hooks/use-orders";

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
  whatsapp: "WhatsApp",
  other: "Outro",
};

const fmtBRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PaymentMethodChart = ({ orders }: { orders: Order[] }) => {
  const data = useMemo(() => {
    const map = new Map<string, { method: string; revenue: number; orders: number }>();
    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => {
        const m = (o as any).payment_method ?? "whatsapp";
        const cur = map.get(m) ?? { method: METHOD_LABEL[m] ?? m, revenue: 0, orders: 0 };
        cur.revenue += Number(o.total ?? 0);
        cur.orders += 1;
        map.set(m, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  return (
    <Card className="glass-card p-4">
      <h4 className="text-sm font-display font-semibold mb-3 text-foreground flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" /> Receita por método de pagamento
      </h4>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sem vendas no período.</p>
      ) : (
        <ChartContainer
          config={{
            revenue: { label: "Receita", color: "hsl(var(--primary))" },
            orders: { label: "Pedidos", color: "hsl(var(--accent))" },
          }}
          className="h-[240px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="method" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `R$${v}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v, name) =>
                      name === "revenue" ? fmtBRL(Number(v)) : String(v)
                    }
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receita" />
              <Bar yAxisId="right" dataKey="orders" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </Card>
  );
};

export default PaymentMethodChart;
