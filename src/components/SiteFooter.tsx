import { Link } from "react-router-dom";

const SiteFooter = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-border/40 bg-background/60 backdrop-blur-sm mt-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground font-body">
        <p>© {year} Spencer's Cardtopia. Todos os direitos reservados.</p>
        <nav aria-label="Rodapé legal" className="flex flex-wrap items-center gap-4">
          <Link to="/privacidade" className="hover:text-primary transition-colors">
            Política de Privacidade
          </Link>
          <Link to="/termos" className="hover:text-primary transition-colors">
            Termos de Uso
          </Link>
        </nav>
      </div>
    </footer>
  );
};

export default SiteFooter;
