import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ChevronLeft, Image, Video, Loader2, Music, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { useQueue } from "@/contexts/GenerationQueueContext";
import type { GenerationJob } from "@/hooks/use-generation-queue";

interface GenerationQueueSidebarProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const GenerationQueueSidebar = ({ open = false, onOpen, onClose }: GenerationQueueSidebarProps) => {
  const { jobs, activeCount } = useQueue();
  const [localOpen, setLocalOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const isOpen = open || localOpen;

  const handleOpen = () => { setOpenedAt(Date.now()); setLocalOpen(true); onOpen?.(); };
  const handleClose = () => { setLocalOpen(false); onClose?.(); };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; document.documentElement.style.overflow = ""; };
  }, [isOpen]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending": return "بالانتظار";
      case "running": return "جارٍ التوليد";
      case "succeeded": return "مكتمل";
      case "failed": return "فشل";
      case "timed_out": return "انتهى الوقت";
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "text-muted-foreground";
      case "running": return "text-primary";
      case "succeeded": return "text-green-400";
      case "failed": case "timed_out": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const typeIcon = (job: GenerationJob) => {
    if (job.status === "running" || job.status === "pending") return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    if (job.status === "succeeded") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (job.status === "failed" || job.status === "timed_out") return <XCircle className="w-4 h-4 text-destructive" />;
    if (job.file_type === "video") return <Video className="w-4 h-4 text-muted-foreground" />;
    if (job.file_type === "audio") return <Music className="w-4 h-4 text-muted-foreground" />;
    return <Image className="w-4 h-4 text-muted-foreground" />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} س`;
    return `${Math.floor(hours / 24)} ي`;
  };

  const sidebarLayer = (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="queue-sidebar-layer" className="fixed inset-0 z-50" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[6px]"
            onClick={() => { if (Date.now() - openedAt < 250) return; handleClose(); }}
          />
          <motion.aside dir="rtl"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
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
            <button onClick={handleClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-secondary/40 hover:bg-secondary/70 transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="px-5 pt-5 pb-2">
              <span className="text-[11px] font-bold text-muted-foreground tracking-wide">قيد التوليد</span>
            </div>

            <div className="flex-1 px-4 mt-3 overflow-y-auto scrollbar-hide">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-40">
                  <Layers className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-xs text-muted-foreground text-center">لا توجد عمليات توليد حالياً</p>
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-1">ستظهر هنا العمليات قيد الإنجاز</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <motion.div key={job.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="p-3 rounded-xl bg-secondary/30 border border-border/20"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {typeIcon(job)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground truncate" dir="ltr">
                            {job.prompt || job.tool_name || job.model}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-medium ${statusColor(job.status)}`}>
                              {job.status === "running" && job.metadata
                                ? ((job.metadata as any).phaseLabel || statusLabel(job.status))
                                : statusLabel(job.status)}
                            </span>
                            <span className="text-[9px] text-muted-foreground/50 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {timeAgo(job.created_at)}
                            </span>
                          </div>
                          {job.status === "failed" && job.error_message && (
                            <p className="text-[9px] text-destructive/80 mt-1 truncate">{job.error_message}</p>
                          )}
                          {job.status === "succeeded" && job.result_url && (
                            <a href={job.result_url} target="_blank" rel="noopener noreferrer"
                              className="text-[9px] text-primary flex items-center gap-0.5 mt-1 hover:underline">
                              <ExternalLink className="w-2.5 h-2.5" /> فتح النتيجة
                            </a>
                          )}
                        </div>
                      </div>

                      {(job.status === "running" || job.status === "pending") && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-secondary/60 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              animate={{ width: `${job.progress}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.4)" }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground font-medium w-7 text-left">{job.progress}%</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {jobs.length > 0 && (
              <div className="px-4 pb-8 pt-3">
                <p className="text-[10px] text-muted-foreground text-center">
                  {activeCount} عملية نشطة من {jobs.length}
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
      <button onClick={handleOpen} className="p-2 rounded-full hover:bg-secondary transition-colors relative">
        <Layers className="w-5 h-5 text-muted-foreground" />
        {activeCount > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
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
