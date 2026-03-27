import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ChevronLeft, Image, Video, Loader2, Music, CheckCircle2, XCircle, Clock, Eye, X } from "lucide-react";
import { useQueue } from "@/contexts/GenerationQueueContext";
import type { GenerationJob } from "@/hooks/use-generation-queue";
import ImageViewer from "@/components/ImageViewer";

interface GenerationQueueSidebarProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const GenerationQueueSidebar = ({ open = false, onOpen, onClose }: GenerationQueueSidebarProps) => {
  const { jobs, activeCount, unseenCount, markJobSeen } = useQueue();
  const [localOpen, setLocalOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const [previewJob, setPreviewJob] = useState<GenerationJob | null>(null);
  const isOpen = open || localOpen;

  // Only show active + unseen jobs (smart inbox)
  const visibleJobs = jobs.filter((j) => {
    if (j.status === "pending" || j.status === "running") return true;
    if ((j.status === "succeeded" || j.status === "failed" || j.status === "timed_out") && !j.seen_at) return true;
    return false;
  });

  const badgeCount = activeCount + unseenCount;

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

  const statusLabel = (j: GenerationJob) => {
    if (j.status === "succeeded" && !j.seen_at) return "جاهزة للعرض";
    if (j.status === "failed" && !j.seen_at) return "فشل";
    if (j.status === "timed_out" && !j.seen_at) return "انتهى الوقت";
    if (j.status === "running") return "جارٍ التوليد";
    if (j.status === "pending") return "بالانتظار";
    return j.status;
  };

  const statusColor = (j: GenerationJob) => {
    if (j.status === "succeeded" && !j.seen_at) return "text-green-400 font-bold";
    if (j.status === "failed" || j.status === "timed_out") return "text-destructive font-bold";
    if (j.status === "running") return "text-primary";
    return "text-muted-foreground";
  };

  const typeIcon = (job: GenerationJob) => {
    if (job.status === "running" || job.status === "pending") return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    if (job.status === "succeeded" && !job.seen_at) return <CheckCircle2 className="w-4 h-4 text-green-400" />;
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

  const handleJobClick = async (job: GenerationJob) => {
    if (job.status === "succeeded" && !job.seen_at && job.result_url) {
      // Open preview modal instead of raw link
      setPreviewJob(job);
    } else if ((job.status === "failed" || job.status === "timed_out") && !job.seen_at) {
      // Acknowledge failed job
      await markJobSeen(job.id);
    }
  };

  const handlePreviewClose = async () => {
    if (previewJob && !previewJob.seen_at) {
      await markJobSeen(previewJob.id);
    }
    setPreviewJob(null);
  };

  const sortedJobs = [...visibleJobs].sort((a, b) => {
    const priority = (j: GenerationJob) => {
      if (j.status === "pending" || j.status === "running") return 0;
      if (j.status === "succeeded" && !j.seen_at) return 1;
      return 2;
    };
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const previewType = previewJob?.file_type === "video" ? "video" : previewJob?.file_type === "audio" ? "audio" : "image";

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

            <div className="px-5 pt-5 pb-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground tracking-wide">قيد التوليد</span>
              {unseenCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[9px] font-bold">
                  {unseenCount} جديد
                </span>
              )}
            </div>

            <div className="flex-1 px-4 mt-3 overflow-y-auto scrollbar-hide">
              {sortedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-40">
                  <Layers className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-xs text-muted-foreground text-center">لا توجد عمليات حالياً</p>
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-1">ستظهر هنا العمليات قيد الإنجاز</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedJobs.map((job) => {
                    const isUnseen = (job.status === "succeeded" || job.status === "failed" || job.status === "timed_out") && !job.seen_at;
                    const isClickable = isUnseen;

                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        layout
                        className={`p-3 rounded-xl border transition-all ${
                          job.status === "succeeded" && isUnseen
                            ? "bg-green-500/5 border-green-500/30"
                            : isUnseen
                            ? "bg-destructive/5 border-destructive/30"
                            : "bg-secondary/30 border-border/20"
                        } ${isClickable ? "cursor-pointer hover:bg-secondary/50 active:scale-[0.98]" : ""}`}
                        onClick={() => isClickable && handleJobClick(job)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            job.status === "succeeded" && isUnseen ? "bg-green-500/10" :
                            isUnseen ? "bg-destructive/10" : "bg-secondary/60"
                          }`}>
                            {typeIcon(job)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-foreground truncate" dir="ltr">
                              {job.tool_name || job.prompt || job.model}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] ${statusColor(job)}`}>
                                {job.status === "running" && job.metadata
                                  ? ((job.metadata as any).phaseLabel || statusLabel(job))
                                  : statusLabel(job)}
                              </span>
                              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {timeAgo(job.created_at)}
                              </span>
                            </div>
                          </div>

                          {job.status === "succeeded" && isUnseen && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Eye className="w-3 h-3 text-green-400" />
                              <span className="text-[8px] text-green-400 font-bold">عرض</span>
                            </div>
                          )}
                          {(job.status === "failed" || job.status === "timed_out") && isUnseen && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleJobClick(job); }}
                              className="flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 transition-colors"
                            >
                              <X className="w-3 h-3 text-destructive" />
                              <span className="text-[8px] text-destructive font-bold">تجاهل</span>
                            </button>
                          )}
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
                    );
                  })}
                </div>
              )}
            </div>

            {visibleJobs.length > 0 && (
              <div className="px-4 pb-8 pt-3">
                <p className="text-[10px] text-muted-foreground text-center">
                  {activeCount > 0 && `${activeCount} نشطة`}
                  {activeCount > 0 && unseenCount > 0 && " · "}
                  {unseenCount > 0 && `${unseenCount} جديدة`}
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
        {badgeCount > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
              unseenCount > 0
                ? "bg-green-500 text-white"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {badgeCount}
          </motion.span>
        )}
      </button>
      {typeof window !== "undefined" ? createPortal(sidebarLayer, document.body) : null}
      <ImageViewer
        src={previewJob?.result_url || ""}
        open={!!previewJob && !!previewJob.result_url}
        onClose={handlePreviewClose}
        type={previewType}
      />
    </>
  );
};

export default GenerationQueueSidebar;
