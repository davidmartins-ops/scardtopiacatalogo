import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart as CartIcon, X, Trash2, Plus, Minus, Send, QrCode, Upload, Loader2, Check, Truck, Store, MapPin, Package, LogIn, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  onOrderPlaced?: (
    items: CartItem[],
    total: number,
    meta?: {
      paymentMethod?: "pix" | "whatsapp";
      receiptUrl?: string | null;
      customerInfo?: {
        name?: string;
        email?: string;
        cpf?: string;
        phone?: string;
        address?: ShippingInfo & { complement?: string };
        deliveryMethod?: "pickup" | "shipping";
      };
    }
  ) => void | Promise<boolean | void>;
  fabsVisible?: boolean;
}

const WHATSAPP_NUMBER = "5511947154555";
const PIX_KEY = "66.981.664/0001-97";

interface ShippingInfo {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  shippingMethod: "pac" | "sedex" | "transportadora" | "";
}

interface CustomerExtra {
  cpf: string;
  phone: string;
}

interface FreightEstimate {
  pac?: { price: string; deadline: string };
  sedex?: { price: string; deadline: string };
  loading: boolean;
  error?: string;
}

const fetchFreight = async (
  cep: string,
  itemCount: number,
): Promise<Omit<FreightEstimate, "loading">> => {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return { error: "CEP inválido" };

  try {
    const { data, error } = await supabase.functions.invoke("superfrete-calculate", {
      body: { cep: cleanCep, itemCount },
    });
    if (error) return { error: "Erro ao consultar frete" };
    const options: Array<{ id: number; name: string; price: number; deliveryDays: string }> =
      data?.options ?? [];
    // Map SuperFrete services: 1=PAC, 2=SEDEX, 17=Mini Envios
    const pacOpt = options.find((o) => o.id === 1) ?? options.find((o) => o.id === 17);
    const sedexOpt = options.find((o) => o.id === 2);
    const result: Omit<FreightEstimate, "loading"> = {};
    if (pacOpt) {
      result.pac = {
        price: pacOpt.price.toFixed(2),
        deadline: `${pacOpt.deliveryDays} dias úteis`,
      };
    }
    if (sedexOpt) {
      result.sedex = {
        price: sedexOpt.price.toFixed(2),
        deadline: `${sedexOpt.deliveryDays} dias úteis`,
      };
    }
    if (!result.pac && !result.sedex) return { error: "Sem opções de frete disponíveis" };
    return result;
  } catch {
    return { error: "Erro ao consultar frete" };
  }
};


