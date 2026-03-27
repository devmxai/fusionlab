import { useNavigate } from "react-router-dom";
import { categories } from "@/data/tools";

interface CategoryFilterProps {
  selected: string;
  onSelect: (cat: string) => void;
}

const categoryRouteMap: Record<string, string> = {
  "فيديو": "/studio/video",
  "صور": "/studio/images",
  "ريمكس": "/studio/remix",
  "صوت": "/studio/audio",
  "افتار": "/studio/avatar",
  "حذف الخلفية": "/studio/remove-bg",
  "رفع الجودة": "/studio/upscale",
};

const CategoryFilter = ({ selected, onSelect }: CategoryFilterProps) => {
  const navigate = useNavigate();

  const handleClick = (cat: string) => {
    if (cat === "الكل") {
      onSelect(cat);
    } else if (categoryRouteMap[cat]) {
      navigate(categoryRouteMap[cat]);
    } else {
      onSelect(cat);
    }
  };

  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide py-3 px-4 sm:px-6 lg:px-8 lg:justify-center"
      dir="rtl"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {categories.map((cat, i) => (
        <motion.button
          key={cat}
          onClick={() => handleClick(cat)}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
          whileTap={{ scale: 0.93 }}
          className={`whitespace-nowrap shrink-0 px-5 py-2 rounded-full text-xs font-semibold transition-colors ${
            selected === cat
              ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {cat}
        </motion.button>
      ))}
    </div>
  );
};

export default CategoryFilter;
