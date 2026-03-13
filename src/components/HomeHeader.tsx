import { Search, Bell } from "lucide-react";

const HomeHeader = () => {
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        <h1 className="text-xl font-extrabold text-foreground tracking-tight">
          <span className="text-primary">FUSION</span> LAB
        </h1>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-secondary transition-colors">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-full hover:bg-secondary transition-colors relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default HomeHeader;
