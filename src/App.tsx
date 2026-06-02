import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import GamesPage from "./pages/GamesPage";
import BreathingPage from "./pages/BreathingPage";
import MemoryPage from "./pages/MemoryPage";
import ShellGamePage from "./pages/ShellGamePage";
import WordFlowPage from "./pages/WordFlowPage";
import MoodColorsPage from "./pages/MoodColorsPage";
import YogaPage from "./pages/YogaPage";
import YogaFlowPage from "./pages/YogaFlowPage";
import PoseDetailPage from "./pages/PoseDetailPage";
import MindFlowPage from "./pages/MindFlowPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/mindflow" element={<MindFlowPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/breathing" element={<BreathingPage />} />
          <Route path="/games/memory" element={<MemoryPage />} />
          <Route path="/games/shell" element={<ShellGamePage />} />
          <Route path="/games/words" element={<WordFlowPage />} />
          <Route path="/games/mood" element={<MoodColorsPage />} />
          <Route path="/yoga" element={<YogaPage />} />
          <Route path="/yoga/flow" element={<YogaFlowPage />} />
          <Route path="/yoga/:poseId" element={<PoseDetailPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
