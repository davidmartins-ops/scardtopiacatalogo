import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index.tsx";
import Home from "./pages/Home.tsx";
import Login from "./pages/Login.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import Catalogo from "./pages/Catalogo.tsx";
import DropDetail from "./pages/DropDetail.tsx";
import SingleDetail from "./pages/SingleDetail.tsx";
import CardVersions from "./pages/CardVersions.tsx";
import CustomerLogin from "./pages/CustomerLogin.tsx";
import CustomerDashboard from "./pages/CustomerDashboard.tsx";
import DeckBuilder from "./pages/DeckBuilder.tsx";
import CollectionManager from "./pages/CollectionManager.tsx";
import PublicCollection from "./pages/PublicCollection.tsx";
import TrendingCards from "./pages/TrendingCards.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import Sobre from "./pages/Sobre.tsx";
import FAQ from "./pages/FAQ.tsx";
import OrderDetail from "./pages/OrderDetail.tsx";
import PedidoSucesso from "./pages/PedidoSucesso.tsx";
import PedidoFalha from "./pages/PedidoFalha.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminReports from "./pages/AdminReports.tsx";
import AdminNotifications from "./pages/AdminNotifications.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import CookieBanner from "./components/CookieBanner";
import SiteFooter from "./components/SiteFooter";

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
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* WCAG 2.4.1 Bypass Blocks */}
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/admin/relatorios" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/notificacoes" element={<ProtectedRoute><AdminNotifications /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin/login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/catalogo/drop/:dropId" element={<DropDetail />} />
          <Route path="/catalogo/single/:singleId" element={<SingleDetail />} />
          <Route path="/catalogo/carta/:name" element={<CardVersions />} />
          <Route path="/conta/login" element={<CustomerLogin />} />
          <Route path="/conta" element={<CustomerDashboard />} />
          <Route path="/conta/decks/:deckId" element={<DeckBuilder />} />
          <Route path="/conta/colecoes/:collectionId" element={<CollectionManager />} />
          <Route path="/conta/pedidos/:orderId" element={<OrderDetail />} />
          <Route path="/pedido/sucesso" element={<PedidoSucesso />} />
          <Route path="/pedido/falha" element={<PedidoFalha />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/colecao/:collectionId" element={<PublicCollection />} />
          <Route path="/tendencias" element={<TrendingCards />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SiteFooter />
        <CookieBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
