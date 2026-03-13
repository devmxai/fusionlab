import { Bell, Coins } from "lucide-react";

const HomeHeader = () => {
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Credits - Right side (RTL) */}
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
          <Coins className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">250</span>
        </button>

        {/* Center Logo */}
        <h1 className="text-lg font-extrabold text-foreground tracking-tight">
          <span className="text-primary">FUSION</span> LAB
        </h1>

        {/* Notifications - Left side (RTL) */}
        <button className="p-2 rounded-full hover:bg-secondary transition-colors relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
};

export default HomeHeader;
