import { useNavigate } from "react-router-dom";
import { categories } from "@/data/tools";

interface CategoryFilterProps {
  selected: string;
  onSelect: (cat: string) => void;
}

const categoryRouteMap: Record<string, string> = {
  "فيديو": "/studio/video",
  "صور": "/studio/images",
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
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 px-4">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => handleClick(cat)}
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            selected === cat
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
