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
        <div className="absolute z-[60] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-scale-in">
          <img
            src={src}
            alt={alt}
            className="w-[500px] sm:w-[700px] h-auto object-contain rounded-xl border-2 border-primary/30 shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default ImageZoom;
