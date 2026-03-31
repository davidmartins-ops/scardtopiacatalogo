import { useState, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useDecks, useDeckCards, MTG_FORMATS, type DeckCard } from "@/hooks/use-decks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Search, Loader2, AlertTriangle, Shield, Swords, Crown, Download, Upload, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const BASIC_LANDS = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes", "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp", "Snow-Covered Mountain", "Snow-Covered Forest"];

const DeckBuilder = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { user, loading: authLoading } = useCustomerAuth();
  const { decks, updateDeck } = useDecks();
  const { cards, isLoading, addCard, removeCard, updateCard } = useDeckCards(deckId);

  const deck = useMemo(() => decks.find((d) => d.id === deckId), [decks, deckId]);
  const format = deck ? MTG_FORMATS[deck.format] : null;

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const mainDeck = useMemo(() => cards.filter((c) => !c.is_sideboard && !c.is_commander), [cards]);
  const sideboard = useMemo(() => cards.filter((c) => c.is_sideboard), [cards]);
  const commanders = useMemo(() => cards.filter((c) => c.is_commander), [cards]);
  const totalMain = mainDeck.reduce((s, c) => s + c.quantity, 0);
  const totalSide = sideboard.reduce((s, c) => s + c.quantity, 0);

  // Validation
  const warnings = useMemo(() => {
    if (!format) return [];
    const w: string[] = [];
    const total = totalMain + commanders.reduce((s, c) => s + c.quantity, 0);
    if (format.maxCards && total !== format.maxCards) w.push(`O deck deve ter exatamente ${format.maxCards} cartas (atual: ${total}).`);
    if (total < format.minCards) w.push(`O deck deve ter no mínimo ${format.minCards} cartas (atual: ${total}).`);
    if (format.hasSideboard && totalSide > format.sideboardMax) w.push(`Sideboard: máx. ${format.sideboardMax} cartas (atual: ${totalSide}).`);
    if (format.hasCommander && commanders.length === 0) w.push("Commander: escolha um comandante.");

    // Check copies
    const allCards = [...mainDeck, ...sideboard];
    const counts: Record<string, number> = {};
    allCards.forEach((c) => { counts[c.card_name] = (counts[c.card_name] ?? 0) + c.quantity; });
    Object.entries(counts).forEach(([name, qty]) => {
      if (!BASIC_LANDS.includes(name) && qty > format.maxCopies) {
        w.push(`"${name}" tem ${qty} cópias (máx: ${format.maxCopies}).`);
      }
    });

    return w;
  }, [format, mainDeck, sideboard, commanders, totalMain, totalSide]);

  const searchScryfall = useCallback(async () => {
    if (!search.trim() || !format || !deck) return;
    setSearching(true);
    try {
      const q = `${search} legal:${deck.format}`;
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=name&unique=cards`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data?.slice(0, 20) ?? []);
      } else {
        setSearchResults([]);
        toast.error("Nenhuma carta encontrada nesse formato.");
      }
    } catch {
      toast.error("Erro na busca.");
    } finally {
      setSearching(false);
    }
  }, [search, format, deck]);

  const handleAddCard = (card: any, zone: "main" | "sideboard" | "commander") => {
    const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
    addCard.mutate({
      card_name: card.name,
      quantity: 1,
      is_sideboard: zone === "sideboard",
      is_commander: zone === "commander",
      scryfall_id: card.id,
      image_url: imageUrl,
    });
    toast.success(`${card.name} adicionado!`);
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user || !deck) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Deck não encontrado.</p></div>;
  }

  const CardRow = ({ card }: { card: DeckCard }) => (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/20 group">
      {card.image_url && <img src={card.image_url} alt="" className="h-8 w-6 rounded object-cover border border-border/40" />}
      <span className="flex-1 text-sm text-foreground truncate">{card.card_name}</span>
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
  );

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/conta" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Minha Conta
          </Link>
          <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
          <div className="flex items-center gap-2">
            <Label htmlFor="deck-public" className="text-xs text-muted-foreground">Público</Label>
            <Switch id="deck-public" checked={deck.is_public} onCheckedChange={(v) => updateDeck.mutate({ id: deck.id, is_public: v })} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-display font-bold text-foreground">{deck.name}</h1>
          <Badge variant="outline">{format?.label ?? deck.format}</Badge>
        </div>

        {warnings.length > 0 && (
          <div className="glass-card p-3 mb-4 border-destructive/30 bg-destructive/5 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Search */}
          <div className="lg:col-span-1">
            <div className="glass-card p-4 sticky top-20">
              <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Search className="h-4 w-4" /> Buscar Cartas</h2>
              <p className="text-[10px] text-muted-foreground mb-2">Apenas cartas legais em {format?.label}</p>
              <div className="flex gap-2 mb-3">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome da carta..." onKeyDown={(e) => e.key === "Enter" && searchScryfall()} className="text-sm" />
                <Button size="sm" onClick={searchScryfall} disabled={searching}>{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}</Button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {searchResults.map((card) => (
                  <div key={card.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/30 hover:border-primary/30 transition-colors">
                    {(card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small) && (
                      <img src={card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small} alt="" className="h-14 w-10 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{card.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{card.type_line}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleAddCard(card, "main")}>
                        <Swords className="h-2.5 w-2.5" /> Main
                      </Button>
                      {format?.hasSideboard && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleAddCard(card, "sideboard")}>
                          <Shield className="h-2.5 w-2.5" /> Side
                        </Button>
                      )}
                      {format?.hasCommander && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleAddCard(card, "commander")}>
                          <Crown className="h-2.5 w-2.5" /> Cmdr
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Deck list */}
          <div className="lg:col-span-2 space-y-4">
            {format?.hasCommander && (
              <div className="glass-card p-4">
                <h3 className="font-display font-semibold text-foreground flex items-center gap-2 mb-2"><Crown className="h-4 w-4 text-primary" /> Comandante ({commanders.length})</h3>
                {commanders.map((c) => <CardRow key={c.id} card={c} />)}
              </div>
            )}

            <div className="glass-card p-4">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2 mb-2"><Swords className="h-4 w-4 text-primary" /> Deck Principal ({totalMain})</h3>
              {mainDeck.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Busque e adicione cartas ao deck.</p> : mainDeck.map((c) => <CardRow key={c.id} card={c} />)}
            </div>

            {format?.hasSideboard && (
              <div className="glass-card p-4">
                <h3 className="font-display font-semibold text-foreground flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-primary" /> Sideboard ({totalSide}/{format.sideboardMax})</h3>
                {sideboard.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma carta no sideboard.</p> : sideboard.map((c) => <CardRow key={c.id} card={c} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckBuilder;
