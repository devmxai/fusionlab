import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  cta_text: string | null;
  cta_link: string | null;
  sort_order: number;
  is_active: boolean;
}

const BannerCarousel = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from("homepage_banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setBanners((data as Banner[]) || []));
  }, []);

  // Auto-rotate for mobile (single card view)
  useEffect(() => {
    if (banners.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="px-4 py-3">
      {/* Desktop: show up to 3 banners side by side */}
      <div className="hidden md:grid md:grid-cols-3 gap-3">
        {banners.slice(0, 3).map((banner) => (
          <a
            key={banner.id}
            href={banner.cta_link || "#"}
            className="relative overflow-hidden rounded-xl aspect-[2/1] group cursor-pointer border border-border/20 hover:border-primary/30 transition-all"
          >
            <img
              src={banner.image_url}
              alt={banner.title || ""}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
            <div className="absolute bottom-0 right-0 left-0 p-4 text-right">
              {banner.title && (
                <h3 className="text-sm font-extrabold text-foreground leading-tight drop-shadow-lg">
                  {banner.title}
                </h3>
              )}
              {banner.subtitle && (
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5 drop-shadow-md">
                  {banner.subtitle}
                </p>
              )}
              {banner.cta_text && (
                <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold backdrop-blur-sm">
                  <Sparkles className="w-3 h-3" />
                  {banner.cta_text}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>

      {/* Mobile: slider */}
      <div className="md:hidden relative overflow-hidden rounded-xl aspect-[2.2/1] max-h-40 banner-glow">
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            className="absolute inset-0 transition-all duration-700 ease-in-out"
            style={{
              opacity: current === i ? 1 : 0,
              transform: current === i ? "scale(1)" : "scale(1.03)",
            }}
          >
            <img src={banner.image_url} alt={banner.title || ""} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end px-4 pb-6 text-right">
              {banner.title && (
                <h3 className="text-base font-extrabold text-foreground leading-tight drop-shadow-lg">
                  {banner.title}
                </h3>
              )}
              {banner.subtitle && (
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5 drop-shadow-md">
                  {banner.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  current === i ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerCarousel;
