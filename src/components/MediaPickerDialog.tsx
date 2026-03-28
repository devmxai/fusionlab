/**
 * MediaPickerDialog - allows picking images or audio from the user's generation library.
 * Shows a grid of previously generated media filtered by type.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image as ImageIcon, Music, Sparkles } from "lucide-react";

interface Generation {
  id: string;
  file_url: string;
  file_type: string;
  tool_name: string | null;
  prompt: string | null;
  created_at: string;
  thumbnail_url: string | null;
}

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** "image" or "audio" */
  mediaType: "image" | "audio";
  onSelect: (url: string, fileName: string) => void;
}

const MediaPickerDialog = ({ open, onClose, mediaType, onSelect }: MediaPickerDialogProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("generations")
        .select("id, file_url, file_type, tool_name, prompt, created_at, thumbnail_url")
        .eq("user_id", user.id)
        .eq("file_type", mediaType)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as Generation[]) || []);
      setLoading(false);
    };
    load();
  }, [open, user, mediaType]);

  const handlePick = (item: Generation) => {
    const fileName = item.prompt?.slice(0, 30) || item.tool_name || mediaType;
    onSelect(item.file_url, fileName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {mediaType === "image" ? <ImageIcon className="w-4 h-4" /> : <Music className="w-4 h-4" />}
            {mediaType === "image" ? "اختر من المكتبة" : "اختر من الأصوات المولدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-xs text-muted-foreground">
                {mediaType === "image" ? "لا توجد صور في المكتبة بعد" : "لا توجد ملفات صوتية مولدة بعد"}
              </p>
            </div>
          ) : mediaType === "image" ? (
            <div className="grid grid-cols-3 gap-2 p-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePick(item)}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-primary/50 transition-all group"
                >
                  <img
                    src={item.thumbnail_url || item.file_url}
                    alt={item.prompt || ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 p-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePick(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-right"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Music className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">
                      {item.tool_name || "مقطع صوتي"}
                    </p>
                    {item.prompt && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.prompt}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground flex-shrink-0">
                    {new Date(item.created_at).toLocaleDateString("ar")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaPickerDialog;
