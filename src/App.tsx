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
import Encomendas from "./pages/Encomendas.tsx";
import DropDetail from "./pages/DropDetail.tsx";
import SingleDetail from "./pages/SingleDetail.tsx";
import CardVersions from "./pages/CardVersions.tsx";
import CustomerLogin from "./pages/CustomerLogin.tsx";
import CustomerDashboard from "./pages/CustomerDashboard.tsx";
import CustomerSpecialOrders from "./pages/CustomerSpecialOrders.tsx";
import CustomerSpecialOrderDetail from "./pages/CustomerSpecialOrderDetail.tsx";
import SpecialOrderRequest from "./pages/SpecialOrderRequest.tsx";
import AdminSpecialOrders from "./pages/AdminSpecialOrders.tsx";
import AdminSpecialOrderDetail from "./pages/AdminSpecialOrderDetail.tsx";
import AdminSpecialOrderProducts from "./pages/AdminSpecialOrderProducts.tsx";
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
import AdminReconciliation from "./pages/AdminReconciliation.tsx";
import AdminRefunds from "./pages/AdminRefunds.tsx";
import AdminEmails from "./pages/AdminEmails.tsx";
import AdminOrderDetail from "./pages/AdminOrderDetail.tsx";
import AdminStoreCredits from "./pages/AdminStoreCredits.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import CookieBanner from "./components/CookieBanner";
import SiteFooter from "./components/SiteFooter";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminRoute from "./components/AdminRoute";

const queryClient = new QueryClient();

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
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<AdminRoute><Index /></AdminRoute>} />
            <Route path="/admin/relatorios" element={<AdminRoute><AdminReports /></AdminRoute>} />
            <Route path="/admin/notificacoes" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
            <Route path="/admin/reconciliacao" element={<AdminRoute><AdminReconciliation /></AdminRoute>} />
            <Route path="/admin/reembolsos" element={<AdminRoute><AdminRefunds /></AdminRoute>} />
            <Route path="/admin/emails" element={<AdminRoute><AdminEmails /></AdminRoute>} />
            <Route path="/admin/pedidos/:orderId" element={<AdminRoute><AdminOrderDetail /></AdminRoute>} />
            <Route path="/admin/creditos" element={<AdminRoute><AdminStoreCredits /></AdminRoute>} />
            <Route path="/admin/encomendas" element={<AdminRoute><AdminSpecialOrders /></AdminRoute>} />
            <Route path="/admin/encomendas/:orderId" element={<AdminRoute><AdminSpecialOrderDetail /></AdminRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/catalogo/drop/:dropId" element={<DropDetail />} />
            <Route path="/catalogo/single/:singleId" element={<SingleDetail />} />
            <Route path="/catalogo/carta/:name" element={<CardVersions />} />
            <Route path="/conta/login" element={<CustomerLogin />} />
            <Route path="/conta" element={<CustomerDashboard />} />
            <Route path="/conta/encomendas" element={<CustomerSpecialOrders />} />
            <Route path="/conta/encomendas/nova" element={<SpecialOrderRequest />} />
            <Route path="/conta/encomendas/:orderId" element={<CustomerSpecialOrderDetail />} />
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
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
        <SiteFooter />
        <CookieBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
