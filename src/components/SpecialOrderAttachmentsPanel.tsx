import { useState } from "react";
import { toast } from "sonner";
import {
  useSpecialOrderAttachments,
  useSpecialOrderAttachmentUrl,
  type SpecialOrderAttachment,
} from "@/hooks/use-special-order-attachments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Loader2, Paperclip, Trash2 } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const AttachmentLink = ({ attachment }: { attachment: SpecialOrderAttachment }) => {
  const { data: url, isLoading } = useSpecialOrderAttachmentUrl(attachment.file_path);
  if (!attachment.file_path) return null;
  if (isLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (!url) return <span className="text-xs text-muted-foreground">Anexo indisponível</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
    >
      <Paperclip className="h-3 w-3" />
      {attachment.file_name ?? "Ver anexo"}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
};

const SpecialOrderAttachmentsPanel = ({
  specialOrderId,
  readOnly = false,
}: {
  specialOrderId?: string;
  readOnly?: boolean;
}) => {
  const { attachments, isLoading, isError, refetch, addAttachment, removeAttachment } =
    useSpecialOrderAttachments(specialOrderId);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleAdd = async () => {
    if (!description.trim() && !file) {
      toast.error("Escreva um detalhe ou selecione um arquivo.");
      return;
    }
    if (description.trim().length > 2000) {
      toast.error("Descrição muito longa (máx. 2000 caracteres).");
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      toast.error("O anexo deve ter no máximo 5 MB.");
      return;
    }
    try {
      await addAttachment.mutateAsync({ description, file });
      setDescription("");
      setFile(null);
      toast.success("Detalhe adicionado à encomenda.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao anexar.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Detalhes e anexos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label>Novo detalhe</Label>
              <Textarea
                value={description}
                maxLength={2000}
                placeholder="Comprovante, referência, ajuste no pedido..."
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Arquivo (imagem ou PDF, até 5 MB)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              size="sm"
              className="gap-1"
              onClick={handleAdd}
              disabled={addAttachment.isPending}
            >
              {addAttachment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Não foi possível carregar os anexos desta encomenda.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum detalhe adicional enviado.</p>
        ) : (
          <ul className="space-y-3">
            {attachments.map((att) => (
              <li key={att.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    {att.description && (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{att.description}</p>
                    )}
                    <AttachmentLink attachment={att} />
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(att.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      aria-label="Remover anexo"
                      onClick={() => removeAttachment.mutate(att)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SpecialOrderAttachmentsPanel;
