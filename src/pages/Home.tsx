import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

/**
 * Rota raiz pública e "inteligente":
 * - cliente autenticado → /catalogo
 * - visitante (deslogado) → /login
 *
 * A área administrativa vive em /admin (protegida por ProtectedRoute) e
 * NUNCA é acessada por aqui, evitando que clientes sejam deslogados ao
 * acessar a raiz do site.
 */
const Home = () => {
  const { session, loading } = useCustomerAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={session ? "/catalogo" : "/login"} replace />;
};

export default Home;
