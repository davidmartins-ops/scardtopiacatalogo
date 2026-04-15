import { useState, useRef, useEffect } from "react";
import { ShoppingCart as CartIcon, X, Trash2, Plus, Minus, Send, QrCode, Upload, Loader2, Check, Truck, Store, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type InventoryItem } from "@/data/inventory";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

export interface CartItem {
  item: InventoryItem;
  qty: number;
}

interface ShoppingCartProps {
  items: CartItem[];
  onAdd: (item: InventoryItem) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  onUpdateQty: (itemId: string, qty: number) => void;
  onOrderPlaced?: (items: CartItem[], total: number) => void;
  fabsVisible?: boolean;
}

const WHATSAPP_NUMBER = "5511947154555";
const PIX_KEY = "david-donizeti-martins@jim.com";

interface ShippingInfo {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  shippingMethod: "pac" | "sedex" | "transportadora" | "";
}

interface FreightEstimate {
  pac?: { price: string; deadline: string };
  sedex?: { price: string; deadline: string };
  loading: boolean;
  error?: string;
}

const fetchFreight = async (cep: string): Promise<Omit<FreightEstimate, "loading">> => {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return { error: "CEP inválido" };

  try {
    // Use ViaCEP to validate, then estimate via weight-based formula
    const viaRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const viaData = await viaRes.json();
    if (viaData.erro) return { error: "CEP não encontrado" };

    // Simple estimate based on region
    const uf = (viaData.uf ?? "").toUpperCase();
    const spRegion = ["SP"].includes(uf);
    const seRegion = ["RJ", "MG", "ES"].includes(uf);

    const pacBase = spRegion ? 18.9 : seRegion ? 24.5 : 32.9;
    const sedexBase = spRegion ? 28.5 : seRegion ? 38.9 : 52.9;
    const pacDays = spRegion ? "5-8" : seRegion ? "8-12" : "10-15";
    const sedexDays = spRegion ? "2-4" : seRegion ? "3-5" : "5-8";

    return {
      pac: { price: pacBase.toFixed(2), deadline: `${pacDays} dias úteis` },
      sedex: { price: sedexBase.toFixed(2), deadline: `${sedexDays} dias úteis` },
    };
  } catch {
    return { error: "Erro ao consultar frete" };
  }
};

