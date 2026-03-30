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
    <>
      <div
        className={`relative overflow-hidden ${containerClassName}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img src={src} alt={alt} className={className} />
      </div>
      {hovered && (
        <div
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center pointer-events-none p-4"
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain rounded-xl border border-border shadow-2xl animate-scale-in"
          />
        </div>
      )}
    </>
  );
};

export default ImageZoom;