const ShoppingCart = ({ items, onRemove, onClear, onUpdateQty, onOrderPlaced, fabsVisible = true }: ShoppingCartProps) => {
  const [open, setOpen] = useState(false);

  // Auto-open cart when returning from login with ?openCart=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCart") === "1") {
      setOpen(true);
      params.delete("openCart");
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "shipping" | null>(null);
  const [pendingAction, setPendingAction] = useState<"whatsapp" | "pix" | "card" | null>(null);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({ street: "", neighborhood: "", city: "", state: "", cep: "", shippingMethod: "" });
  const [customerExtra, setCustomerExtra] = useState<CustomerExtra>({ cpf: "", phone: "" });
  const [freight, setFreight] = useState<FreightEstimate>({ loading: false });

  const { profile, user } = useCustomerAuth();
  const navigate = useNavigate();
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [pendingChannel, setPendingChannel] = useState<"whatsapp" | "pix" | "card" | null>(null);

  // Pre-fill cpf/phone from saved profile
  useEffect(() => {
    if (profile) {
      setCustomerExtra((p) => ({
        cpf: p.cpf || (profile.cpf ?? ""),
        phone: p.phone || (profile.phone ?? ""),
      }));
    }
  }, [profile]);

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

  // Total no cartão: SEM desconto (o desconto vale apenas para PIX).
  const total = items.reduce((s, ci) => s + ci.item.price * ci.qty, 0);

  // Total PIX: aplica o desconto sobre price_pix (ou price quando price_pix não existir).
  const pixTotal = items.reduce((s, ci) => {
    const discount = ci.item.discount ?? 0;
    const base = (ci.item.price_pix ?? 0) > 0 ? (ci.item.price_pix as number) : ci.item.price;
    const finalPrice = base * (1 - discount / 100);
    return s + finalPrice * ci.qty;
  }, 0);

  const totalItems = items.reduce((s, ci) => s + ci.qty, 0);

  // Resolve the amount to charge for the currently selected payment channel.
  const amountForChannel = (channel: "whatsapp" | "pix" | "card" | null) =>
    channel === "pix" ? pixTotal : total;

  const getFreightValue = () => {
    if (shippingInfo.shippingMethod === "pac" && freight.pac) return parseFloat(freight.pac.price);
    if (shippingInfo.shippingMethod === "sedex" && freight.sedex) return parseFloat(freight.sedex.price);
    return 0;
  };

  const buildMessage = (channel: "whatsapp" | "pix" | "card" | null = pendingChannel) => {
    const isPix = channel === "pix";
    const channelTotal = amountForChannel(channel);
    let msg = "Lista de Interesse - Spencer's Cardtopia\n\n";
    items.forEach((ci, i) => {
      const discount = ci.item.discount ?? 0;
      // Desconto aplica APENAS no PIX.
      const finalPrice = isPix
        ? ((ci.item.price_pix ?? 0) > 0 ? (ci.item.price_pix as number) : ci.item.price) * (1 - discount / 100)
        : ci.item.price;
      msg += `${i + 1}. ${ci.item.name} (${ci.item.id})\n`;
      msg += `   Tipo: ${ci.item.description}`;
      if (ci.item.language) msg += ` | Idioma: ${ci.item.language}`;
      if (ci.item.condition) msg += ` | Estado: ${ci.item.condition}`;
      msg += `\n   Qtd: ${ci.qty} x R$ ${finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} = R$ ${(finalPrice * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
    });
    msg += `Forma de pagamento: ${isPix ? "PIX" : "Cartão / WhatsApp"}\n`;
    msg += `Subtotal: R$ ${channelTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;

    if (deliveryMethod === "pickup") {
      msg += `\n📦 Entrega: RETIRADA NO LOCAL\n`;
      msg += `Total: R$ ${channelTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
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
        msg += `Total (com frete): R$ ${(channelTotal + freightVal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      }
      msg += "\n";
    }

    msg += "Gostaria de fechar esse pedido!";
    return msg;
  };

  const openDeliveryDialog = (action: "whatsapp" | "pix" | "card") => {
    if (!user) {
      setPendingAction(action);
      setLoginPromptOpen(true);
      return;
    }
    setPendingAction(action);
    setDeliveryMethod(null);
    setShippingInfo({ street: "", neighborhood: "", city: "", state: "", cep: "", shippingMethod: "" });
    setFreight({ loading: false });
    setDeliveryDialogOpen(true);
  };

  const buildCustomerInfo = () => ({
    name: profile?.display_name ?? "",
    email: user?.email ?? "",
    cpf: customerExtra.cpf.trim(),
    phone: customerExtra.phone.trim(),
    address: deliveryMethod === "shipping" ? { ...shippingInfo } : undefined,
    deliveryMethod: deliveryMethod ?? undefined,
  });

  const confirmDeliveryAndProceed = () => {
    if (!customerExtra.cpf.trim() || !customerExtra.phone.trim()) {
      toast.error("Informe seu CPF e telefone para concluir o pedido.");
      return;
    }
    if (deliveryMethod === "shipping") {
      if (!shippingInfo.street || !shippingInfo.neighborhood || !shippingInfo.city || !shippingInfo.state || !shippingInfo.cep || !shippingInfo.shippingMethod) {
        toast.error("Preencha todos os campos de endereço.");
        return;
      }
    }
    setDeliveryDialogOpen(false);
    setPendingChannel(pendingAction);
    setOrderError(null);
    setConfirmOrderOpen(true);
  };

  // Actually submit the order — used by the confirmation dialog (with retry support)
  const submitOrder = async () => {
    setSubmittingOrder(true);
    setOrderError(null);
    try {
      // For PIX, defer order creation until receipt is uploaded in handleConfirmPix
      if (pendingChannel === "pix") {
        setConfirmOrderOpen(false);
        handlePixSelect();
        return;
      }

      // Card via InfinitePay: create order in DB, then call create-checkout edge function
      if (pendingChannel === "card") {
        if (!user) {
          setOrderError("Faça login para pagar com cartão.");
          return;
        }
        const orderItems = items.map((ci) => ({
          id: ci.item.id,
          name: ci.item.name,
          description: ci.item.description,
          language: ci.item.language ?? null,
          condition: ci.item.condition ?? null,
          quantity: ci.qty,
          unit_price: ci.item.price, // cartão usa preço cheio
          total_price: ci.item.price * ci.qty,
        }));
        const cardTotal = amountForChannel("card");
        const { data: orderRow, error: orderErr } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            items: orderItems as any,
            total: cardTotal,
            status: "pending_payment" as any,
            payment_method: "credit" as any,
            customer_info: buildCustomerInfo() as any,
          })
          .select("id")
          .single();
        if (orderErr || !orderRow) {
          setOrderError(orderErr?.message ?? "Falha ao criar pedido.");
          return;
        }
        const { data: checkoutData, error: fnErr } = await supabase.functions.invoke("create-checkout", {
          body: { order_id: orderRow.id },
        });
        if (fnErr || !checkoutData?.checkout_url) {
          setOrderError(fnErr?.message ?? "Falha ao gerar link de pagamento.");
          return;
        }
        setConfirmOrderOpen(false);
        window.location.href = checkoutData.checkout_url as string;
        return;
      }

      if (onOrderPlaced) {
        const result = await onOrderPlaced(items, amountForChannel("whatsapp"), {
          paymentMethod: "whatsapp",
          customerInfo: buildCustomerInfo(),
        });
        if (result === false) {
          setOrderError("Não foi possível confirmar a baixa de estoque do servidor. Tente reenviar ou volte ao carrinho.");
          return;
        }
      }
      setConfirmOrderOpen(false);
      const msg = buildMessage("whatsapp");
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    } catch (err: any) {
      setOrderError(err?.message ?? "Erro inesperado ao registrar pedido. Tente novamente.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleBuyWhatsApp = () => {
    const msg = buildMessage("whatsapp");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    if (onOrderPlaced) onOrderPlaced(items, amountForChannel("whatsapp"), { paymentMethod: "whatsapp" });
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
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { toast.error("Faça login para enviar o comprovante."); setUploadingReceipt(false); return; }
      const ext = receiptFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, receiptFile);
      if (uploadError) throw uploadError;
      const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(fileName, 60 * 60 * 24 * 7);
      const urlData = { publicUrl: signed?.signedUrl ?? "" };
      let msg = buildMessage("pix");
      msg += `\n\nPagamento via PIX confirmado!\nComprovante: ${urlData.publicUrl}`;
      if (onOrderPlaced) {
        const result = await onOrderPlaced(items, pixTotal, {
          paymentMethod: "pix",
          receiptUrl: urlData.publicUrl,
          customerInfo: buildCustomerInfo(),
        });
        if (result === false) {
          toast.error("Não foi possível registrar o pedido. Tente novamente.");
          return;
        }
      }
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
      setReceiptSent(true);
      toast.success("Comprovante enviado e pedido registrado!");
      setPixDialogOpen(false);
    } catch (err) {
      console.error("[PIX] Falha no checkout:", err);
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Erro: ${msg}` : "Erro ao enviar comprovante. Tente novamente.");
    }
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
                  // Linha do carrinho mostra preço cartão (cheio) e, se houver, o PIX como alternativa em destaque.
                  const cardLine = ci.item.price;
                  const pixBase = (ci.item.price_pix ?? 0) > 0 ? (ci.item.price_pix as number) : ci.item.price;
                  const pixLine = pixBase * (1 - discount / 100);
                  const showPix = pixLine < cardLine;
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
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onUpdateQty(ci.item.id, ci.qty - 1)} disabled={ci.qty <= 1} aria-label={`Diminuir quantidade de ${ci.item.name}`}><Minus className="h-3 w-3" aria-hidden="true" /></Button>
                            <span className="text-sm font-medium w-6 text-center" aria-label={`Quantidade: ${ci.qty}`}>{ci.qty}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onUpdateQty(ci.item.id, ci.qty + 1)} disabled={ci.qty >= ci.item.quantity} aria-label={`Aumentar quantidade de ${ci.item.name}`}><Plus className="h-3 w-3" aria-hidden="true" /></Button>
                          </div>
                          <div className="text-right">
                            {showPix && (
                              <span className="block text-sm font-bold text-success">PIX R$ {(pixLine * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            )}
                            <span className={`block ${showPix ? "text-[11px] text-muted-foreground" : "text-sm font-bold text-primary"}`}>
                              {showPix ? "Cartão " : ""}R$ {(cardLine * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(ci.item.id)} aria-label={`Remover ${ci.item.name} do carrinho`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary font-display">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <Button className="w-full gap-2 font-body" size="lg" onClick={() => openDeliveryDialog("card")}><CreditCard className="h-4 w-4" />Pagar com Cartão</Button>
                
                <Button variant="outline" className="w-full gap-2 font-body border-primary/30 hover:border-primary/60" size="lg" onClick={() => openDeliveryDialog("pix")}><QrCode className="h-4 w-4" />Pagar com PIX</Button>
                <Button variant="outline" className="w-full gap-2 font-body text-xs" size="sm" onClick={onClear}><Trash2 className="h-3.5 w-3.5" />Limpar carrinho</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Login Required Dialog */}
      <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" /> Faça login para finalizar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Para fechar a compra, registrar o pedido no seu histórico e enviar o comprovante PIX, você precisa estar logado.</p>
            <p className="text-xs">Seu carrinho será mantido após o login.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLoginPromptOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                try {
                  const guestCart = items.map((ci) => ({ inventory_item_id: ci.item.id, quantity: ci.qty }));
                  localStorage.setItem("spencer_guest_cart", JSON.stringify(guestCart));
                } catch {}
                setLoginPromptOpen(false);
                setOpen(false);
                const redirect = encodeURIComponent("/catalogo?openCart=1");
                navigate(`/conta/login?redirect=${redirect}`);
              }}
              className="gap-2"
            >
              <LogIn className="h-4 w-4" /> Ir para login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Confirmation Dialog (with retry/back-to-cart on failure) */}
      <Dialog open={confirmOrderOpen} onOpenChange={(o) => { if (!submittingOrder) setConfirmOrderOpen(o); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" /> Confirmar pedido?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span className="font-medium text-foreground">{totalItems}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span className="font-medium text-foreground">{deliveryMethod === "pickup" ? "Retirada" : "Envio"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Canal</span><span className="font-medium text-foreground">{pendingChannel === "pix" ? "PIX" : pendingChannel === "card" ? "Cartão" : "WhatsApp"}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5 mt-1.5"><span className="text-muted-foreground">Total{pendingChannel === "pix" ? " (PIX)" : ""}</span><span className="font-bold text-primary">R$ {amountForChannel(pendingChannel).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao confirmar, registramos seu pedido e damos baixa no estoque automaticamente.
              Em caso de falha, seus itens permanecem no carrinho.
            </p>
            {orderError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {orderError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => { setConfirmOrderOpen(false); setOrderError(null); }}
              disabled={submittingOrder}
            >
              Voltar ao carrinho
            </Button>
            <Button onClick={submitOrder} disabled={submittingOrder} className="gap-2">
              {submittingOrder ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
              ) : orderError ? (
                <><Send className="h-4 w-4" /> Reenviar pedido</>
              ) : (
                <><Check className="h-4 w-4" /> Confirmar pedido</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {deliveryMethod && (
              <div className="grid grid-cols-2 gap-2 animate-fade-in">
                <div>
                  <Label className="text-xs text-muted-foreground">CPF *</Label>
                  <Input placeholder="000.000.000-00" value={customerExtra.cpf} onChange={(e) => setCustomerExtra((p) => ({ ...p, cpf: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone *</Label>
                  <Input placeholder="(11) 99999-9999" value={customerExtra.phone} onChange={(e) => setCustomerExtra((p) => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
            )}

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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chave PIX (CNPJ)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-foreground bg-muted/50 px-3 py-2 rounded break-all">{PIX_KEY}</code>
                <Button size="sm" variant="outline" onClick={copyPixKey} className="shrink-0 gap-1"><Check className="h-3 w-3" /> Copiar</Button>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground">Valor a transferir</p>
              <p className="text-2xl font-bold text-primary font-display">R$ {pixTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
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
