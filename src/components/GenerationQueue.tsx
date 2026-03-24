import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, X } from "lucide-react";

export interface QueueItem {
  id: string;
  prompt: string;
  progress: number;
  status: "pending" | "generating" | "done" | "error";
}

interface GenerationQueueProps {
  items: QueueItem[];
}

const GenerationQueue = ({ items }: GenerationQueueProps) => {
  const [open, setOpen] = useState(false);
  const activeCount = items.filter((i) => i.status === "generating" || i.status === "pending").length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full hover:bg-secondary transition-colors relative"
      >
        <Layers className="w-5 h-5 text-muted-foreground" />
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-64 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl p-3 shadow-2xl z-50"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-foreground">قيد التوليد</span>
              <button onClick={() => setOpen(false)} className="p-0.5">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-3">لا توجد عمليات حالياً</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                {items.map((item) => (
                  <div key={item.id} className="bg-secondary/50 rounded-lg p-2">
                    <p className="text-[10px] text-foreground truncate mb-1" dir="ltr">
                      {item.prompt}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{item.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GenerationQueue;
