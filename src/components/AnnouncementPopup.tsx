import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";

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
    if (announcement?.cta_link) {
      if (announcement.cta_link.startsWith("http")) {
        window.open(announcement.cta_link, "_blank");
      } else {
        navigate(announcement.cta_link);
      }
    }
  };

  if (!announcement) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent
        className="max-w-[min(92vw,420px)] p-0 rounded-2xl border-primary/20 bg-card overflow-hidden gap-0 [&>button]:hidden"
        dir="rtl"
        style={{ backdropFilter: "blur(12px)" }}
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
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementPopup;
