import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  linked_studio: string | null;
}

const optimizeBannerUrl = (url: string, width = 800): string => {
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace(
      "/storage/v1/object/public/",
      `/storage/v1/render/image/public/`
    ) + `?width=${width}&quality=75`;
  }
  return url;
};

const BannerImage = ({
  src, alt, className, loading = "lazy", fetchPriority = "auto", width = 800,
}: {
  src: string; alt: string; className?: string; loading?: "eager" | "lazy"; fetchPriority?: "high" | "low" | "auto"; width?: number;
}) => {
  const [loaded, setLoaded] = useState(false);
  const optimizedSrc = optimizeBannerUrl(src, width);
  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="absolute inset-0 bg-secondary"><div className="absolute inset-0 shimmer-effect" /></div>}
      <img src={optimizedSrc} alt={alt} className={`${className || ""} ${loaded ? "opacity-100" : "opacity-0"}`}
        loading={loading} decoding="async" fetchPriority={fetchPriority}
        onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
    </div>
  );
};

const BannerSkeleton = () => (
  <div className="px-3 sm:px-6 lg:px-8 py-3">
    <div className="rounded-xl aspect-[2.2/1] max-h-40 md:max-h-none md:aspect-[3/1] bg-secondary overflow-hidden">
      <div className="w-full h-full shimmer-effect" />
    </div>
  </div>
);

const BannerCarousel = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.from("homepage_banners").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setBanners((data as Banner[]) || []));
  }, []);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    intervalRef.current = setInterval(() => setCurrent((prev) => (prev + 1) % banners.length), 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [banners]);

  const handleBannerClick = (banner: Banner, e: React.MouseEvent) => {
    e.preventDefault();
    const target = banner.linked_studio || banner.cta_link;
    const safe = classifyLink(target);
    if (safe.kind === "internal") {
      navigate(safe.path);
    } else if (safe.kind === "external") {
      window.open(safe.url, "_blank", "noopener,noreferrer");
    }
  };

  if (banners === null) return <BannerSkeleton />;
  if (banners.length === 0) return null;

  const desktopCols = banners.length === 1 ? "md:grid-cols-1" : banners.length === 2 ? "md:grid-cols-2" : banners.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4";

  return (
    <div className="px-3 sm:px-6 lg:px-8 py-3">
      {/* Desktop */}
      <div className={`hidden md:grid ${desktopCols} gap-3`}>
        {banners.slice(0, 4).map((banner, i) => (
          <a key={banner.id} href={banner.linked_studio || banner.cta_link || "#"}
            onClick={(e) => handleBannerClick(banner, e)}
            className="relative overflow-hidden rounded-xl aspect-[2/1] group cursor-pointer border border-border/20 hover:border-primary/30 transition-all">
            <BannerImage src={banner.image_url} alt={banner.title || ""} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="eager" fetchPriority={i === 0 ? "high" : "auto"} />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
            <div className="absolute bottom-0 right-0 left-0 p-4 text-right">
              {banner.title && <h3 className="text-sm font-extrabold text-foreground leading-tight drop-shadow-lg">{banner.title}</h3>}
              {banner.subtitle && <p className="text-[10px] text-muted-foreground font-medium mt-0.5 drop-shadow-md">{banner.subtitle}</p>}
              {banner.cta_text && (
                <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold backdrop-blur-sm">
                  <Sparkles className="w-3 h-3" />{banner.cta_text}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden relative overflow-hidden rounded-xl aspect-[2.2/1] max-h-40 banner-glow">
        {banners.map((banner, i) => (
          <div key={banner.id} className="absolute inset-0 transition-opacity duration-200 ease-linear cursor-pointer"
            style={{ opacity: current === i ? 1 : 0 }}
            onClick={(e) => current === i && handleBannerClick(banner, e)}>
            <BannerImage src={banner.image_url} alt={banner.title || ""} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end px-4 pb-6 text-right">
              {banner.title && <h3 className="text-base font-extrabold text-foreground leading-tight drop-shadow-lg">{banner.title}</h3>}
              {banner.subtitle && <p className="text-[10px] text-muted-foreground font-medium mt-0.5 drop-shadow-md">{banner.subtitle}</p>}
            </div>
          </div>
        ))}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${current === i ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerCarousel;
