import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import CreditRingAvatar from "@/components/CreditRingAvatar";
import ProfileSidebar from "@/components/ProfileSidebar";
import GenerationQueueSidebar from "@/components/GenerationQueueSidebar";

const HomeHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 max-w-[1400px] mx-auto">
          {/* Right side (first in RTL): Profile */}
          {user ? (
            <CreditRingAvatar onClick={() => setProfileOpen(true)} />
          ) : (
            <CreditRingAvatar onClick={() => navigate("/auth")} />
          )}

          {/* Center Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <h1 className="text-lg font-extrabold text-foreground tracking-tight">
              <span className="text-primary">FUSION</span> LAB
            </h1>
            <img src="/logo-icon.png" alt="FUSION LAB" className="w-6 h-6 object-contain" />
          </div>

          {/* Left side (last in RTL): Generation Queue */}
          <GenerationQueueSidebar items={[]} open={queueOpen} onOpen={() => setQueueOpen(true)} onClose={() => setQueueOpen(false)} />
        </div>
      </header>

      <ProfileSidebar open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};

export default HomeHeader;
