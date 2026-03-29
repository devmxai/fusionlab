import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { downloadMediaWithFallback } from "@/lib/download-media";

interface ImageViewerProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
  type?: "image" | "video" | "audio";
}

const ImageViewer = ({ src, alt = "Result", open, onClose, type = "image" }: ImageViewerProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const isMobile = useIsMobile();

  // Reset zoom/position whenever viewer opens or src changes
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setDragging(false);
      setEntered(false);
      // Allow entrance animation to finish before enabling zoom
      const t = setTimeout(() => setEntered(true), 350);
      return () => clearTimeout(t);
    }
  }, [open, src]);

  const reset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    startPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y });
  };

  const handlePointerUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 5));
  };

  const handleDoubleTap = () => {
    if (scale > 1) reset();
    else setScale(2.5);
  };

  // Pinch-to-zoom for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartScale.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDist.current;
      setScale(Math.min(Math.max(pinchStartScale.current * ratio, 0.5), 5));
    }
  };

  const handleDownload = async () => {
    const ext = type === "video" ? "mp4" : "png";
    await downloadMediaWithFallback(src, `result.${ext}`);
  };

  const isVideo = type === "video";

  const layer = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-xl flex flex-col"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Content area */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden touch-none select-none p-4"
            onWheel={!isVideo ? handleWheel : undefined}
            onDoubleClick={!isVideo ? handleDoubleTap : undefined}
            onTouchStart={!isVideo ? handleTouchStart : undefined}
            onTouchMove={!isVideo ? handleTouchMove : undefined}
          >
            {isVideo ? (
              <motion.video
                src={src}
                controls
                autoPlay
                playsInline
                className="max-w-[92vw] max-h-[78vh] rounded-2xl bg-black"
                style={{ objectFit: "contain" }}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            ) : (
              <motion.img
                src={src}
                alt={alt}
                className="max-w-[92vw] max-h-[78vh] object-contain rounded-xl"
                style={{
                  cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
                }}
                // Use animate for both entrance and zoom state
                initial={{ scale: 0.85, opacity: 0, x: 0, y: 0 }}
                animate={{
                  scale: entered ? scale : 1,
                  opacity: 1,
                  x: entered ? position.x : 0,
                  y: entered ? position.y : 0,
                }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={entered
                  ? { type: "tween", duration: 0.1 }
                  : { type: "spring", stiffness: 300, damping: 25 }
                }
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                draggable={false}
              />
            )}
          </div>

          {/* Bottom bar */}
          <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-4 pb-6">
            {!isVideo && !isMobile && (
              <>
                <button onClick={() => setScale((s) => Math.max(s - 0.5, 0.5))} className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors">
                  <ZoomOut className="w-4 h-4 text-foreground" />
                </button>
                <span className="text-[10px] text-muted-foreground min-w-[36px] text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale((s) => Math.min(s + 0.5, 5))} className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors">
                  <ZoomIn className="w-4 h-4 text-foreground" />
                </button>
                <button onClick={reset} className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors">
                  <RotateCcw className="w-4 h-4 text-foreground" />
                </button>
                <div className="w-px h-6 bg-border/30 mx-1" />
              </>
            )}
            <button onClick={handleDownload} className="h-10 px-5 rounded-full bg-primary flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
              <Download className="w-4 h-4 text-primary-foreground" />
              <span className="text-sm font-semibold text-primary-foreground">تحميل</span>
            </button>
            <button onClick={onClose} className="h-10 px-5 rounded-full bg-secondary/80 flex items-center justify-center gap-2 hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">إغلاق</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof window === "undefined") return null;
  return createPortal(layer, document.body);
};

export default ImageViewer;
