import { useState } from "react";

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
      className={`relative overflow-visible ${containerClassName}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={src} alt={alt} className={className} />
      {hovered && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-6">
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-xl border-2 border-primary/30 shadow-2xl animate-scale-in"
          />
        </div>
      )}
    </div>
  );
};

export default ImageZoom;
