import { useState } from "react";
import { createPortal } from "react-dom";
import { SearchIcon, X } from "lucide-react";
import { buildImageVariants } from "@/lib/image-sources";

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const ImageZoom = ({ src, alt, className = "", containerClassName = "", onLoad, onError }: ImageZoomProps) => {
  const [open, setOpen] = useState(false);
  const variants = buildImageVariants(src);

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
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <picture>
            {variants.map((v) => (
              <source key={v.type} type={v.type} srcSet={v.src} />
            ))}
            <img
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-xl border border-border shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          </picture>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageZoom;
