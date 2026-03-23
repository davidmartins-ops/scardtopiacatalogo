import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Filter, Pencil, Trash2, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", quantity: "", category: "" });
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

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

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      price: String(item.price),
      quantity: String(item.quantity),
      category: item.category,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const price = parseFloat(editForm.price);
    const quantity = parseInt(editForm.quantity, 10);
    if (!editForm.name.trim() || isNaN(price) || price < 0 || isNaN(quantity) || quantity < 0) {
      toast.error("Valores inválidos.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("inventory")
      .update({
        name: editForm.name.trim(),
        price,
        quantity,
        category: editForm.category.trim(),
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar alterações.");
      return;
    }

    toast.success("Item atualizado!");
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    setSaving(true);
    const { error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", deleteItem.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao excluir item.");
      return;
    }

    toast.success("Item excluído!");
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setDeleteItem(null);
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
    <>
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
                <th className="px-4 py-3 text-center text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-primary">{item.id}</td>

                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-2">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="h-8 text-sm bg-muted border-border"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${descriptionStyles[item.description]}`}>
                          {item.description}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.price}
                          onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                          className="h-8 text-sm bg-muted border-border w-24"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={editForm.quantity}
                          onChange={(e) => setEditForm((p) => ({ ...p, quantity: e.target.value }))}
                          className="h-8 text-sm bg-muted border-border w-16"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-primary">
                        R$ {(parseFloat(editForm.price || "0") * parseInt(editForm.quantity || "0", 10)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                            onClick={() => saveEdit(item.id)}
                            disabled={saving}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => startEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground font-body text-right">
          {filtered.length} de {data.length} itens
        </div>
      </div>

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">Excluir Item</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Tem certeza que deseja excluir <strong className="text-foreground">{deleteItem?.name}</strong> ({deleteItem?.id})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              disabled={saving}
            >
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InventoryTable;
