import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "product" | "article";
  product?: {
    name: string;
    price: number;
    currency?: string;
    availability?: "InStock" | "OutOfStock" | "PreOrder";
    image?: string;
    description?: string;
    sku?: string;
    category?: string;
  };
}

const useSEO = ({ title, description, canonical, image, type = "website", product }: SEOProps) => {
  useEffect(() => {
    const siteName = "Spencer's Cardtopia";
    const fullTitle = title ? `${title} | ${siteName}` : siteName;
    const metaDesc = description || "Sua loja de Secret Lair! Drops exclusivos, singles e muito mais para colecionadores de Magic: The Gathering.";

    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", metaDesc);
    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", metaDesc, "property");
    setMeta("og:type", type, "property");
    setMeta("og:site_name", siteName, "property");

    if (image) setMeta("og:image", image, "property");
    if (canonical) {
      setMeta("og:url", canonical, "property");
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
      link.href = canonical;
    }

    setMeta("twitter:card", "summary_large_image", "name");
    setMeta("twitter:title", fullTitle, "name");
    setMeta("twitter:description", metaDesc, "name");
    if (image) setMeta("twitter:image", image, "name");

    // JSON-LD
    const existingLd = document.querySelector('script[data-seo-jsonld]');
    if (existingLd) existingLd.remove();

    let jsonLd: Record<string, any>;

    if (product) {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || metaDesc,
        image: product.image || image,
        sku: product.sku,
        category: product.category,
        offers: {
          "@type": "Offer",
          priceCurrency: product.currency || "BRL",
          price: product.price.toFixed(2),
          availability: `https://schema.org/${product.availability || "InStock"}`,
          seller: {
            "@type": "Organization",
            name: siteName,
          },
        },
      };
    } else {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: canonical || window.location.origin,
        description: metaDesc,
        potentialAction: {
          "@type": "SearchAction",
          target: `${window.location.origin}/catalogo?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      };
    }

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-jsonld", "true");
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      const s = document.querySelector('script[data-seo-jsonld]');
      if (s) s.remove();
    };
  }, [title, description, canonical, image, type, product]);
};

export default useSEO;
