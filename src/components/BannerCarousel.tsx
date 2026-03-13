import { useEffect, useRef, useState } from "react";
import bannerVoice from "@/assets/banners/banner-voice.jpg";
import bannerMotion from "@/assets/banners/banner-motion.jpg";
import bannerAvatar from "@/assets/banners/banner-avatar.jpg";

const banners = [
  {
    image: bannerVoice,
    title: "توليد أصوات بالذكاء الاصطناعي",
    subtitle: "باللهجة العراقية العامية",
  },
  {
    image: bannerMotion,
    title: "Kling 3.0 Motion Control",
    subtitle: "انقل الحركة من فيديو إلى صورة ثابتة",
  },
  {
    image: bannerAvatar,
    title: "AI Avatar",
    subtitle: "أنشئ شخصية تعرض منتجاتك باحترافية",
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
        {banners.map((banner, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-all duration-700 ease-in-out"
            style={{
              opacity: current === i ? 1 : 0,
              transform: current === i ? "translateX(0)" : "translateX(-30px)",
            }}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/30 to-background/80" />
            <div className="absolute inset-0 flex flex-col justify-center px-5">
              <h3 className="text-base font-bold text-foreground mb-1">
                {banner.title}
              </h3>
              <p className="text-xs text-muted-foreground">{banner.subtitle}</p>
            </div>
          </div>
        ))}

        {/* Dots */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                current === i
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BannerCarousel;
