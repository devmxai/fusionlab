import { Home, Users, FolderOpen, User, Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "الرئيسية", id: "home", path: "/" },
  { icon: Users, label: "المجتمع", id: "community", path: "/" },
  { icon: Sparkles, label: "إنشاء", id: "create", isCenter: true, path: "/" },
  { icon: FolderOpen, label: "المكتبة", id: "library", path: "/" },
  { icon: User, label: "حسابي", id: "profile", path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveId = () => {
    if (location.pathname === "/profile") return "profile";
    return "home";
  };

  const active = getActiveId();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.isCenter) {
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex items-center justify-center -mt-5 w-14 h-14 rounded-2xl bg-create-btn animate-pulse-glow transition-transform active:scale-95"
              >
                <Icon className="w-6 h-6 text-primary-foreground" />
              </button>
            );
          }
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                active === item.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
