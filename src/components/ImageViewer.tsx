import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageViewerProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

const ImageViewer = ({ src, alt = "Result", open, onClose }: ImageViewerProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

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
    if (scale > 1) {
      reset();
    } else {
      setScale(2.5);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <X className="w-4 h-4 text-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setScale((s) => Math.max(s - 0.5, 0.5))} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <ZoomOut className="w-3.5 h-3.5 text-foreground" />
              </button>
              <span className="text-[10px] text-muted-foreground min-w-[36px] text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale((s) => Math.min(s + 0.5, 5))} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <ZoomIn className="w-3.5 h-3.5 text-foreground" />
              </button>
              <button onClick={reset} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>
            <a href={src} target="_blank" rel="noopener noreferrer" download className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Download className="w-4 h-4 text-primary-foreground" />
            </a>
          </div>

          {/* Image area */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden touch-none select-none"
            onWheel={handleWheel}
            onDoubleClick={handleDoubleTap}
          >
            <motion.img
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
              style={{
                scale,
                x: position.x,
                y: position.y,
                cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              draggable={false}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageViewer;