const ShoppingCart = ({ items, onRemove, onClear, onUpdateQty, onOrderPlaced, fabsVisible = true }: ShoppingCartProps) => {
  const [open, setOpen] = useState(false);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "shipping" | null>(null);
  const [pendingAction, setPendingAction] = useState<"whatsapp" | "pix" | null>(null);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({ street: "", neighborhood: "", city: "", state: "", cep: "", shippingMethod: "" });
  const [freight, setFreight] = useState<FreightEstimate>({ loading: false });

  const { profile } = useCustomerAuth();

  // Auto-fetch freight when CEP has 8+ digits
  useEffect(() => {
    const cleanCep = shippingInfo.cep.replace(/\D/g, "");
    if (cleanCep.length === 8 && deliveryMethod === "shipping") {
      setFreight({ loading: true });
      fetchFreight(cleanCep).then((result) => setFreight({ ...result, loading: false }));
    } else {
      setFreight({ loading: false });
    }
  }, [shippingInfo.cep, deliveryMethod]);

  // Auto-fill address from ViaCEP
  useEffect(() => {
    const cleanCep = shippingInfo.cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.erro) {
            setShippingInfo((prev) => ({
              ...prev,
              street: data.logradouro ? `${data.logradouro}` : prev.street,
              neighborhood: data.bairro || prev.neighborhood,
              city: data.localidade || prev.city,
              state: data.uf || prev.state,
            }));
          }
        })
        .catch(() => {});
    }
  }, [shippingInfo.cep]);

  const total = items.reduce((s, ci) => {
    const discount = ci.item.discount ?? 0;
    const finalPrice = ci.item.price * (1 - discount / 100);
    return s + finalPrice * ci.qty;
  }, 0);

  const totalItems = items.reduce((s, ci) => s + ci.qty, 0);

  const getFreightValue = () => {
    if (shippingInfo.shippingMethod === "pac" && freight.pac) return parseFloat(freight.pac.price);
    if (shippingInfo.shippingMethod === "sedex" && freight.sedex) return parseFloat(freight.sedex.price);
    return 0;
  };

  const buildMessage = () => {
    let msg = "Lista de Interesse - Spencer's Cardtopia\n\n";
    items.forEach((ci, i) => {
      const discount = ci.item.discount ?? 0;
      const finalPrice = ci.item.price * (1 - discount / 100);
      msg += `${i + 1}. ${ci.item.name} (${ci.item.id})\n`;
      msg += `   Tipo: ${ci.item.description}`;
      if (ci.item.language) msg += ` | Idioma: ${ci.item.language}`;
      if (ci.item.condition) msg += ` | Estado: ${ci.item.condition}`;
      msg += `\n   Qtd: ${ci.qty} x R$ ${finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} = R$ ${(finalPrice * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
    });
    msg += `Subtotal: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;

    if (deliveryMethod === "pickup") {
      msg += `\n📦 Entrega: RETIRADA NO LOCAL\n`;
      msg += `Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
    } else if (deliveryMethod === "shipping") {
      const methodLabel = shippingInfo.shippingMethod === "pac" ? "PAC" : shippingInfo.shippingMethod === "sedex" ? "SEDEX" : "Transportadora";
      const freightVal = getFreightValue();
      msg += `\n📦 Entrega: ENVIO - ${methodLabel}\n`;
      msg += `👤 Nome: ${profile?.display_name ?? "—"}\n`;
      msg += `📍 Endereço: ${shippingInfo.street}, ${shippingInfo.neighborhood}\n`;
      msg += `🏙️ ${shippingInfo.city} - ${shippingInfo.state}\n`;
      msg += `📮 CEP: ${shippingInfo.cep}\n`;
      if (freightVal > 0) {
        msg += `🚚 Frete estimado: R$ ${freightVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
        msg += `Total (com frete): R$ ${(total + freightVal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      }
      msg += "\n";
    }

    msg += "Gostaria de fechar esse pedido!";
    return msg;
  };

  const openDeliveryDialog = (action: "whatsapp" | "pix") => {
    setPendingAction(action);
    setDeliveryMethod(null);
    setShippingInfo({ street: "", neighborhood: "", city: "", state: "", cep: "", shippingMethod: "" });
    setFreight({ loading: false });
    setDeliveryDialogOpen(true);
  };

  const confirmDeliveryAndProceed = () => {
    if (deliveryMethod === "shipping") {
      if (!shippingInfo.street || !shippingInfo.neighborhood || !shippingInfo.city || !shippingInfo.state || !shippingInfo.cep || !shippingInfo.shippingMethod) {
        toast.error("Preencha todos os campos de endereço.");
        return;
      }
    }
    setDeliveryDialogOpen(false);
    if (pendingAction === "whatsapp") handleBuyWhatsApp();
    else if (pendingAction === "pix") handlePixSelect();
  };

  const handleBuyWhatsApp = () => {
    const msg = buildMessage();
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    if (onOrderPlaced) onOrderPlaced(items, total);
  };

  const handlePixSelect = () => { setPixDialogOpen(true); setReceiptFile(null); setReceiptPreview(null); setReceiptSent(false); };

  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") { toast.error("Envie uma imagem ou PDF do comprovante."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo deve ter no maximo 10MB."); return; }
    setReceiptFile(file);
    if (file.type.startsWith("image/")) setReceiptPreview(URL.createObjectURL(file));
    else setReceiptPreview(null);
  };

  const handleConfirmPix = async () => {
    if (!receiptFile) { toast.error("Anexe o comprovante de pagamento."); return; }
    setUploadingReceipt(true);
    try {
      const ext = receiptFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, receiptFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
      let msg = buildMessage();
      msg += `\n\nPagamento via PIX confirmado!\nComprovante: ${urlData.publicUrl}`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
      if (onOrderPlaced) onOrderPlaced(items, total);
      setReceiptSent(true);
      toast.success("Comprovante enviado e pedido registrado!");
      setPixDialogOpen(false);
    } catch { toast.error("Erro ao enviar comprovante. Tente novamente."); }
    finally { setUploadingReceipt(false); }
  };

  const copyPixKey = () => { navigator.clipboard.writeText(PIX_KEY); toast.success("Chave PIX copiada!"); };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 glass-card rounded-full px-5 py-3 text-sm font-medium text-foreground shadow-lg hover:border-primary/50 hover:shadow-primary/10 hover:shadow-xl transition-all duration-500 ${fabsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
            <CartIcon className="h-5 w-5 text-primary" />
            Carrinho
            {totalItems > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs h-5 min-w-[20px] flex items-center justify-center">{totalItems}</Badge>
            )}
          </button>
        </SheetTrigger>
        <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="font-display text-foreground flex items-center gap-2">
              <CartIcon className="h-5 w-5 text-primary" /> Carrinho de Interesse
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <CartIcon className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Seu carrinho esta vazio.</p>
              <p className="text-xs text-muted-foreground">Adicione produtos do catalogo.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 py-4">
                {items.map((ci) => {
                  const discount = ci.item.discount ?? 0;
                  const finalPrice = ci.item.price * (1 - discount / 100);
                  return (
                    <div key={ci.item.id} className="flex gap-3 p-3 rounded-lg border border-border bg-muted/20">
                      {ci.item.image_url ? (
                        <img src={ci.item.image_url} alt={ci.item.name} className="h-16 w-12 rounded object-cover border border-border/40 shrink-0" />
                      ) : (
                        <div className="h-16 w-12 rounded bg-muted/30 border border-border/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ci.item.name}</p>
                        <p className="text-xs text-muted-foreground">{ci.item.description}{ci.item.language ? ` · ${ci.item.language}` : ""}{ci.item.condition ? ` · ${ci.item.condition}` : ""}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onUpdateQty(ci.item.id, ci.qty - 1)} disabled={ci.qty <= 1}><Minus className="h-3 w-3" /></Button>
                            <span className="text-sm font-medium w-6 text-center">{ci.qty}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onUpdateQty(ci.item.id, ci.qty + 1)} disabled={ci.qty >= ci.item.quantity}><Plus className="h-3 w-3" /></Button>
                          </div>
                          <span className="text-sm font-bold text-primary">R$ {(finalPrice * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(ci.item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary font-display">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <Button className="w-full gap-2 font-body" size="lg" onClick={() => openDeliveryDialog("whatsapp")}><Send className="h-4 w-4" />Comprar via WhatsApp</Button>
                <Button variant="outline" className="w-full gap-2 font-body border-primary/30 hover:border-primary/60" size="lg" onClick={() => openDeliveryDialog("pix")}><QrCode className="h-4 w-4" />Pagar com PIX</Button>
                <Button variant="outline" className="w-full gap-2 font-body text-xs" size="sm" onClick={onClear}><Trash2 className="h-3.5 w-3.5" />Limpar carrinho</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delivery Method Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> Forma de Entrega
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeliveryMethod("pickup")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${deliveryMethod === "pickup" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                <Store className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-foreground">Retirada</span>
                <span className="text-[10px] text-muted-foreground text-center">Retirar no local</span>
              </button>
              <button onClick={() => setDeliveryMethod("shipping")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${deliveryMethod === "shipping" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                <Truck className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-foreground">Envio</span>
                <span className="text-[10px] text-muted-foreground text-center">Correios / Transportadora</span>
              </button>
            </div>

            {deliveryMethod === "shipping" && (
              <div className="space-y-3 animate-fade-in">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Endereço de Entrega</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input value={profile?.display_name ?? ""} disabled className="h-8 text-sm bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CEP</Label>
                      <Input placeholder="00000-000" value={shippingInfo.cep} onChange={(e) => setShippingInfo((p) => ({ ...p, cep: e.target.value }))} className="h-8 text-sm" />
                      {freight.loading && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Consultando frete...</p>}
                      {freight.error && <p className="text-[10px] text-destructive mt-1">{freight.error}</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rua / Endereço</Label>
                      <Input placeholder="Rua, número, complemento" value={shippingInfo.street} onChange={(e) => setShippingInfo((p) => ({ ...p, street: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bairro</Label>
                      <Input placeholder="Bairro" value={shippingInfo.neighborhood} onChange={(e) => setShippingInfo((p) => ({ ...p, neighborhood: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Cidade</Label>
                        <Input placeholder="Cidade" value={shippingInfo.city} onChange={(e) => setShippingInfo((p) => ({ ...p, city: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Estado</Label>
                        <Input placeholder="SP" maxLength={2} value={shippingInfo.state} onChange={(e) => setShippingInfo((p) => ({ ...p, state: e.target.value.toUpperCase() }))} className="h-8 text-sm" />
                      </div>
                    </div>

                    {/* Freight estimation results */}
                    {(freight.pac || freight.sedex) && (
                      <div className="p-2.5 rounded-lg bg-success/5 border border-success/20 space-y-2 mt-1">
                        <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-success" /> Estimativa de Frete
                        </p>
                        {freight.pac && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">📦 PAC ({freight.pac.deadline})</span>
                            <span className="font-semibold text-foreground">R$ {freight.pac.price}</span>
                          </div>
                        )}
                        {freight.sedex && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">⚡ SEDEX ({freight.sedex.deadline})</span>
                            <span className="font-semibold text-foreground">R$ {freight.sedex.price}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground">Forma de Envio</Label>
                      <Select value={shippingInfo.shippingMethod} onValueChange={(v) => setShippingInfo((p) => ({ ...p, shippingMethod: v as ShippingInfo["shippingMethod"] }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pac">
                            Correios - PAC {freight.pac ? `(R$ ${freight.pac.price})` : ""}
                          </SelectItem>
                          <SelectItem value="sedex">
                            Correios - SEDEX {freight.sedex ? `(R$ ${freight.sedex.price})` : ""}
                          </SelectItem>
                          <SelectItem value="transportadora">Transportadora</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 mt-1">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ⚠️ Os valores de frete são <strong>estimativas</strong>. O valor final será confirmado no ato do envio.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {deliveryMethod && (
              <Button className="w-full gap-2" size="lg" onClick={confirmDeliveryAndProceed}>
                <Send className="h-4 w-4" />
                Confirmar e Continuar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX Payment Dialog */}
      <Dialog open={pixDialogOpen} onOpenChange={setPixDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> Pagamento via PIX
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chave PIX (E-mail)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-foreground bg-muted/50 px-3 py-2 rounded break-all">{PIX_KEY}</code>
                <Button size="sm" variant="outline" onClick={copyPixKey} className="shrink-0 gap-1"><Check className="h-3 w-3" /> Copiar</Button>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground">Valor a transferir</p>
              <p className="text-2xl font-bold text-primary font-display">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Anexar comprovante de pagamento</p>
              {receiptPreview ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border bg-muted/20">
                  <img src={receiptPreview} alt="Comprovante" className="w-full h-full object-contain" />
                  <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (fileRef.current) fileRef.current.value = ""; }} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive/80 transition-colors"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : receiptFile ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
                  <Upload className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate">{receiptFile.name}</span>
                  <button onClick={() => { setReceiptFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="ml-auto text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Clique para anexar o comprovante (imagem ou PDF)</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleReceiptSelect} />
            </div>
            <Button className="w-full gap-2" size="lg" onClick={handleConfirmPix} disabled={!receiptFile || uploadingReceipt}>
              {uploadingReceipt ? (<><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>) : (<><Send className="h-4 w-4" />Confirmar e Enviar via WhatsApp</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShoppingCart;
