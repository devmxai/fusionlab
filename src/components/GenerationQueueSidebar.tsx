import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ChevronLeft, Image, Video, Loader2 } from "lucide-react";

export interface QueueItem {
  id: string;
  prompt: string;
  progress: number;
  status: "pending" | "generating" | "done" | "error";
  type?: "image" | "video" | "audio";
}

interface GenerationQueueSidebarProps {
  items: QueueItem[];
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const GenerationQueueSidebar = ({ items, open = false, onOpen, onClose }: GenerationQueueSidebarProps) => {
  const [localOpen, setLocalOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const isOpen = open || localOpen;
  const activeCount = items.filter((i) => i.status === "generating" || i.status === "pending").length;

  const handleOpen = () => {
    setOpenedAt(Date.now());
    setLocalOpen(true);
    onOpen?.();
  };

  const handleClose = () => {
    setLocalOpen(false);
    onClose?.();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  const statusLabel = (s: QueueItem["status"]) => {
    switch (s) {
      case "pending": return "بالانتظار";
      case "generating": return "جارٍ التوليد";
      case "done": return "مكتمل";
      case "error": return "فشل";
    }
  };

  const statusColor = (s: QueueItem["status"]) => {
    switch (s) {
      case "pending": return "text-muted-foreground";
      case "generating": return "text-primary";
      case "done": return "text-green-400";
      case "error": return "text-destructive";
    }
  };

  const sidebarLayer = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="queue-sidebar-layer"
          className="fixed inset-0 z-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[6px]"
            onClick={handleClose}
          />

          <motion.aside
            dir="rtl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute top-0 left-0 h-full w-[300px] flex flex-col overflow-y-auto overflow-x-hidden touch-auto"
            style={{
              background: "linear-gradient(180deg, hsl(240 15% 8% / 0.97) 0%, hsl(240 12% 5% / 0.99) 100%)",
              backdropFilter: "blur(40px)",
              borderRight: "1px solid hsl(var(--border) / 0.3)",
              borderTopRightRadius: "24px",
              borderBottomRightRadius: "24px",
              WebkitOverflowScrolling: "touch",
            }}
            onTouchMove={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-secondary/40 hover:bg-secondary/70 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="px-5 pt-5 pb-2">
              <span className="text-[11px] font-bold text-muted-foreground tracking-wide">قيد التوليد</span>
            </div>

            <div className="flex-1 px-4 mt-3 overflow-y-auto scrollbar-hide">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-40">
                  <Layers className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-xs text-muted-foreground text-center">لا توجد عمليات توليد حالياً</p>
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-1">ستظهر هنا العمليات قيد الإنجاز</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 rounded-xl bg-secondary/30 border border-border/20"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {item.status === "generating" ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : item.type === "video" ? (
                            <Video className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Image className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground truncate" dir="ltr">{item.prompt}</p>
                          <span className={`text-[9px] font-medium ${statusColor(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </div>
                      </div>

                      {(item.status === "generating" || item.status === "pending") && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-secondary/60 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              transition={{ duration: 0.5 }}
                              style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.4)" }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground font-medium w-7 text-left">{item.progress}%</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="px-4 pb-8 pt-3">
                <p className="text-[10px] text-muted-foreground text-center">
                  {activeCount} عملية نشطة من {items.length}
                </p>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 rounded-full hover:bg-secondary transition-colors relative"
      >
        <Layers className="w-5 h-5 text-muted-foreground" />
        {activeCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center"
          >
            {activeCount}
          </motion.span>
        )}
      </button>

      {typeof window !== "undefined" ? createPortal(sidebarLayer, document.body) : null}
    </>
  );
};

export default GenerationQueueSidebar;
