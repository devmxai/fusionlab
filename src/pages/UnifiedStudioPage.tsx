import { useMemo, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  studioGroups,
  findSubTab,
  defaultSubTabId,
} from "@/data/studio-tabs";
import StudioPage from "./StudioPage";
import { useAuth } from "@/contexts/AuthContext";
import CreditRingAvatar from "@/components/CreditRingAvatar";
import ProfileSidebar from "@/components/ProfileSidebar";
import { Coins, FolderOpen } from "lucide-react";

const UnifiedStudioPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, credits } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const subTabId = searchParams.get("tab") || defaultSubTabId;
  const { group: activeGroup, sub: activeSub } = useMemo(
    () => findSubTab(subTabId),
    [subTabId]
  );

  // Normalize URL if tab id is invalid
  useEffect(() => {
    const exists = studioGroups.some((g) => g.subtabs.some((s) => s.id === subTabId));
    if (!exists) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", defaultSubTabId);
      setSearchParams(next, { replace: true });
    }
  }, [subTabId, searchParams, setSearchParams]);

  const setSubTab = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    next.delete("model");
    setSearchParams(next, { replace: false });
  };

  const switchGroup = (groupId: string) => {
    const group = studioGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSubTab(group.subtabs[0].id);
  };

  const creditsDisplay = credits.toLocaleString("en");

  // The tabs UI to inject inside the studio aside
  const headerSlot = (
    <div className="px-4 pt-4 pb-3 space-y-3" dir="ltr">
      {/* Top-level: Video / Image */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-secondary/50">
        {studioGroups.map((g) => {
          const active = g.id === activeGroup.id;
          return (
            <button
              key={g.id}
              onClick={() => switchGroup(g.id)}
              className={`h-8 rounded-lg text-[12px] font-bold transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {activeGroup.subtabs.map((s) => {
          const active = s.id === activeSub.id;
          return (
            <button
              key={s.id}
              onClick={() => setSubTab(s.id)}
              className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors border ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border/40 hover:text-foreground hover:border-border"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden" dir="ltr">
      {/* ─── Minimal Top Header ─── */}
      <header className="shrink-0 bg-nav-bg/95 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
          {/* Right: Profile + Credits */}
          <div className="flex items-center gap-2">
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

          {/* Left: Library */}
          <button
            onClick={() => navigate("/library")}
            className="h-9 px-3.5 rounded-full bg-secondary/60 hover:bg-secondary border border-border/40 flex items-center gap-2 transition-colors"
            aria-label="Library"
          >
            <FolderOpen className="w-4 h-4 text-foreground" />
            <span className="text-[12px] font-bold text-foreground">Library</span>
          </button>
        </div>
      </header>

      {/* ─── Embedded Studio ─── */}
      <div className="flex-1 min-h-0">
        <StudioPage
          key={activeSub.id}
          categoryProp={activeSub.category}
          toolIdFilter={activeSub.toolIds}
          subTabId={activeSub.id}
          embedded
          headerSlot={headerSlot}
        />
      </div>

      <ProfileSidebar open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default UnifiedStudioPage;
