import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useSpecialOrders } from "@/hooks/use-special-orders";
import { uploadSpecialOrderFile } from "@/hooks/use-special-order-attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Paperclip, Plus, Send, Trash2 } from "lucide-react";

const CATEGORIES = [
  { value: "action_figure", label: "Action Figure / Boneco" },
  { value: "card", label: "Carta / Single" },
  { value: "sealed", label: "Produto Lacrado" },
  { value: "accessory", label: "Acessório" },
  { value: "other", label: "Outro" },
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const itemSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do produto (mín. 3 caracteres)").max(160),
  category: z.string().min(1),
  quantity: z.number().int().min(1, "Quantidade mínima 1").max(50, "Quantidade máxima 50"),
  description: z.string().trim().max(1000, "Descrição muito longa (máx. 1000)"),
  referenceLink: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Link inválido (use http:// ou https://)"),
});

const formSchema = z.object({
  items: z.array(itemSchema).min(1),
  notes: z.string().trim().max(2000, "Observações muito longas (máx. 2000)"),
});

type ItemDraft = z.input<typeof itemSchema>;

const emptyItem = (): ItemDraft => ({
  name: "",
  category: "card",
  quantity: 1,
  description: "",
  referenceLink: "",
});

const STEPS = ["Itens", "Detalhes", "Revisão"];

const SpecialOrderRequestForm = ({ onDone }: { onDone?: () => void }) => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { createOrder } = useSpecialOrders();

  const [step, setStep] = useState(0);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const updateItem = (idx: number, field: keyof ItemDraft, value: string | number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const validate = () => {
    const parsed = formSchema.safeParse({ items, notes });
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message);
      setErrors([...new Set(messages)]);
      return null;
    }
    setErrors([]);
    return parsed.data;
  };

  const goNext = () => {
    if (step === 0 && !validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    const data = validate();
    if (!data) {
      setStep(0);
      return;
    }
    if (!user) {
      navigate("/conta/login?redirect=/encomendas");
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setErrors(["O anexo deve ter no máximo 5 MB."]);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder.mutateAsync({
        source: "customer_request",
        items: data.items.map((it) => ({
          item_type: "quotation" as const,
          name: it.name,
          description: it.description,
          quantity: it.quantity,
          reference_links: it.referenceLink ? [it.referenceLink] : undefined,
        })),
        notes: data.notes,
      });

      if (file || data.notes) {
        try {
          const filePath = file ? await uploadSpecialOrderFile(user.id, result.id, file) : null;
          await supabase.from("special_order_attachments").insert({
            special_order_id: result.id,
            user_id: user.id,
            description: data.notes || null,
            file_path: filePath,
            file_name: file?.name ?? null,
          });
        } catch (e) {
          console.error("attachment upload failed", e);
          toast.warning("Solicitação criada, mas o anexo não pôde ser enviado. Tente anexar novamente nos detalhes.");
        }
      }

      toast.success("Solicitação enviada! Você receberá as atualizações por e-mail.");
      setItems([emptyItem()]);
      setNotes("");
      setFile(null);
      setStep(0);
      onDone?.();
      navigate(`/conta/encomendas/${result.id}?novo=1`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((label, idx) => (
          <Badge
            key={label}
            variant={idx === step ? "default" : "outline"}
            className={idx < step ? "opacity-70" : ""}
          >
            {idx + 1}. {label}
          </Badge>
        ))}
      </div>

      {errors.length > 0 && (
        <ul className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {step === 0 && (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Item {idx + 1}</p>
                {items.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    aria-label={`Remover item ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <Label>Nome do produto *</Label>
                <Input
                  value={item.name}
                  maxLength={160}
                  onChange={(e) => updateItem(idx, "name", e.target.value)}
                  placeholder="Ex: Funko Pop! Chandra Nalaar"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={item.category}
                    onValueChange={(v) => updateItem(idx, "category", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div>
                <Label>Descrição / detalhes</Label>
                <Textarea
                  value={item.description}
                  maxLength={1000}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="Edição, idioma, condição, tamanho, cor..."
                />
              </div>
              <div>
                <Label>Link de referência (opcional)</Label>
                <Input
                  value={item.referenceLink}
                  maxLength={500}
                  onChange={(e) => updateItem(idx, "referenceLink", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-1"
            onClick={() => setItems([...items, emptyItem()])}
          >
            <Plus className="h-4 w-4" /> Adicionar outro item
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label>Observações gerais</Label>
            <Textarea
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Prazo desejado, preferência de envio, dúvidas..."
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Anexo (opcional — imagem ou PDF, até 5 MB)
            </Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border p-3 space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {it.quantity}× {it.name || "(sem nome)"}
                  </p>
                  {it.description && (
                    <p className="text-xs text-muted-foreground">{it.description}</p>
                  )}
                  {it.referenceLink && (
                    <p className="text-xs text-primary break-all">{it.referenceLink}</p>
                  )}
                </div>
                <Badge variant="outline">Sob cotação</Badge>
              </div>
            ))}
          </div>
          {notes && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Observações: </span>
              {notes}
            </p>
          )}
          {file && (
            <p className="text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> {file.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Nossa equipe avaliará disponibilidade, preço e prazo e você receberá a cotação por
            e-mail e no histórico abaixo.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {step > 0 && (
          <Button type="button" variant="outline" className="gap-1" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1 gap-1" onClick={goNext}>
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1 gap-1"
            onClick={handleSubmit}
            disabled={submitting || createOrder.isPending}
          >
            {(submitting || createOrder.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" /> Enviar solicitação
          </Button>
        )}
      </div>
    </div>
  );
};

export default SpecialOrderRequestForm;
