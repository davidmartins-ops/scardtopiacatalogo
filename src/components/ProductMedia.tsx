import { useState } from "react";
import { Package, ImageOff, AlertCircle } from "lucide-react";
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
  /** When true, applies a responsive min-height frame to prevent CLS. */
  reserveSpace?: boolean;
}

/**
 * Unified media block with loading / loaded / error / empty states.
 *
 * - Fixed responsive frame to prevent layout shift (CLS).
 * - Skeleton placeholder fades out when image loads (smooth fade + blur transition).
 * - <picture> with AVIF/WebP sources for modern formats, falling back to the original.
 * - Lazy + async decoding for performance.
 * - Subtle error state when the URL fails (expired token, network, etc.).
 * - Fallback art when no image was ever assigned to the product.
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
  reserveSpace = true,
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

  const frameClass = reserveSpace
    ? "min-h-[180px] sm:min-h-[260px] md:min-h-[320px]"
    : "";

  return (
    <div
      data-testid="product-media"
      className={`relative overflow-hidden bg-muted/20 ${frameClass} ${className}`}
    >
      {hasSrc && !errored && (
        <>
          <div
            data-testid="product-media-image"
            className={`absolute inset-0 transition-all duration-500 ease-out ${
              loaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-md scale-[1.02]"
            }`}
          >
            <ImageZoom
              src={src!}
              alt={alt}
              className={imageClassName}
              containerClassName={containerClassName}
              onLoad={() => setLoaded(true)}
              onError={handleError}
            />
          </div>
          {!loaded && (
            <Skeleton
              data-testid="product-media-skeleton"
              className="absolute inset-0 h-full w-full rounded-none"
            />
          )}
        </>
      )}
      {hasSrc && errored && (
        <div
          data-testid="product-media-error"
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center bg-muted/10"
        >
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Imagem indisponível</span>
          </div>
          <ImageOff className="h-8 w-8 opacity-50" />
          <p className="text-[11px] opacity-70">A imagem expirou ou não pôde ser carregada.</p>
        </div>
      )}
      {!hasSrc && (
        <div
          data-testid="product-media-fallback"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/20"
        >
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
