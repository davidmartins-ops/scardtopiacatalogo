import { useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useCollections, useCollectionCards, usePublicCollection } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Search, Loader2, Globe, Lock, Copy } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const CONDITIONS = ["NM", "SP", "HP", "D"];
const LANGUAGES = ["PT", "EN", "JP", "ES", "FR", "DE", "IT", "KO", "ZHS", "ZHT", "RU"];

const CollectionManager = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { user, loading: authLoading } = useCustomerAuth();
  const { collections, updateCollection } = useCollections();
  const { cards, isLoading, addCard, removeCard, updateCard } = useCollectionCards(collectionId);

  const collection = collections.find((c) => c.id === collectionId);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addCondition, setAddCondition] = useState("NM");
  const [addLanguage, setAddLanguage] = useState("PT");

  const searchScryfall = useCallback(async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(search)}&order=name&unique=cards`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data?.slice(0, 20) ?? []);
      } else {
        setSearchResults([]);
        toast.error("Nenhuma carta encontrada.");
      }
    } catch {
      toast.error("Erro na busca.");
    } finally {
      setSearching(false);
    }
  }, [search]);

  const handleAddCard = (card: any) => {
    const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
    addCard.mutate({
      card_name: card.name,
      quantity: 1,
      condition: addCondition,
      language: addLanguage,
      scryfall_id: card.id,
      image_url: imageUrl,
    });
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/colecao/${collectionId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user || !collection) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Coleção não encontrada.</p></div>;
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/conta" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Minha Conta
          </Link>
          <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
          <div className="flex items-center gap-3">
            <Label htmlFor="col-public" className="text-xs text-muted-foreground">Pública</Label>
            <Switch id="col-public" checked={collection.is_public} onCheckedChange={(v) => updateCollection.mutate({ id: collection.id, is_public: v })} />
            {collection.is_public && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={copyShareLink}>
                <Copy className="h-3 w-3" /> Compartilhar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl font-display font-bold text-foreground mb-1">{collection.name}</h1>
        {collection.description && <p className="text-sm text-muted-foreground mb-4">{collection.description}</p>}
        <p className="text-sm text-muted-foreground mb-4">{cards.length} carta(s) · {cards.reduce((s, c) => s + c.quantity, 0)} unidades</p>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Search */}
          <div className="lg:col-span-1">
            <div className="glass-card p-4 sticky top-20">
              <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Search className="h-4 w-4" /> Buscar Cartas</h2>
              <div className="flex gap-2 mb-3">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome da carta..." onKeyDown={(e) => e.key === "Enter" && searchScryfall()} className="text-sm" />
                <Button size="sm" onClick={searchScryfall} disabled={searching}>{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}</Button>
              </div>
              <div className="flex gap-2 mb-3">
                <Select value={addCondition} onValueChange={setAddCondition}>
                  <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={addLanguage} onValueChange={setAddLanguage}>
                  <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {searchResults.map((card) => (
                  <div key={card.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/30 hover:border-primary/30 transition-colors">
                    {(card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small) && (
                      <img src={card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small} alt="" className="h-14 w-10 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{card.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{card.set_name}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAddCard(card)}>
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="lg:col-span-2">
            <div className="glass-card p-4">
              {cards.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Busque e adicione cartas à sua coleção.</p>
              ) : (
                <div className="space-y-1">
                  {cards.map((card) => (
                    <div key={card.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/20 group">
                      {card.image_url && <img src={card.image_url} alt="" className="h-8 w-6 rounded object-cover border border-border/40" />}
                      <span className="flex-1 text-sm text-foreground truncate">{card.card_name}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5">{card.condition}</Badge>
                      <Badge variant="outline" className="text-[9px] px-1.5">{card.language}</Badge>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateCard.mutate({ id: card.id, quantity: Math.max(1, card.quantity - 1) })} disabled={card.quantity <= 1}>
                          <span className="text-xs">−</span>
                        </Button>
                        <span className="text-xs font-medium w-4 text-center">{card.quantity}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateCard.mutate({ id: card.id, quantity: card.quantity + 1 })}>
                          <span className="text-xs">+</span>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeCard.mutate(card.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionManager;
