import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, SearchIcon, X } from "lucide-react";
import { buildImageVariants } from "@/lib/image-sources";

export interface ZoomGalleryImage {
  src: string;
  alt: string;
}

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
  /** Optional list of images to navigate between while the zoom is open. */
  gallery?: ZoomGalleryImage[];
}

const ImageZoom = ({ src, alt, className = "", containerClassName = "", onLoad, onError, gallery }: ImageZoomProps) => {
  const [open, setOpen] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const variants = buildImageVariants(src);

  const images: ZoomGalleryImage[] =
    gallery && gallery.length > 1 ? gallery : [{ src, alt }];
  const count = images.length;

  // Derive the starting position from the clicked image each time it opens.
  useEffect(() => {
    if (!open) return;
    setViewIndex((prev) => {
      const found = images.findIndex((i) => i.src === src);
      // Keep position while navigating within the same open session.
      if (found >= 0 && images[prev]?.src !== src && found !== prev) return found;
      return found >= 0 ? found : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = useCallback(
    (dir: 1 | -1) => {
      setViewIndex((i) => (i + dir + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (!open || count <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count, go]);

  const current = images[Math.min(viewIndex, count - 1)] ?? images[0];
  const currentVariants = buildImageVariants(current.src);

  return (
    <div className={`relative group/zoom ${containerClassName}`}>
      <picture>
        {variants.map((v) => (
          <source key={v.type} type={v.type} srcSet={v.src} />
        ))}
        <img
          src={src}
          alt={alt}
          className={className}
          loading="lazy"
          decoding="async"
          onLoad={onLoad}
          onError={onError}
        />
      </picture>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all opacity-0 group-hover/zoom:opacity-100 z-10 shadow-sm"
        aria-label="Ampliar imagem"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm cursor-pointer"
          onClick={() => setOpen(false)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || count <= 1) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
            touchStartX.current = null;
          }}
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10 shadow-md"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10 shadow-md"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card/90 border border-border text-xs font-medium text-foreground z-10">
                {viewIndex + 1} / {count}
              </div>
            </>
          )}

          <picture key={current.src}>
            {currentVariants.map((v) => (
              <source key={v.type} type={v.type} srcSet={v.src} />
            ))}
            <img
              src={current.src}
              alt={current.alt}
              className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-xl border border-border shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </picture>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageZoom;
