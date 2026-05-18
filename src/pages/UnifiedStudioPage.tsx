import { useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { studioTabs, getTabById, defaultTabId } from "@/data/studio-tabs";
import StudioPage from "./StudioPage";
import { useAuth } from "@/contexts/AuthContext";
import CreditRingAvatar from "@/components/CreditRingAvatar";
import GenerationQueueSidebar from "@/components/GenerationQueueSidebar";
import ProfileSidebar from "@/components/ProfileSidebar";
import { Coins } from "lucide-react";
import { useState } from "react";

const UnifiedStudioPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, credits } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const tabId = searchParams.get("tab") || defaultTabId;
  const activeTab = useMemo(() => getTabById(tabId), [tabId]);

  // Normalize URL if tab id is invalid
  useEffect(() => {
    if (!studioTabs.some((t) => t.id === tabId)) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", defaultTabId);
      setSearchParams(next, { replace: true });
    }
  }, [tabId, searchParams, setSearchParams]);

  const setTab = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    // Clear model when switching tab so StudioPage picks default
    next.delete("model");
    setSearchParams(next, { replace: false });
  };

  const creditsDisplay = credits.toLocaleString("en");

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* ─── Top Header with Tabs ─── */}
      <header className="shrink-0 bg-nav-bg/95 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 gap-3">
          {/* Right: Profile + Credits (RTL first) */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <CreditRingAvatar onClick={() => setProfileOpen(true)} />
            ) : (
              <CreditRingAvatar onClick={() => navigate("/auth")} />
            )}
            <div
              className="h-8 px-2.5 rounded-full bg-secondary/60 border border-border/40 flex items-center gap-1.5"
              aria-label={`Credits: ${creditsDisplay}`}
            >
              <Coins className="w-3.5 h-3.5 text-foreground" />
              <span className="text-[11px] font-extrabold text-foreground tabular-nums" dir="ltr">
                {creditsDisplay}
              </span>
            </div>
          </div>

          {/* Center: Tabs */}
          <nav
            className="flex-1 flex items-center justify-center gap-1 overflow-x-auto scrollbar-hide"
            dir="ltr"
          >
            {studioTabs.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`shrink-0 px-3.5 h-9 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Left: Queue */}
          <div className="shrink-0">
            <GenerationQueueSidebar
              open={queueOpen}
              onOpen={() => setQueueOpen(true)}
              onClose={() => setQueueOpen(false)}
            />
          </div>
        </div>
      </header>

      {/* ─── Embedded Studio (key forces remount on tab change) ─── */}
      <div className="flex-1 min-h-0">
        <StudioPage
          key={activeTab.id}
          categoryProp={activeTab.category}
          toolIdFilter={activeTab.toolIds}
          embedded
        />
      </div>

      <ProfileSidebar open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default UnifiedStudioPage;
