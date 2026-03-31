import { useParams } from "react-router-dom";
import { usePublicCollection } from "@/hooks/use-collections";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Globe } from "lucide-react";
import logo from "@/assets/logo.png";

const PublicCollection = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { data, isLoading } = usePublicCollection(collectionId);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <BookOpen className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Coleção não encontrada ou é privada.</p>
      </div>
    );
  }

  const { collection, cards } = data;

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4 text-success" /> Coleção Pública
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">{collection.name}</h1>
        {collection.description && <p className="text-sm text-muted-foreground mb-4">{collection.description}</p>}
        <p className="text-sm text-muted-foreground mb-6">{cards.length} carta(s) · {cards.reduce((s, c) => s + c.quantity, 0)} unidades</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {cards.map((card) => (
            <div key={card.id} className="glass-card overflow-hidden">
              {card.image_url ? (
                <img src={card.image_url} alt={card.card_name} className="w-full aspect-[2.5/3.5] object-cover" />
              ) : (
                <div className="w-full aspect-[2.5/3.5] bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
              )}
              <div className="p-2">
                <p className="text-xs font-medium text-foreground truncate">{card.card_name}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1">{card.condition}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1">{card.language}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1">×{card.quantity}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PublicCollection;
