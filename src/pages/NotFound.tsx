import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import useSEO from "@/hooks/use-seo";

const NotFound = () => {
  const location = useLocation();

  useSEO({
    title: "Página não encontrada (404)",
    description: "A página que você procura não existe ou foi removida. Volte ao catálogo da Spencer's Cardtopia e explore Drops e singles de Magic: The Gathering.",
    canonical: `https://www.spencerscardtopia.com.br${location.pathname}`,
    noindex: true,
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <main id="main-content" className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <a href="/catalogo" className="text-primary underline hover:text-primary/90">
          Voltar ao catálogo
        </a>
      </main>
    </div>
  );
};

export default NotFound;
