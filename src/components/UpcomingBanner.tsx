import festivalBanner from "@/assets/banner-festival-box.jpeg";

interface BannerItem {
  title: string;
  date: string;
  image: string;
}

const banners: BannerItem[] = [
  {
    title: "Festival in a Box: Las Vegas 2026",
    date: "13 de Abril de 2026",
    image: festivalBanner,
  },
];

const UpcomingBanner = () => {
  return (
    <div className="space-y-4">
      {banners.map((banner, i) => (
        <div key={i} className="glass-card overflow-hidden glow-hover group relative">
          <div className="relative">
            <img
              src={banner.image}
              alt={banner.title}
              className="w-full h-48 sm:h-64 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/90 text-accent-foreground mb-2">
                Proximo Lancamento
              </span>
              <h3 className="font-display text-lg sm:text-xl font-bold text-foreground drop-shadow-lg">
                {banner.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{banner.date}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UpcomingBanner;
