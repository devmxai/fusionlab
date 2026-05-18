import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { GenerationQueueProvider } from "@/contexts/GenerationQueueContext";
import UnifiedStudioPage from "./pages/UnifiedStudioPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import PricingPage from "./pages/PricingPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import LibraryPage from "./pages/LibraryPage.tsx";
import AudioStudioPage from "./pages/AudioStudioPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// Backward-compat: old DB links like /studio/video → unified tab URL.
const categoryToTab: Record<string, string> = {
  video: "text-to-video",
  avatar: "audio-to-video",
  transfer: "video-to-video",
  images: "text-to-image",
  remix: "image-to-image",
  shoots: "shoots",
  "remove-bg": "remove-bg",
  upscale: "upscale",
};

const LegacyStudioRedirect = () => {
  const path = window.location.pathname;
  const search = window.location.search;
  const match = path.match(/^\/studio\/([^/]+)/);
  const category = match?.[1];
  if (category === "audio") return <Navigate to={`/studio/audio${search}`} replace />;
  const tab = (category && categoryToTab[category]) || "text-to-video";
  const sep = search ? `${search}&` : "?";
  return <Navigate to={`/studio${sep}tab=${tab}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <GenerationQueueProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/studio?tab=text-to-video" replace />} />
              <Route path="/studio" element={<UnifiedStudioPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/studio/audio" element={<AudioStudioPage />} />
              {/* Backward-compat redirects for old DB links / bookmarks */}
              <Route path="/studio/:category" element={<LegacyStudioRedirect />} />
              <Route path="/tool/:toolId" element={<Navigate to="/studio?tab=text-to-video" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </GenerationQueueProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

