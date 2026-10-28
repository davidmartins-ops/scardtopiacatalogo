import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import ScrollManager from "@/components/ScrollManager";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import Home from "./pages/Home.tsx";
import NativeEntry from "@/components/NativeEntry";
// Pages are code-split: only the screen being visited is downloaded.
// Home stays eager (first landing screen); everything else loads on navigation.
const Index = lazy(() => import("./pages/Index.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const Catalogo = lazy(() => import("./pages/Catalogo.tsx"));
const Encomendas = lazy(() => import("./pages/Encomendas.tsx"));
const EncomendaProduto = lazy(() => import("./pages/EncomendaProduto.tsx"));
const DropDetail = lazy(() => import("./pages/DropDetail.tsx"));
const SingleDetail = lazy(() => import("./pages/SingleDetail.tsx"));
const CardVersions = lazy(() => import("./pages/CardVersions.tsx"));
const CustomerLogin = lazy(() => import("./pages/CustomerLogin.tsx"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard.tsx"));
const CustomerSpecialOrders = lazy(() => import("./pages/CustomerSpecialOrders.tsx"));
const CustomerSpecialOrderDetail = lazy(() => import("./pages/CustomerSpecialOrderDetail.tsx"));
const SpecialOrderRequest = lazy(() => import("./pages/SpecialOrderRequest.tsx"));
const AdminSpecialOrders = lazy(() => import("./pages/AdminSpecialOrders.tsx"));
const AdminSpecialOrderDetail = lazy(() => import("./pages/AdminSpecialOrderDetail.tsx"));
const AdminSpecialOrderProducts = lazy(() => import("./pages/AdminSpecialOrderProducts.tsx"));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder.tsx"));
const CollectionManager = lazy(() => import("./pages/CollectionManager.tsx"));
const PublicCollection = lazy(() => import("./pages/PublicCollection.tsx"));
const TrendingCards = lazy(() => import("./pages/TrendingCards.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Sobre = lazy(() => import("./pages/Sobre.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const OrderDetail = lazy(() => import("./pages/OrderDetail.tsx"));
const PedidoSucesso = lazy(() => import("./pages/PedidoSucesso.tsx"));
const PedidoFalha = lazy(() => import("./pages/PedidoFalha.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AdminReports = lazy(() => import("./pages/AdminReports.tsx"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications.tsx"));
const AdminReconciliation = lazy(() => import("./pages/AdminReconciliation.tsx"));
const AdminRefunds = lazy(() => import("./pages/AdminRefunds.tsx"));
const AdminEmails = lazy(() => import("./pages/AdminEmails.tsx"));
const AdminBackups = lazy(() => import("./pages/AdminBackups.tsx"));
const AdminServerStatus = lazy(() => import("./pages/AdminServerStatus.tsx"));
const AdminLiveSales = lazy(() => import("./pages/AdminLiveSales.tsx"));
const AdminStockPrices = lazy(() => import("./pages/AdminStockPrices.tsx"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons.tsx"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers.tsx"));
const AdminReceipts = lazy(() => import("./pages/AdminReceipts.tsx"));
const AdminOrderDetail = lazy(() => import("./pages/AdminOrderDetail.tsx"));
const AdminStoreCredits = lazy(() => import("./pages/AdminStoreCredits.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent.tsx"));
import CookieBanner from "./components/CookieBanner";
import SiteFooter from "./components/SiteFooter";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminRoute from "./components/AdminRoute";
import TwoFactorPrompt from "./components/TwoFactorPrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita refetch a cada troca de página/aba: dados considerados frescos por 5 min
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Carregando página">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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
        <NativeEntry />
        <ScrollManager />
        <TwoFactorPrompt />
        {/* WCAG 2.4.1 Bypass Blocks */}
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin" element={<AdminRoute><Index /></AdminRoute>} />
              <Route path="/admin/relatorios" element={<AdminRoute><AdminReports /></AdminRoute>} />
              <Route path="/admin/notificacoes" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
              <Route path="/admin/reconciliacao" element={<AdminRoute><AdminReconciliation /></AdminRoute>} />
              <Route path="/admin/reembolsos" element={<AdminRoute><AdminRefunds /></AdminRoute>} />
              <Route path="/admin/emails" element={<AdminRoute><AdminEmails /></AdminRoute>} />
              <Route path="/admin/backups" element={<AdminRoute><AdminBackups /></AdminRoute>} />
              <Route path="/admin/status" element={<AdminRoute><AdminServerStatus /></AdminRoute>} />
              <Route path="/admin/vendas-ao-vivo" element={<AdminRoute><AdminLiveSales /></AdminRoute>} />
              <Route path="/admin/cupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
              <Route path="/admin/clientes" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
              <Route path="/admin/comprovantes" element={<AdminRoute><AdminReceipts /></AdminRoute>} />
              <Route path="/admin/estoque-precos" element={<AdminRoute><AdminStockPrices /></AdminRoute>} />
              <Route path="/admin/pedidos/:orderId" element={<AdminRoute><AdminOrderDetail /></AdminRoute>} />
              <Route path="/admin/creditos" element={<AdminRoute><AdminStoreCredits /></AdminRoute>} />
              <Route path="/admin/encomendas" element={<AdminRoute><AdminSpecialOrders /></AdminRoute>} />
              <Route path="/admin/produtos-encomenda" element={<AdminRoute><AdminSpecialOrderProducts /></AdminRoute>} />
              <Route path="/admin/encomendas/:orderId" element={<AdminRoute><AdminSpecialOrderDetail /></AdminRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin/login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
              <Route path="/catalogo" element={<Catalogo />} />
              <Route path="/encomendas" element={<Encomendas />} />
              <Route path="/encomendas/:productId" element={<EncomendaProduto />} />
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
          </Suspense>
        </ErrorBoundary>
        <SiteFooter />
        <CookieBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
