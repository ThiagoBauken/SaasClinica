import { useEffect } from "react";

interface SEOOptions {
  title: string;
  description?: string;
  canonical?: string;
}

/**
 * Atualiza título, meta description e link canonical da página.
 *
 * O HTML estático em `client/index.html` cobre os crawlers que NÃO executam JS
 * (WhatsApp, Slack, alguns scrapers). Este hook sobrescreve em runtime quando
 * o React monta — Google e Twitter executam JS e pegam o valor atualizado.
 */
export function useSEO({ title, description, canonical }: SEOOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);

      // Open Graph + Twitter — também atualiza para esta página específica
      const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
      ogDesc?.setAttribute("content", description);
      const twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
      twDesc?.setAttribute("content", description);
    }

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    ogTitle?.setAttribute("content", title);
    const twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    twTitle?.setAttribute("content", title);

    if (canonical) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);

      const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      ogUrl?.setAttribute("content", canonical);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, canonical]);
}
