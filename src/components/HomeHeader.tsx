import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User } from "lucide-react";
import CreditRingAvatar from "@/components/CreditRingAvatar";
import ProfileSidebar from "@/components/ProfileSidebar";
import GenerationQueue from "@/components/GenerationQueue";

const HomeHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          {/* Left: Generation Queue */}
          <GenerationQueue items={[]} />

          {/* Center Logo */}
          <h1 className="text-lg font-extrabold text-foreground tracking-tight">
            <span className="text-primary">FUSION</span> LAB
          </h1>

          {/* Right: Profile Avatar with Credit Ring */}
          {user ? (
            <CreditRingAvatar onClick={() => setSidebarOpen(true)} />
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

      <ProfileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
};

export default HomeHeader;
