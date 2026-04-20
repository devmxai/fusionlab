import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import CreditRingAvatar from "@/components/CreditRingAvatar";
import ProfileSidebar from "@/components/ProfileSidebar";
import GenerationQueueSidebar from "@/components/GenerationQueueSidebar";
import { Coins } from "lucide-react";

const HomeHeader = () => {
  const { user, credits } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const creditsDisplay = credits.toLocaleString("en");

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 xl:px-16 py-3">
          {/* Right side (first in RTL): Profile */}
          <div className="flex items-center gap-2" dir="rtl">
            {user ? (
              <CreditRingAvatar onClick={() => setProfileOpen(true)} />
            ) : (
              <CreditRingAvatar onClick={() => navigate("/auth")} />
            )}
            <div
              className="h-8 px-2.5 rounded-full bg-secondary/60 border border-border/40 flex items-center gap-1.5 shadow-sm"
              aria-label={`Credits: ${creditsDisplay}`}
            >
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-extrabold text-foreground tabular-nums" dir="ltr">
                {creditsDisplay}
              </span>
            </div>
          </div>

          {/* Center Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <h1 className="text-lg font-extrabold text-foreground tracking-tight">
              <span className="text-primary">FUSION</span> LAB
            </h1>
            <img src="/logo-icon.png" alt="FUSION LAB" className="w-6 h-6 object-contain" />
          </div>

          {/* Left side (last in RTL): Generation Queue */}
          <GenerationQueueSidebar open={queueOpen} onOpen={() => setQueueOpen(true)} onClose={() => setQueueOpen(false)} />
        </div>
      </header>

      <ProfileSidebar open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};

export default HomeHeader;
