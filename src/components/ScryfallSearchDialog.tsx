import { useState } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScryfallCard {
  id: string;
  name: string;
  set_name: string;
  set: string;
  collector_number: string;
  rarity: string;
  type_line: string;
  image_uris?: { normal?: string; small?: string };
  card_faces?: { image_uris?: { normal?: string; small?: string } }[];
  prices?: { usd?: string | null; usd_foil?: string | null };
}

const rarityColors: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-non-foil/15 text-non-foil border-non-foil/30",
  rare: "bg-foil/15 text-foil border-foil/30",
  mythic: "bg-rainbow/15 text-rainbow border-rainbow/30",
};

const LANGUAGES = [
  { value: "PT", label: "Português" },
  { value: "EN", label: "English" },
  { value: "JP", label: "日本語" },
];

const CONDITIONS = [
  { value: "NM", label: "NM - Near Mint" },
  { value: "SP", label: "SP - Slightly Played" },
  { value: "HP", label: "HP - Heavily Played" },
  { value: "D", label: "D - Damaged" },
];

const ScryfallSearchDialog = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ScryfallCard | null>(null);
  const [priceBRL, setPriceBRL] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState<"Foil" | "Non-Foil">("Non-Foil");
  const [language, setLanguage] = useState("PT");
  const [condition, setCondition] = useState("NM");
  const [saving, setSaving] = useState(false);

  // Edition selector
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loadingPrintings, setLoadingPrintings] = useState(false);

  const queryClient = useQueryClient();

  const getCardImage = (card: ScryfallCard) => {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
    return null;
  };

  const getCardSmall = (card: ScryfallCard) => {
    if (card.image_uris?.small) return card.image_uris.small;
    if (card.card_faces?.[0]?.image_uris?.small) return card.card_faces[0].image_uris.small;
    return null;
  };

  const searchScryfall = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setSelected(null);
    setPrintings([]);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query.trim())}&unique=cards&order=released&dir=desc`);
      if (!res.ok) {
        if (res.status === 404) toast.info("Nenhuma carta encontrada.");
        else toast.error("Erro na busca.");
        setSearching(false);
        return;
      }
      const data = await res.json();
      setResults(data.data?.slice(0, 20) ?? []);
    } catch {
      toast.error("Erro ao conectar com Scryfall.");
    } finally {
      setSearching(false);
    }
  };

  const loadPrintings = async (cardName: string) => {
    setLoadingPrintings(true);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${cardName}"`)}&unique=prints&order=released&dir=desc`);
      if (res.ok) {
        const data = await res.json();
        setPrintings(data.data ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingPrintings(false);
    }
  };

  const selectCard = (card: ScryfallCard) => {
    setSelected(card);
    loadPrintings(card.name);
  };

  const handleAdd = async () => {
    if (!selected) return;
    const price = parseFloat(priceBRL);
    const qty = parseInt(quantity, 10);
    if (isNaN(price) || price < 0) { toast.error("Preço em R$ inválido."); return; }
    if (isNaN(qty) || qty < 0) { toast.error("Quantidade inválida."); return; }

    const foilSuffix = description === "Foil" ? "F" : "NF";
    const cardId = `${selected.set.toUpperCase()}-${selected.collector_number}-${language}-${foilSuffix}-${condition}`;
    const imageUrl = getCardImage(selected);

    setSaving(true);
    const { error } = await supabase.from("inventory").insert({
      id: cardId,
      name: selected.name,
      description,
      price,
      quantity: qty,
      category: selected.set_name,
      image_url: imageUrl,
      product_type: "single",
      language,
      condition,
    });
    setSaving(false);

    if (error) {
      if (error.code === "23505") toast.error("Já existe um item com este ID. Tente alterar o ID manualmente.");
      else toast.error("Erro ao adicionar carta.");
      return;
    }

    toast.success(`${selected.name} adicionada ao estoque!`);
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    resetForm();
  };

  const resetForm = () => {
    setSelected(null);
    setPriceBRL("");
    setQuantity("1");
    setDescription("Non-Foil");
    setLanguage("PT");
    setCondition("NM");
    setQuery("");
    setResults([]);
    setPrintings([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 font-body">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Cadastrar Single</span>
          <span className="sm:hidden">Single</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">Cadastrar Carta Avulsa (Single)</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar carta por nome (ex: Lightning Bolt)..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchScryfall()} className="pl-9 bg-muted border-border" />
              </div>
              <Button onClick={searchScryfall} disabled={searching || !query.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-2 pr-2">
                {results.map((card) => {
                  const img = getCardSmall(card);
                  return (
                    <button key={card.id} onClick={() => selectCard(card)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all text-left">
                      {img ? (
                        <img src={img} alt={card.name} className="h-16 w-12 rounded object-cover border border-border/40 shrink-0" />
                      ) : (
                        <div className="h-16 w-12 rounded bg-muted/30 border border-border/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{card.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{card.set_name} · {card.type_line}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] capitalize ${rarityColors[card.rarity] ?? ""}`}>{card.rarity}</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">#{card.collector_number}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {card.prices?.usd && <p className="text-xs text-muted-foreground">USD ${card.prices.usd}</p>}
                        {card.prices?.usd_foil && <p className="text-xs text-foil">Foil ${card.prices.usd_foil}</p>}
                      </div>
                    </button>
                  );
                })}
                {results.length === 0 && !searching && query && (
                  <p className="text-sm text-muted-foreground text-center py-8">Use a busca acima para encontrar cartas no Scryfall.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[70vh]">
            <div className="space-y-4 pr-2">
              <div className="flex gap-4">
                {getCardImage(selected) && (
                  <img src={getCardImage(selected)!} alt={selected.name} className="h-52 w-auto rounded-lg border border-border shadow-lg shrink-0" />
                )}
                <div className="flex-1 space-y-2">
                  <h3 className="font-display text-lg font-semibold text-foreground">{selected.name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.type_line}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">{selected.set_name}</Badge>
                    <Badge variant="outline" className={`text-xs capitalize ${rarityColors[selected.rarity] ?? ""}`}>{selected.rarity}</Badge>
                    <Badge variant="outline" className="text-xs font-mono">#{selected.collector_number}</Badge>
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base de Preço Internacional</p>
                    <div className="flex gap-4">
                      {selected.prices?.usd ? (
                        <p className="text-sm">Non-Foil: <span className="font-bold text-foreground">US$ {selected.prices.usd}</span></p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Non-Foil: N/A</p>
                      )}
                      {selected.prices?.usd_foil ? (
                        <p className="text-sm">Foil: <span className="font-bold text-foil">US$ {selected.prices.usd_foil}</span></p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Foil: N/A</p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Fonte: TCGPlayer / CardKingdom via Scryfall</p>
                  </div>
                </div>
              </div>

              {/* Edition / Printings selector */}
              {printings.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Edição / Variante ({printings.length} disponíveis)</Label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {printings.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelected(p)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                            p.id === selected.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {getCardSmall(p) && <img src={getCardSmall(p)!} alt="" className="h-8 w-6 rounded object-cover shrink-0" />}
                          <div className="text-left min-w-0">
                            <p className="font-medium truncate">{p.set_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">#{p.collector_number}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  {loadingPrintings && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              )}

              {/* Price, qty, type, language, condition */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço (R$) *</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={priceBRL} onChange={(e) => setPriceBRL(e.target.value)} className="bg-muted border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-muted border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" variant={description === "Non-Foil" ? "default" : "outline"} onClick={() => setDescription("Non-Foil")} className="flex-1 text-xs">Non-Foil</Button>
                    <Button type="button" size="sm" variant={description === "Foil" ? "default" : "outline"} onClick={() => setDescription("Foil")} className="flex-1 text-xs">Foil</Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Idioma</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Qualidade</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setSelected(null); setPrintings([]); }}>Voltar</Button>
                <Button onClick={handleAdd} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar ao Estoque
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScryfallSearchDialog;
