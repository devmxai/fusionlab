import { useEffect, useRef, useState } from "react";
import { Video, Mic, UserRound } from "lucide-react";
import bannerVoice from "@/assets/banners/banner-voice.jpg";
import bannerMotion from "@/assets/banners/banner-motion.jpg";
import bannerAvatar from "@/assets/banners/banner-avatar.jpg";

const banners = [
  {
    image: bannerVoice,
    title: "توليد الصوت بالذكاء الاصطناعي",
    subtitle: "باللهجة العراقية العامية",
    icon: Mic,
    overlay: "bg-gradient-to-b from-background/70 via-transparent to-background/60",
    textPos: "items-center text-center",
  },
  {
    image: bannerMotion,
    title: "Kling 3.0",
    subtitle: "Motion Control",
    icon: Video,
    overlay: "bg-gradient-to-b from-background/80 via-background/30 to-transparent",
    textPos: "items-center text-center pt-2",
  },
  {
    image: bannerAvatar,
    title: "AI Avatar",
    subtitle: "أنشئ شخصية تسوّق منتجاتك",
    icon: UserRound,
    overlay: "bg-gradient-to-l from-background/80 via-background/40 to-transparent",
    textPos: "items-end text-right pr-5",
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
      <div className="relative overflow-hidden rounded-xl aspect-[2.2/1] max-h-40">
        {banners.map((banner, i) => {
          const Icon = banner.icon;
          return (
            <div
              key={i}
              className="absolute inset-0 transition-all duration-700 ease-in-out"
              style={{
                opacity: current === i ? 1 : 0,
                transform: current === i ? "scale(1)" : "scale(1.03)",
              }}
            >
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              <div className={`absolute inset-0 ${banner.overlay}`} />
              <div
                className={`absolute inset-0 flex flex-col justify-center px-5 ${banner.textPos}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-lg font-extrabold text-foreground leading-tight drop-shadow-lg">
                  {banner.title}
                </h3>
                <p className="text-xs text-primary font-semibold mt-0.5 drop-shadow-md">
                  {banner.subtitle}
                </p>
              </div>
            </div>
          );
        })}

        {/* Dots */}
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
      </div>
    </div>
  );
};

export default BannerCarousel;
