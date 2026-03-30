import { useState } from "react";
import { createPortal } from "react-dom";

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

const ImageZoom = ({ src, alt, className = "", containerClassName = "" }: ImageZoomProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative ${containerClassName}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={src} alt={alt} className={className} />
      {hovered && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-background/60 backdrop-blur-sm">
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-xl border-2 border-primary/30 shadow-2xl animate-scale-in"
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageZoom;
