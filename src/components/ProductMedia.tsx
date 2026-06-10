import { useState } from "react";
import { Package, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import placeholderImg from "/placeholder.svg";
import ImageZoom from "@/components/ImageZoom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  src?: string | null;
  alt: string;
  itemId: string;
  itemName?: string;
  category?: string | null;
  className?: string;
  imageClassName?: string;
  containerClassName?: string;
}

/**
 * Unified media block with loading / loaded / error / empty states.
 * On image error, runs HEAD diagnostic (empty src, HTTP status, network/CORS)
 * and logs both to console and analytics_events.
 */
const ProductMedia = ({
  src,
  alt,
  itemId,
  itemName,
  category,
  className = "",
  imageClassName = "w-full h-full object-contain",
  containerClassName = "w-full h-full",
}: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const hasSrc = !!src;

  const handleError = async () => {
    setErrored(true);
    let diagnosis = "unknown";
    try {
      if (!src) diagnosis = "empty_src";
      else {
        const res = await fetch(src, { method: "HEAD", mode: "cors" });
        diagnosis = `http_${res.status}`;
      }
    } catch (e) {
      diagnosis = `network_or_cors:${(e as Error).message}`;
    }
    console.warn("[ProductMedia] image failed", { src, id: itemId, diagnosis });
    try {
      await supabase.from("analytics_events").insert({
        event_type: "image_load_error",
        inventory_item_id: itemId,
        item_name: itemName,
        category: category,
        metadata: { src, diagnosis } as any,
      } as any);
    } catch {}
  };

  return (
    <div className={`relative overflow-hidden bg-muted/20 ${className}`}>
      {hasSrc && !errored && (
        <>
          <ImageZoom
            src={src!}
            alt={alt}
            className={imageClassName}
            containerClassName={containerClassName}
            onLoad={() => setLoaded(true)}
            onError={handleError}
          />
          {!loaded && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          )}
        </>
      )}
      {hasSrc && errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
          <ImageOff className="h-10 w-10" />
          <p className="text-xs">Não foi possível carregar a imagem.</p>
        </div>
      )}
      {!hasSrc && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/20">
          <img
            src={placeholderImg}
            alt={alt || "Imagem indisponível"}
            className="h-2/3 w-2/3 object-contain opacity-60"
            loading="lazy"
            decoding="async"
          />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-4 w-4" />
            <p className="text-xs">Sem imagem cadastrada</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMedia;
