import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";
import { classifyLink } from "@/lib/safe-link";

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  show_once: boolean | null;
}

const AnnouncementPopup = () => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAnnouncement = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, description, image_url, cta_text, cta_link, show_once")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();

      if (error || !data) return;

      // Check localStorage for show_once
      const dismissedKey = `announcement_dismissed_${data.id}`;
      if (data.show_once && localStorage.getItem(dismissedKey)) return;

      setAnnouncement(data);
      // Small delay for better UX
      setTimeout(() => setOpen(true), 1200);
    };

    fetchAnnouncement();
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    if (announcement?.show_once) {
      localStorage.setItem(`announcement_dismissed_${announcement.id}`, "true");
    }
  };

  const handleCta = () => {
    handleDismiss();
    const safe = classifyLink(announcement?.cta_link);
    if (safe.kind === "internal") {
      navigate(safe.path);
    } else if (safe.kind === "external") {
      window.open(safe.url, "_blank", "noopener,noreferrer");
    }
  };

  if (!announcement) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/60" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] max-w-[min(92vw,420px)] w-full p-0 rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          dir="rtl"
        >
          {/* Close button — right side only */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-background/60 backdrop-blur flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Image */}
          {announcement.image_url && (
            <div className="w-full aspect-[4/3] overflow-hidden">
              <img
                src={announcement.image_url}
                alt={announcement.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-5 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">{announcement.title}</h3>
            </div>

            {announcement.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {announcement.description}
              </p>
            )}

            {announcement.cta_text && (
              <Button
                onClick={handleCta}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
                size="lg"
              >
                {announcement.cta_text}
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default AnnouncementPopup;
