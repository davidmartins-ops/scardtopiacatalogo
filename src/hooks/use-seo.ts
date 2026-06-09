import { useEffect } from "react";

interface SEOProduct {
  name: string;
  price: number;
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  image?: string;
  description?: string;
  sku?: string;
  category?: string;
  brand?: string;
}

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "product" | "article";
  product?: SEOProduct;
  /** Optional custom JSON-LD; if provided, overrides default WebSite/Product schema. */
  jsonLd?: Record<string, any> | Record<string, any>[];
  /** When true, injects <meta name="robots" content="noindex,nofollow"> to keep page out of search index. */
  noindex?: boolean;
}

const useSEO = ({ title, description, canonical, image, type = "website", product, jsonLd, noindex }: SEOProps) => {
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

    // Robots noindex (per-page)
    const existingRobots = document.querySelector('meta[name="robots"][data-seo-robots]');
    if (existingRobots) existingRobots.remove();
    if (noindex) {
      const m = document.createElement("meta");
      m.setAttribute("name", "robots");
      m.setAttribute("content", "noindex,nofollow");
      m.setAttribute("data-seo-robots", "true");
      document.head.appendChild(m);
    }

    // JSON-LD
    document.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());

    let payload: Record<string, any> | Record<string, any>[];

    if (jsonLd) {
      payload = jsonLd;
    } else if (product) {
      payload = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || metaDesc,
        image: product.image || image,
        sku: product.sku,
        category: product.category,
        brand: product.brand
          ? { "@type": "Brand", name: product.brand }
          : { "@type": "Brand", name: siteName },
        offers: {
          "@type": "Offer",
          priceCurrency: product.currency || "BRL",
          price: product.price.toFixed(2),
          availability: `https://schema.org/${product.availability || "InStock"}`,
          url: canonical,
          seller: {
            "@type": "Organization",
            name: siteName,
          },
        },
      };
    } else {
      payload = {
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

    const blocks = Array.isArray(payload) ? payload : [payload];
    blocks.forEach((block) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", "true");
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());
      document.querySelectorAll('meta[data-seo-robots]').forEach((m) => m.remove());
    };
  }, [title, description, canonical, image, type, product, jsonLd, noindex]);
};

export default useSEO;

