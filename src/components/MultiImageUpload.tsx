import { useCallback, useId, useRef, useState } from "react";
import { Upload, X, RotateCw, GripVertical, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { validateImageFile, compressToWebp, ACCEPTED_TYPES } from "@/lib/image-compression";
import { uploadProductImageWithProgress } from "@/lib/storage";
import { toast } from "sonner";

export type UploadedImage = {
  id: string;
  url: string;
  alt?: string;
};

type PendingItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "compressing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  url?: string;
};

interface MultiImageUploadProps {
  /** Existing images already saved (with stable IDs and URLs). */
  value?: UploadedImage[];
  /** Called when a new image finishes uploading — caller persists it. */
  onUploaded?: (image: UploadedImage, index: number) => void | Promise<void>;
  /** Called when user removes an existing image. */
  onRemove?: (image: UploadedImage) => void | Promise<void>;
  /** Called when user reorders existing images (full new order). */
  onReorder?: (images: UploadedImage[]) => void | Promise<void>;
  maxImages?: number;
  className?: string;
  label?: string;
}

const MAX_DEFAULT = 10;

const MultiImageUpload = ({
  value = [],
  onUploaded,
  onRemove,
  onReorder,
  maxImages = MAX_DEFAULT,
  className,
  label = "Imagens",
}: MultiImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const liveRegionId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalCount = value.length + pending.filter((p) => p.status !== "done" && p.status !== "error").length;

  const announce = useCallback((msg: string) => {
    const el = document.getElementById(liveRegionId);
    if (el) el.textContent = msg;
  }, [liveRegionId]);

  const processFile = useCallback(async (item: PendingItem) => {
    setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "compressing", progress: 5 } : p)));
    try {
      const compressed = await compressToWebp(item.file);
      setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "uploading", progress: 15 } : p)));
      const url = await uploadProductImageWithProgress(compressed, (pct) => {
        setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, progress: Math.max(p.progress, pct) } : p)));
      });
      setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "done", progress: 100, url } : p)));
      announce(`Imagem ${item.file.name} enviada com sucesso.`);
      const newImage: UploadedImage = { id: crypto.randomUUID(), url, alt: item.file.name };
      await onUploaded?.(newImage, value.length);
      // Auto-clean the pending item once persisted
      setTimeout(() => {
        setPending((prev) => prev.filter((p) => p.id !== item.id));
        URL.revokeObjectURL(item.previewUrl);
      }, 800);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Falha desconhecida";
      setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: reason } : p)));
      announce(`Erro ao enviar ${item.file.name}: ${reason}`);
    }
  }, [announce, onUploaded, value.length]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) {
      toast.info("Nenhum arquivo selecionado.");
      return;
    }
    const remainingSlots = Math.max(0, maxImages - totalCount);
    if (remainingSlots === 0) {
      toast.error(`Limite de ${maxImages} imagens atingido.`);
      return;
    }
    const accepted: PendingItem[] = [];
    let rejected = 0;
    for (const file of files.slice(0, remainingSlots)) {
      const v = validateImageFile(file);
      if (v.ok !== true) {
        rejected++;
        toast.error(`${file.name}: ${(v as { ok: false; reason: string }).reason}`);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
      });
    }
    if (files.length > remainingSlots) {
      toast.warning(`Apenas ${remainingSlots} imagem(ns) adicionada(s). Limite: ${maxImages}.`);
    }
    if (accepted.length === 0) return;
    setPending((prev) => [...prev, ...accepted]);
    announce(`${accepted.length} imagem(ns) na fila${rejected ? `, ${rejected} rejeitada(s)` : ""}.`);
    // Kick off uploads
    accepted.forEach(processFile);
  }, [announce, maxImages, processFile, totalCount]);

  const retryItem = (id: string) => {
    const item = pending.find((p) => p.id === id);
    if (!item) return;
    processFile({ ...item, status: "queued", progress: 0, error: undefined });
  };

  const cancelPending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.findIndex((i) => i.id === active.id);
    const newIndex = value.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(value, oldIndex, newIndex);
    await onReorder?.(reordered);
    announce(`Ordem atualizada: ${reordered.length} imagens.`);
  };

  const overallProgress = pending.length === 0
    ? 0
    : Math.round(pending.reduce((sum, p) => sum + p.progress, 0) / pending.length);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Live region for screen readers */}
      <div id={liveRegionId} aria-live="polite" aria-atomic="true" className="sr-only" />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {value.length}/{maxImages}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed transition-colors p-4 text-center",
          isDragOver ? "border-primary bg-primary/5" : "border-border bg-muted/10 hover:border-primary/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="sr-only"
          id={`${liveRegionId}-input`}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <label htmlFor={`${liveRegionId}-input`} className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <Upload className="h-6 w-6" aria-hidden="true" />
          <span className="text-sm font-medium">Selecione imagens ou arraste e solte aqui</span>
          <span className="text-xs">JPG, PNG ou WebP — máx. 5MB cada — até {maxImages} imagens</span>
        </label>
      </div>

      {/* Overall progress */}
      {pending.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Enviando {pending.length} arquivo(s)</span>
            <span className="font-medium text-foreground">{overallProgress}% concluído</span>
          </div>
          <Progress
            value={overallProgress}
            aria-label="Progresso total do envio"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress}
            className="h-2"
          />
        </div>
      )}

      {/* Pending uploads grid */}
      {pending.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Arquivos em envio">
          {pending.map((p) => (
            <PendingTile key={p.id} item={p} onRetry={() => retryItem(p.id)} onCancel={() => cancelPending(p.id)} />
          ))}
        </div>
      )}

      {/* Saved images — sortable */}
      {value.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={value.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Imagens salvas — arraste para reordenar">
              {value.map((img, idx) => (
                <SortableTile key={img.id} image={img} index={idx} onRemove={() => onRemove?.(img)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

const PendingTile = ({ item, onRetry, onCancel }: { item: PendingItem; onRetry: () => void; onCancel: () => void }) => {
  const statusLabel: Record<PendingItem["status"], string> = {
    queued: "Na fila",
    compressing: "Otimizando",
    uploading: "Enviando",
    done: "Concluído",
    error: "Erro",
  };
  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20 aspect-square">
      <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 p-2">
        {item.status === "error" ? (
          <>
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
            <span className="text-[10px] text-center text-foreground line-clamp-2">{item.error}</span>
            <div className="flex gap-1 mt-1">
              <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={onRetry} aria-label={`Tentar novamente ${item.file.name}`}>
                <RotateCw className="h-3 w-3" /> Tentar
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCancel} aria-label={`Cancelar ${item.file.name}`}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </>
        ) : item.status === "done" ? (
          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden="true" />
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-[10px] text-foreground">{statusLabel[item.status]}</span>
            <span className="text-[10px] font-medium text-foreground">{item.progress}%</span>
          </>
        )}
      </div>
    </div>
  );
};

const SortableTile = ({ image, index, onRemove }: { image: UploadedImage; index: number; onRemove: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg overflow-hidden border border-border bg-muted/20 aspect-square group",
        isDragging && "opacity-60 ring-2 ring-primary",
      )}
      aria-grabbed={isDragging}
    >
      <img src={image.url} alt={image.alt || `Imagem ${index + 1}`} className="w-full h-full object-cover pointer-events-none" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 h-6 w-6 rounded bg-background/80 hover:bg-background text-foreground flex items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Reordenar imagem ${index + 1}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Remover imagem ${index + 1}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 text-[10px] font-medium text-foreground">
        #{index + 1}
      </span>
    </div>
  );
};

export default MultiImageUpload;
