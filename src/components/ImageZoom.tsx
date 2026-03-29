import { useState, useRef } from "react";

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

const ImageZoom = ({ src, alt, className = "", containerClassName = "" }: ImageZoomProps) => {
  const [zoomed, setZoomed] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden cursor-crosshair ${containerClassName}`}
      onMouseEnter={() => setZoomed(true)}
      onMouseLeave={() => setZoomed(false)}
      onMouseMove={handleMouseMove}
    >
      <img src={src} alt={alt} className={className} />
      {zoomed && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "250%",
            backgroundPosition: `${pos.x}% ${pos.y}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
    </div>
  );
};

export default ImageZoom;
