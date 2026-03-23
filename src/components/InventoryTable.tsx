import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type InventoryItem } from "@/data/inventory";

const descriptionStyles: Record<string, string> = {
  "Foil": "bg-foil/15 text-foil border-foil/30",
  "Non-Foil": "bg-non-foil/15 text-non-foil border-non-foil/30",
  "Rainbow Foil": "bg-rainbow/15 text-rainbow border-rainbow/30",
};

interface Props {
  data: InventoryItem[];
}

type SortKey = "id" | "name" | "price" | "quantity";

const InventoryTable = ({ data }: Props) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = useMemo(() => {
    let items = data.filter(
      (item) =>
        (filterType === "all" || item.description === filterType) &&
        (item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.id.toLowerCase().includes(search.toLowerCase()))
    );
    items.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return items;
  }, [data, search, sortKey, sortAsc, filterType]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-primary" : ""}`} />
      </span>
    </th>
  );

  const filters = ["all", "Foil", "Non-Foil", "Rainbow Foil"];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-border font-body"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1 rounded-full text-xs font-body font-medium transition-all ${
                filterType === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-body">
          <thead className="bg-muted/50">
            <tr>
              <SortHeader label="ID" k="id" />
              <SortHeader label="Nome" k="name" />
              <th className="px-4 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              <SortHeader label="Preço" k="price" />
              <SortHeader label="Qtd" k="quantity" />
              <th className="px-4 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Valor Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-primary">{item.id}</td>
                <td className="px-4 py-3 text-sm max-w-xs">{item.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs ${descriptionStyles[item.description]}`}>
                    {item.description}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm tabular-nums">
                  R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-center tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3 text-sm font-semibold tabular-nums text-primary">
                  R$ {(item.price * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-border text-xs text-muted-foreground font-body text-right">
        {filtered.length} de {data.length} itens
      </div>
    </div>
  );
};

export default InventoryTable;
