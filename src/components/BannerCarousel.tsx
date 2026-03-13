import { useEffect, useRef, useState } from "react";
import { Video, Mic, UserRound } from "lucide-react";
import bannerVoice from "@/assets/banners/banner-voice.jpg";
import bannerMotion from "@/assets/banners/banner-motion.jpg";
import bannerAvatar from "@/assets/banners/banner-avatar.jpg";

const banners = [
  {
    image: bannerVoice,
    title: "توليد أصوات AI",
    subtitle: "باللهجة العراقية العامية",
    icon: Mic,
    textAlign: "right" as const,
  },
  {
    image: bannerMotion,
    title: "Kling 3.0",
    subtitle: "Motion Control",
    icon: Video,
    textAlign: "left" as const,
  },
  {
    image: bannerAvatar,
    title: "AI Avatar",
    subtitle: "أنشئ شخصية تسوّق منتجاتك",
    icon: UserRound,
    textAlign: "right" as const,
  },
];

const BannerCarousel = () => {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="px-4 py-3">
      <div className="relative overflow-hidden rounded-xl aspect-[2/1] max-h-44">
        {banners.map((banner, i) => {
          const Icon = banner.icon;
          return (
            <div
              key={i}
              className="absolute inset-0 transition-all duration-700 ease-in-out"
              style={{
                opacity: current === i ? 1 : 0,
                transform: current === i ? "scale(1)" : "scale(1.05)",
              }}
            >
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              {/* Overlay */}
              <div
                className={`absolute inset-0 ${
                  banner.textAlign === "right"
                    ? "bg-gradient-to-l from-transparent to-background/85"
                    : "bg-gradient-to-r from-transparent to-background/85"
                }`}
              />
              {/* Text */}
              <div
                className={`absolute inset-0 flex flex-col justify-center px-5 ${
                  banner.textAlign === "right" ? "items-start" : "items-end"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-xs font-semibold text-primary tracking-wide">
                    {banner.textAlign === "left" ? banner.subtitle : ""}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-foreground leading-tight">
                  {banner.title}
                </h3>
                {banner.textAlign === "right" && (
                  <p className="text-sm text-muted-foreground mt-1 font-medium">
                    {banner.subtitle}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Dots */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
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
      </div>
    </div>
  );
};

export default BannerCarousel;
