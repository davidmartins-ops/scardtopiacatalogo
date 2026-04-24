import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Catalogo from "./pages/Catalogo.tsx";
import DropDetail from "./pages/DropDetail.tsx";
import SingleDetail from "./pages/SingleDetail.tsx";
import CustomerLogin from "./pages/CustomerLogin.tsx";
import CustomerDashboard from "./pages/CustomerDashboard.tsx";
import DeckBuilder from "./pages/DeckBuilder.tsx";
import CollectionManager from "./pages/CollectionManager.tsx";
import PublicCollection from "./pages/PublicCollection.tsx";
import TrendingCards from "./pages/TrendingCards.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import NotFound from "./pages/NotFound.tsx";
import CookieBanner from "./components/CookieBanner";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/catalogo/drop/:dropId" element={<DropDetail />} />
          <Route path="/catalogo/single/:singleId" element={<SingleDetail />} />
          <Route path="/conta/login" element={<CustomerLogin />} />
          <Route path="/conta" element={<CustomerDashboard />} />
          <Route path="/conta/decks/:deckId" element={<DeckBuilder />} />
          <Route path="/conta/colecoes/:collectionId" element={<CollectionManager />} />
          <Route path="/colecao/:collectionId" element={<PublicCollection />} />
          <Route path="/tendencias" element={<TrendingCards />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <CookieBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
