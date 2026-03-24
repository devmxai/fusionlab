import { Bell, Coins, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const HomeHeader = () => {
  const { user, credits } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Credits */}
        <button
          onClick={() => user ? navigate("/profile") : navigate("/auth")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <Coins className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">{user ? credits : "—"}</span>
        </button>

        {/* Center Logo */}
        <h1 className="text-lg font-extrabold text-foreground tracking-tight">
          <span className="text-primary">FUSION</span> LAB
        </h1>

        {/* Auth / Notifications */}
        {user ? (
          <button onClick={() => navigate("/profile")} className="p-2 rounded-full hover:bg-secondary transition-colors relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
          >
            <User className="w-3.5 h-3.5" />
            دخول
          </button>
        )}
      </div>
    </header>
  );
};

export default HomeHeader;
