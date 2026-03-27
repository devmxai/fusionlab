import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Download, Trash2, Sparkles, Image as ImageIcon, Video, Music } from "lucide-react";
import { toast } from "sonner";
import ImageViewer from "@/components/ImageViewer";

interface Generation {
  id: string;
  tool_id: string;
  tool_name: string | null;
  prompt: string | null;
  file_url: string;
  file_type: string;
  created_at: string;
}

const fileTypeIcon = (type: string) => {
  if (type === "video") return Video;
  if (type === "audio") return Music;
  return ImageIcon;
};

const LibraryPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Generation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", user.id)
        .neq("file_type", "audio")
        .order("created_at", { ascending: false });
      setItems((data as Generation[]) || []);
      setFetching(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-primary animate-pulse" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("فشل في التحميل");
    }
  };

  const handleDelete = async (item: Generation) => {
    setDeletingId(item.id);
    try {
      // Extract file path from URL for storage deletion
      const urlParts = item.file_url.split("/generations/");
      if (urlParts[1]) {
        await supabase.storage.from("generations").remove([decodeURIComponent(urlParts[1])]);
      }

      await supabase.from("generations").delete().eq("id", item.id);
      setItems((prev) => prev.filter((g) => g.id !== item.id));
      toast.success("تم الحذف");
    } catch {
      toast.error("فشل في الحذف");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">المكتبة</h1>
          <span className="text-[10px] text-muted-foreground mr-auto">{items.length} عنصر</span>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4 max-w-4xl mx-auto">
        {fetching ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-secondary/40 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد عناصر في المكتبة</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">ستظهر هنا جميع الصور والفيديوهات التي تقوم بتوليدها</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <AnimatePresence>
              {items.map((item, i) => {
                const Icon = fileTypeIcon(item.file_type);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="relative group rounded-xl overflow-hidden bg-secondary/30 border border-border/20"
                  >
                    {/* Thumbnail */}
                    {item.file_type === "image" ? (
                      <img
                        src={item.file_url}
                        alt={item.prompt || ""}
                        className="w-full aspect-square object-cover cursor-pointer"
                        loading="lazy"
                        onClick={() => setViewerUrl(item.file_url)}
                      />
                    ) : (
                      <div
                        className="w-full aspect-square flex items-center justify-center bg-secondary/50 cursor-pointer"
                        onClick={() => item.file_type === "image" && setViewerUrl(item.file_url)}
                      >
                        <Icon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                      {/* Tool name */}
                      <div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                          {item.tool_name || item.tool_id}
                        </span>
                      </div>

                      {/* Prompt preview */}
                      {item.prompt && (
                        <p className="text-[9px] text-white/70 line-clamp-2 leading-relaxed" dir="ltr">
                          {item.prompt}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item.file_url, `${item.tool_id}-${item.id.slice(0, 6)}.png`);
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/40 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Image Viewer */}
      {viewerUrl && (
        <ImageViewer src={viewerUrl} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
      )}
    </div>
  );
};

export default LibraryPage;
