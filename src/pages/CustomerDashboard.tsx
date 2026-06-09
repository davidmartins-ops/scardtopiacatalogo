import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useDecks, MTG_FORMATS } from "@/hooks/use-decks";
import { useCollections } from "@/hooks/use-collections";
import { useInventory } from "@/hooks/use-inventory";
import { useOrders, type Order } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Heart, Layers, BookOpen, Plus, Trash2, LogOut, Loader2, Globe, Lock, Eye, ShoppingBag, Download, ChevronRight, Truck } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const accountTabs = ["favorites", "decks", "collections", "orders"] as const;

const CustomerDashboard = () => {
  useSEO({ title: "Minha conta", canonical: "https://www.spencerscardtopia.com.br/conta", noindex: true });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, loading, signOut } = useCustomerAuth();
  const { favorites, isLoading: favLoading } = useFavorites();
  const { data: inventory = [] } = useInventory();
  const { decks, isLoading: decksLoading, createDeck, deleteDeck, updateDeck } = useDecks();
  const { collections, isLoading: colsLoading, createCollection, deleteCollection, updateCollection } = useCollections();
  const { orders, isLoading: ordersLoading } = useOrders();

  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("commander");
  const [newDeckDesc, setNewDeckDesc] = useState("");

  const [newColOpen, setNewColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");

  const favoriteItems = useMemo(() => inventory.filter((i) => favorites.includes(i.id)), [inventory, favorites]);
  const currentTab = accountTabs.includes((searchParams.get("tab") ?? "") as typeof accountTabs[number])
    ? (searchParams.get("tab") as typeof accountTabs[number])
    : "favorites";

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    navigate("/conta/login");
    return null;
  }

  const handleCreateDeck = () => {
    if (!newDeckName.trim()) return;
    createDeck.mutate({ name: newDeckName, format: newDeckFormat, description: newDeckDesc });
    setNewDeckOpen(false);
    setNewDeckName("");
    setNewDeckDesc("");
  };

  const handleCreateCol = () => {
    if (!newColName.trim()) return;
    createCollection.mutate({ name: newColName, description: newColDesc });
    setNewColOpen(false);
    setNewColName("");
    setNewColDesc("");
  };

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/catalogo" className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors duration-200">
            <ArrowLeft className="h-4 w-4" /> Catálogo
          </Link>
          <Link to="/catalogo"><img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" /></Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-brand-header-foreground">{profile?.display_name ?? user.email}</span>
            <Button size="sm" variant="ghost" className="gap-1 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200" onClick={() => { signOut(); navigate("/catalogo"); }}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: '0.05em' }}>
          <span className="text-gradient">Minha Conta</span>
        </h1>

        <Tabs
          value={currentTab}
          onValueChange={(value) => setSearchParams(value === "favorites" ? {} : { tab: value })}
        >
          <TabsList className="bg-muted/50 mb-6">
            <TabsTrigger value="favorites" className="gap-1 font-display"><Heart className="h-3.5 w-3.5" /> Favoritos ({favorites.length})</TabsTrigger>
            <TabsTrigger value="decks" className="gap-1 font-display"><Layers className="h-3.5 w-3.5" /> Decks ({decks.length})</TabsTrigger>
            <TabsTrigger value="collections" className="gap-1 font-display"><BookOpen className="h-3.5 w-3.5" /> Coleções ({collections.length})</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1 font-display"><ShoppingBag className="h-3.5 w-3.5" /> Pedidos ({orders.length})</TabsTrigger>
          </TabsList>

          {/* FAVORITES */}
          <TabsContent value="favorites">
            {favLoading ? (
              <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : favoriteItems.length === 0 ? (
              <div className="text-center py-16">
                <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum favorito ainda.</p>
                <Link to="/catalogo"><Button variant="outline" className="mt-4">Explorar catálogo</Button></Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {favoriteItems.map((item) => {
                  const discount = item.discount ?? 0;
                  const finalPrice = item.price * (1 - discount / 100);
                  return (
                    <div key={item.id} className="glass-card overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover" />
                      ) : (
                        <div className="w-full h-40 bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                      )}
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-foreground truncate">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                        <p className="text-sm font-bold text-primary mt-1">R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* DECKS */}
          <TabsContent value="decks">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{decks.length} deck(s)</p>
              <Dialog open={newDeckOpen} onOpenChange={setNewDeckOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Novo Deck</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Criar Deck</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Nome</Label><Input value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="Ex: Mono Red Aggro" /></div>
                    <div>
                      <Label>Formato</Label>
                      <Select value={newDeckFormat} onValueChange={setNewDeckFormat}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(MTG_FORMATS).map(([key, fmt]) => (
                            <SelectItem key={key} value={key}>{fmt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Descrição (opcional)</Label><Textarea value={newDeckDesc} onChange={(e) => setNewDeckDesc(e.target.value)} /></div>
                    <Button className="w-full" onClick={handleCreateDeck} disabled={!newDeckName.trim()}>Criar Deck</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {decksLoading ? (
              <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : decks.length === 0 ? (
              <div className="text-center py-16">
                <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum deck criado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map((deck) => (
                  <div key={deck.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/conta/decks/${deck.id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate">{deck.name}</Link>
                        <Badge variant="outline" className="text-[10px] shrink-0">{MTG_FORMATS[deck.format]?.label ?? deck.format}</Badge>
                        {deck.is_public ? <Globe className="h-3.5 w-3.5 text-success shrink-0" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      </div>
                      {deck.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{deck.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/conta/decks/${deck.id}`}>
                        <Button size="sm" variant="ghost" aria-label={`Ver deck ${deck.name}`}><Eye className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir deck ${deck.name}`} onClick={() => { if (confirm("Excluir deck?")) deleteDeck.mutate(deck.id); }}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* COLLECTIONS */}
          <TabsContent value="collections">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{collections.length} coleção(ões)</p>
              <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Nova Coleção</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Criar Coleção</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Nome</Label><Input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Ex: Meus Mythics" /></div>
                    <div><Label>Descrição (opcional)</Label><Textarea value={newColDesc} onChange={(e) => setNewColDesc(e.target.value)} /></div>
                    <Button className="w-full" onClick={handleCreateCol} disabled={!newColName.trim()}>Criar Coleção</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {colsLoading ? (
              <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : collections.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma coleção criada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {collections.map((col) => (
                  <div key={col.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/conta/colecoes/${col.id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate">{col.name}</Link>
                        <div className="flex items-center gap-1">
                          {col.is_public ? <Globe className="h-3.5 w-3.5 text-success" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <Switch checked={col.is_public} onCheckedChange={(v) => updateCollection.mutate({ id: col.id, is_public: v })} className="scale-75" />
                        </div>
                      </div>
                      {col.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{col.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/conta/colecoes/${col.id}`}>
                        <Button size="sm" variant="ghost" aria-label={`Ver coleção ${col.name}`}><Eye className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir coleção ${col.name}`} onClick={() => { if (confirm("Excluir coleção?")) deleteCollection.mutate(col.id); }}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders">
            {ordersLoading ? (
              <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum pedido realizado ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Seus pedidos aparecerão aqui após enviar pelo WhatsApp.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground mb-1">🔒 Privacidade dos pedidos</p>
                  <p><strong className="text-foreground">Você vê:</strong> ID, status, data, total e itens (nome, qtd, preço) — apenas dos seus pedidos.</p>
                  <p><strong className="text-foreground">Admins veem:</strong> todos os pedidos (seus e de visitantes) e podem alterar status ou excluir.</p>
                  <p><strong className="text-foreground">Seu user_id</strong> nunca é exposto a outros clientes (RLS por linha).</p>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                    const esc = (v: any) => String(v ?? "")
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&apos;");
                    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<orders>\n';
                    orders.forEach((order) => {
                      xml += `  <order id="${esc(order.id)}" status="${esc(order.status)}" date="${esc(order.created_at)}" total="${esc(order.total)}">\n`;
                      (order.items as any[]).forEach((item: any) => {
                        xml += `    <item name="${esc(item.name)}" quantity="${esc(item.quantity)}" unit_price="${esc(item.unit_price)}" total_price="${esc(item.total_price)}" />\n`;
                      });
                      xml += `  </order>\n`;
                    });
                    xml += '</orders>';
                    const blob = new Blob([xml], { type: 'application/xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.xml`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Arquivo XML baixado!");
                  }}>
                    <Download className="h-3.5 w-3.5" /> Exportar XML
                  </Button>
                </div>
                {orders.map((order) => (
                  <Link to={`/conta/pedidos/${order.id}`} key={order.id} className="glass-card p-4 block hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <OrderStatusBadge status={order.status} className="text-[10px]" />
                        <span className="text-[11px] text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {order.tracking_code && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-accent">
                            <Truck className="h-3 w-3" /> {order.tracking_code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary font-display">
                          R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(order.items as any[]).slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate flex-1">{item.quantity}× {item.name}</span>
                          <span className="shrink-0 ml-2">R$ {Number(item.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {(order.items as any[]).length > 3 && (
                        <div className="text-[11px] text-muted-foreground italic">
                          + {(order.items as any[]).length - 3} item(ns)…
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CustomerDashboard;
