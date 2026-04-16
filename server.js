import express from "express";
import cors from "cors";
import { writeFileSync } from "fs";

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
};

const PWA_META = `
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#0f172a" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="icon" type="image/svg+xml" href="/icons/icon-192x192.svg" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
    `;

const PWA_REGISTER_SCRIPT = `
      <script>
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
              .then(() => console.log('Service worker registrado'))
              .catch((err) => console.warn('Service worker no pudo registrarse', err));
          });
        }
      </script>
    `;

const PWA_NAV_STYLE = `
      <style>
        .top-nav-shell {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(248, 250, 252, 0.96);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
        }
        .top-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: flex-start;
          max-width: 1080px;
          margin: 0 auto;
          padding: 16px 0 18px;
        }
        .top-nav-spacer {
          height: 84px;
          margin-bottom: 18px;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 10px 14px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 0.95rem;
          line-height: 1.2;
          white-space: nowrap;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .nav-link:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }
        .nav-link.is-active {
          background: #0f172a;
          border-color: #0f172a;
          color: #ffffff;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .top-nav-shell {
            display: none;
          }
          .top-nav-spacer {
            display: none;
          }
        }
      </style>
    `;

function renderTopNav(links = []) {
  return `
      <div class="top-nav-shell">
        <div class="top-nav">
          ${links
            .map(
              (link) =>
                `<a class="nav-link${link.active ? " is-active" : ""}" href="${escaparHtml(link.href)}" ${
                  link.active ? 'aria-current="page"' : ""
                } ${link.attrs || ""}>${escaparHtml(link.label)}</a>`
            )
            .join("")}
        </div>
      </div>
      <div class="top-nav-spacer" aria-hidden="true"></div>
    `;
}

function buildPathWithParams(path, params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function buildLectorHref(url, returnTo = "") {
  return buildPathWithParams("/lector", { url, returnTo });
}

function buildVerTextoHref({
  url,
  origen = "",
  modo = "",
  returnTo = "",
  parte = "",
  libro = "",
  tituloIndice = "",
  capitulo = "",
  epigrafe = "",
  rango = "",
  nombre = "",
  fuente = "",
}) {
  return buildPathWithParams("/ver-texto", {
    url,
    origen,
    modo,
    returnTo,
    parte,
    libro,
    tituloIndice,
    capitulo,
    epigrafe,
    rango,
    nombre,
    fuente,
  });
}

function buildVerBloqueIndiceHref({
  url,
  anchor = "",
  origen = "",
  returnTo = "",
  nombre = "",
  parte = "",
  libro = "",
  titulo = "",
  capitulo = "",
  epigrafe = "",
  rango = "",
  fuente = "",
}) {
  return buildPathWithParams("/ver-bloque-indice", {
    url,
    anchor,
    origen,
    returnTo,
    nombre,
    parte,
    libro,
    titulo,
    capitulo,
    epigrafe,
    rango,
    fuente,
  });
}

function resolverFuenteBloqueIndice({ url = "", anchor = "", fuente = "" } = {}) {
  const fuenteNormalizada = limpiarUrlResultado(String(fuente || "").trim());
  const urlNormalizada = limpiarUrlResultado(String(url || "").trim());

  if (fuenteNormalizada) {
    const { baseUrl, anchor: anchorFuente } = separarUrlYFragmento(fuenteNormalizada);
    return {
      url: baseUrl || urlNormalizada,
      anchor: anchor || anchorFuente,
      fuente: fuenteNormalizada,
    };
  }

  const fuenteDerivada = urlNormalizada
    ? `${urlNormalizada}${anchor ? `#${anchor}` : ""}`
    : "";

  return {
    url: urlNormalizada,
    anchor,
    fuente: fuenteDerivada,
  };
}

function getContextualBackLink(returnTo = "", fallbackHref = "/") {
  if (returnTo) {
    return { href: returnTo, label: "Volver" };
  }

  return {
    href: fallbackHref,
    label: "Volver",
    attrs:
      'onclick="event.preventDefault(); if (window.history.length > 1) { window.history.back(); } else { window.location.href = this.href; }"',
  };
}

function decodeHtmlEntities(text = "") {
  return String(text)
    // entidades HTML comunes
    .replace(/&nbsp;/gi, " ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&agrave;/gi, "à")
    .replace(/&egrave;/gi, "è")
    .replace(/&igrave;/gi, "ì")
    .replace(/&ograve;/gi, "ò")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ntilde;/gi, "Ñ")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&Ccedil;/gi, "Ç")

    // entidades numéricas
    .replace(/&#225;/g, "á")
    .replace(/&#233;/g, "é")
    .replace(/&#237;/g, "í")
    .replace(/&#243;/g, "ó")
    .replace(/&#250;/g, "ú")
    .replace(/&#241;/g, "ñ")
    .replace(/&#252;/g, "ü")
    .replace(/&#231;/g, "ç")
    .replace(/&#224;/g, "à")
    .replace(/&#232;/g, "è")
    .replace(/&#236;/g, "ì")
    .replace(/&#242;/g, "ò")
    .replace(/&#249;/g, "ù")
    .replace(/&#193;/g, "Á")
    .replace(/&#201;/g, "É")
    .replace(/&#205;/g, "Í")
    .replace(/&#211;/g, "Ó")
    .replace(/&#218;/g, "Ú")
    .replace(/&#209;/g, "Ñ")
    .replace(/&#220;/g, "Ü")
    .replace(/&#199;/g, "Ç")

    // otras entidades comunes
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&bull;/gi, "•")
    .replace(/&deg;/gi, "°")

    // entidades hexadecimales
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))

    // entidades decimales faltantes
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(parseInt(dec, 10)))

    // fallback UTF roto típico
    .replace(/�/g, "")

    // espacios
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntitiesPreserveNewlines(texto = "") {
  return String(texto)
    // entidades HTML comunes
    .replace(/&nbsp;/gi, " ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&agrave;/gi, "à")
    .replace(/&egrave;/gi, "è")
    .replace(/&igrave;/gi, "ì")
    .replace(/&ograve;/gi, "ò")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ntilde;/gi, "Ñ")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&Ccedil;/gi, "Ç")

    // entidades numéricas
    .replace(/&#225;/g, "á")
    .replace(/&#233;/g, "é")
    .replace(/&#237;/g, "í")
    .replace(/&#243;/g, "ó")
    .replace(/&#250;/g, "ú")
    .replace(/&#241;/g, "ñ")
    .replace(/&#252;/g, "ü")
    .replace(/&#231;/g, "ç")
    .replace(/&#224;/g, "à")
    .replace(/&#232;/g, "è")
    .replace(/&#236;/g, "ì")
    .replace(/&#242;/g, "ò")
    .replace(/&#249;/g, "ù")
    .replace(/&#193;/g, "Á")
    .replace(/&#201;/g, "É")
    .replace(/&#205;/g, "Í")
    .replace(/&#211;/g, "Ó")
    .replace(/&#218;/g, "Ú")
    .replace(/&#209;/g, "Ñ")
    .replace(/&#220;/g, "Ü")
    .replace(/&#199;/g, "Ç")

    // otras entidades comunes
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&bull;/gi, "•")
    .replace(/&deg;/gi, "°")

    // entidades hexadecimales
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))

    // entidades decimales faltantes
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(parseInt(dec, 10)))

    // fallback UTF roto típico
    .replace(/�/g, "")

    // espacios y saltos de línea
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function limpiar(texto = "") {
  return decodeHtmlEntities(
    String(texto)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function limpiarTextoNorma(texto = "") {
  let t = decodeHtmlEntitiesPreserveNewlines(texto);

  t = t
    .replace(/Infoleg\s*-\s*Informaci[oó]n Legislativa/gi, " ")
    .replace(/Ministerio de Justicia.*?Aviso Legal/gi, " ")
    .replace(/infoleg@jus\.gob\.ar/gi, " ")
    .replace(/Copyright.*?\d{4}/gi, " ")
    .replace(/Texto completo de la norma/gi, " ")
    .replace(/Esta norma es complementada o modificada por \d+ norma\(s\)\./gi, " ")
    .replace(/Esta norma modifica o complementa a \d+ norma\(s\)\./gi, " ")
    .replace(/P[aá]gina:\s*\d+/gi, " ")
    .replace(/N[uú]mero:\s*\d+/gi, " ")
    .replace(/Publicado en el Bolet[ií]n Oficial.*?(?=Resumen:|$)/gi, " ")
    .replace(/Resumen:/gi, "\n\nResumen:\n")
    .replace(/(.{120,400}?)\1+/gs, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return t;
}

function limpiarTituloResultado(titulo = "") {
  return decodeHtmlEntities(titulo)
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutizarUrl(href = "", baseUrl = "https://www.infoleg.gob.ar/") {
  const raw = String(href || "").trim();
  if (!raw) return "";

  const hrefClean = decodeHtmlEntities(raw).replace(/&amp;/gi, "&").trim();

  if (/^https?:\/\//i.test(hrefClean)) {
    return hrefClean.replace(
      /^https?:\/\/www\.infoleg\.gob\.ar\/infolegInternet\//i,
      "https://servicios.infoleg.gob.ar/infolegInternet/"
    );
  }

  if (hrefClean.startsWith("//")) {
    return `https:${hrefClean}`;
  }

  try {
    const resolved = new URL(hrefClean, baseUrl).toString();
    return resolved.replace(
      /^https?:\/\/www\.infoleg\.gob\.ar\/infolegInternet\//i,
      "https://servicios.infoleg.gob.ar/infolegInternet/"
    );
  } catch (e) {
    if (hrefClean.startsWith("/")) {
      return `https://www.infoleg.gob.ar${hrefClean}`;
    }
    return `https://www.infoleg.gob.ar/${hrefClean}`;
  }
}

function buscarUrlTextoCompleto(html = "", baseUrl = "") {
  const anchors = [...String(html).matchAll(/<a[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)];

  const candidatos = anchors
    .map((m) => {
      const hrefValue = m[1] || m[2] || "";
      const href = limpiarUrlResultado(absolutizarUrl(hrefValue, baseUrl));
      const texto = limpiar(m[3]).toLowerCase();

      let score = 0;

      if (/texto actualizado/.test(texto)) score += 10;
      if (/texto completo/.test(texto)) score += 9;
      if (/texto ordenado/.test(texto)) score += 8;
      if (/texto/.test(texto)) score += 4;

      if (/texact\.htm/i.test(href)) score += 10;
      if (/norma\.htm/i.test(href)) score += 8;
      if (/texto/i.test(href)) score += 5;

      if (/regimen legal/i.test(texto)) score -= 8;
      if (/antecedente|complementaria|modificatoria|doctrina|jurisprudencia/i.test(texto)) score -= 6;

      return { href, texto, score };
    })
    .filter((x) => x.href && x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidatos.length > 0) {
    return candidatos[0].href;
  }

  // fallback por href típico aunque el texto del link no ayude
  const m2 = html.match(/href=(?:"([^\"]*(?:texact\.htm|norma\.htm|texto[^\"]*)[^\"]*)"|'([^']*(?:texact\.htm|norma\.htm|texto[^']*)[^']*)')/i);
  if (m2) {
    const hrefValue = m2[1] || m2[2] || "";
    return limpiarUrlResultado(absolutizarUrl(hrefValue, baseUrl));
  }

  return "";
}




function limpiarUrlResultado(url = "") {
  return String(url)
    .replace(/;jsessionid=[^?]+/i, "")
    .replace(/jsessionid=[^&]+&?/i, "")
    .replace(/&?jsessionid=[^&]+/i, "")
    .replace(/&amp;/gi, "&")
    .replace(/\?$/, "")
    .replace(/&$/, "");
}

function separarUrlYFragmento(url = "") {
  const raw = String(url || "").trim();
  const hashIndex = raw.indexOf("#");

  if (hashIndex === -1) {
    return { baseUrl: raw, anchor: "" };
  }

  return {
    baseUrl: raw.slice(0, hashIndex),
    anchor: raw.slice(hashIndex + 1).trim(),
  };
}

function insertarBaseHref(html = "", baseUrl = "") {
  if (!baseUrl || /<base[^>]*>/i.test(html)) return html;
  return String(html).replace(/<head([^>]*)>/i, `<head$1><base href="${escaparHtml(baseUrl)}">`);
}

function extraerOpcionesTextoNorma(html = "", urlOrigen = "") {
  const anchors = [...String(html).matchAll(/<a[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)];

  let textoActualizado = "";
  let textoCompleto = "";
  let regimenLegal = urlOrigen || "";

  for (const m of anchors) {
    const hrefValue = m[1] || m[2] || "";
    const href = limpiarUrlResultado(absolutizarUrl(hrefValue, urlOrigen));
    const texto = limpiar(m[3]).toLowerCase();

    // Evitar enlaces a la home que no son válidos
    if (href === 'https://www.infoleg.gob.ar/' || href === 'https://www.infoleg.gob.ar') {
      continue;
    }

    if (!textoActualizado && /texto actualizado/.test(texto)) {
      textoActualizado = href;
      continue;
    }

    if (!textoCompleto && /texto completo/.test(texto)) {
      textoCompleto = href;
      continue;
    }

    if (!regimenLegal && /regimen legal|régimen legal/.test(texto)) {
      regimenLegal = href;
    }
  }

  return {
    textoActualizado,
    textoCompleto,
    regimenLegal,
  };
}

function obtenerDestinoLecturaPreferido(opciones = {}, urlOrigen = "") {
  if (opciones.textoActualizado) {
    return {
      url: opciones.textoActualizado,
      modo: "actualizado",
    };
  }

  if (opciones.textoCompleto) {
    return {
      url: opciones.textoCompleto,
      modo: "completo",
    };
  }

  return {
    url: urlOrigen,
    modo: "",
  };
}

function limpiarCeldaIndice(html = "") {
  return decodeHtmlEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim()
  );
}

function normalizarEtiquetaIndice(texto = "") {
  const limpio = limpiarCeldaIndice(texto)
    .replace(/\s+/g, " ")
    .trim();

  if (!limpio) return "";

  return limpio
    .replace(/\bPARTE\b/gi, "Parte")
    .replace(/\bLIBRO\b/gi, "Libro")
    .replace(/\bT[IÍ]TULO\b/gi, "Título")
    .replace(/\bCAP[IÍ]TULO\b/gi, "Capítulo")
    .replace(/\bSECCI[ÓO]N\b/gi, "Sección");
}

function extraerIndiceTematico(html = "", urlBase = "") {
  const fuente = stripScriptsAndStyles(String(html || ""));
  const idxIndice = fuente.search(/[IÍ]NDICE\s+TEM[ÁA]TICO/i);

  if (idxIndice === -1) {
    return null;
  }

  let bloqueIndice = fuente.slice(idxIndice);
  const corte = bloqueIndice.search(/<a[^>]+href=["']#1["'][^>]*>/i);

  if (corte > 0) {
    bloqueIndice = bloqueIndice.slice(0, corte);
  }

  const tituloNorma = limpiarTituloNorma(extraerTituloNorma(html));
  const tokens = [];
  const tokenRegex = /<(p|div)[^>]*?(?:align=["']center["']|style=["'][^"']*text-align\s*:\s*center[^"']*["'])[^>]*>([\s\S]*?)<\/\1>|<table[\s\S]*?<\/table>/gi;
  let match;

  while ((match = tokenRegex.exec(bloqueIndice))) {
    if (match[0].toLowerCase().startsWith("<table")) {
      tokens.push({ type: "table", html: match[0] });
      continue;
    }

    const tablasInternas = [...String(match[0]).matchAll(/<table[\s\S]*?<\/table>/gi)];

    if (tablasInternas.length > 0) {
      for (const tabla of tablasInternas) {
        tokens.push({ type: "table", html: tabla[0] });
      }
      continue;
    }

    const texto = normalizarEtiquetaIndice(match[2]);
    if (texto) {
      tokens.push({ type: "heading", text: texto });
    }
  }

  if (tokens.length === 0) {
    return null;
  }

  const contexto = {
    parte: "",
    libro: "",
    titulo: "",
    capitulo: "",
  };
  const items = [];
  let cantidadConRango = 0;
  let cantidadConEnlace = 0;

  for (const token of tokens) {
    if (token.type === "heading") {
      const texto = token.text;
      const textoUpper = texto.toUpperCase();

      if (/^[IÍ]NDICE\s+TEM[ÁA]TICO$/i.test(texto)) {
        continue;
      }

      if (textoUpper === tituloNorma.toUpperCase()) {
        continue;
      }

      if (/^PARTE\b/i.test(texto)) {
        contexto.parte = texto;
        contexto.libro = "";
        contexto.titulo = "";
        contexto.capitulo = "";
        continue;
      }

      if (/^LIBRO\b/i.test(texto)) {
        contexto.libro = texto;
        contexto.titulo = "";
        contexto.capitulo = "";
        continue;
      }

      if (/^T[IÍ]TULO\b/i.test(texto)) {
        contexto.titulo = texto;
        contexto.capitulo = "";
        continue;
      }

      if (/^CAP[IÍ]TULO\b/i.test(texto)) {
        contexto.capitulo = texto;
      }

      continue;
    }

    const filas = [...token.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    for (const fila of filas) {
      const celdas = [...String(fila[1] || "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);

      if (celdas.length < 3) {
        continue;
      }

      const enlaceMatch = celdas[0].match(/href=(?:"([^"]+)"|'([^']+)')/i);
      const enlaceOficial = enlaceMatch
        ? limpiarUrlResultado(absolutizarUrl(enlaceMatch[1] || enlaceMatch[2] || "", urlBase))
        : "";
      const { baseUrl: bloqueUrl, anchor } = separarUrlYFragmento(enlaceOficial);

      const rubro = normalizarEtiquetaIndice(celdas[0]);
      const epigrafe = limpiarCeldaIndice(celdas[1]).replace(/\s+/g, " ").trim();
      const rangoArticulos = limpiarCeldaIndice(celdas[2]).replace(/\s+/g, " ").trim();
      const item = {
        parte: contexto.parte,
        libro: contexto.libro,
        titulo: contexto.titulo,
        capitulo: contexto.capitulo,
        epigrafe,
        rangoArticulos,
        bloqueUrl,
        anchor,
        enlaceOficial,
      };

      if (/^T[IÍ]TULO\b/i.test(rubro)) {
        item.titulo = rubro;
        item.capitulo = "";
      } else if (/^CAP(?:\.|[IÍ]TULO)\b/i.test(rubro)) {
        item.capitulo = rubro.replace(/^Cap\.\s*/i, "Capítulo ");
      } else if (/^SECCI[ÓO]N\b/i.test(rubro)) {
        item.capitulo = rubro;
      } else if (rubro && !item.epigrafe) {
        item.epigrafe = rubro;
      }

      if (!item.epigrafe && !item.rangoArticulos) {
        continue;
      }

      if (/art/i.test(item.rangoArticulos)) {
        cantidadConRango += 1;
      }

      if (item.enlaceOficial) {
        cantidadConEnlace += 1;
      }

      items.push(item);
    }
  }

  if (items.length < 3 || cantidadConRango < 3) {
    return null;
  }

  return {
    nombre: tituloNorma || "Código",
    titulo: "Índice temático",
    items,
    urlFuente: urlBase,
    tieneEnlacesProfundos: cantidadConEnlace > 0,
  };
}

function renderIndiceTematicoHtml({
  indice,
  fichaHref = "",
  backLink = { href: "/", label: "Volver" },
  textoHref = "",
  textoUrl = "",
  origenUrl = "",
}) {
  const grupos = [];

  for (const item of indice.items) {
    const ultima = grupos[grupos.length - 1];
    const mismaCabecera =
      ultima &&
      ultima.parte === item.parte &&
      ultima.libro === item.libro;

    if (mismaCabecera) {
      ultima.items.push(item);
      continue;
    }

    grupos.push({
      parte: item.parte,
      libro: item.libro,
      items: [item],
    });
  }

  const gruposHtml = grupos
    .map((grupo) => {
      const itemsHtml = grupo.items
        .map((item) => {
          const jerarquia = [item.titulo, item.capitulo].filter(Boolean).join(" · ");
          const fuenteBloque = item.enlaceOficial || (item.bloqueUrl ? `${item.bloqueUrl}${item.anchor ? `#${item.anchor}` : ""}` : "");
          const textoDestinoUrl = indice.urlFuente || textoUrl || origenUrl;
          const textoPosicionadoHref = buildPathWithParams("/ver-texto", {
            url: textoDestinoUrl,
            origen: origenUrl,
            returnTo: textoHref,
            parte: item.parte,
            libro: item.libro,
            tituloIndice: item.titulo,
            capitulo: item.capitulo,
            epigrafe: item.epigrafe,
            rango: item.rangoArticulos,
            nombre: indice.nombre,
            fuente: fuenteBloque,
          });
          const bloqueHref = fuenteBloque
            ? buildVerBloqueIndiceHref({
                url: item.bloqueUrl,
                anchor: item.anchor,
                returnTo: textoHref,
                origen: origenUrl,
                nombre: indice.nombre,
                parte: item.parte,
                libro: item.libro,
                titulo: item.titulo,
                capitulo: item.capitulo,
                epigrafe: item.epigrafe,
                rango: item.rangoArticulos,
                fuente: fuenteBloque,
              })
            : "";
          const enlacePrincipal = `<a class="indice-link indice-link-primary" href="${escaparHtml(textoPosicionadoHref)}">Ir al texto completo</a>`;
          const enlaceFallback = bloqueHref
            ? `<a class="indice-link" href="${escaparHtml(bloqueHref)}">Abrir bloque aislado</a>`
            : "";
          const enlaceSecundario = item.enlaceOficial
            ? `<a class="indice-link" href="${escaparHtml(item.enlaceOficial)}" target="_blank" rel="noopener">Abrir fuente oficial</a>`
            : "";

          return `
            <article class="indice-item">
              ${jerarquia ? `<div class="indice-jerarquia">${escaparHtml(jerarquia)}</div>` : ""}
              <h3>${escaparHtml(item.epigrafe || "Bloque temático")}</h3>
              ${item.rangoArticulos ? `<div class="indice-rango">${escaparHtml(item.rangoArticulos)}</div>` : ""}
              <div class="indice-actions">
                ${enlacePrincipal}
                ${enlaceFallback}
                ${enlaceSecundario}
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="indice-grupo">
          ${grupo.parte ? `<div class="indice-parte">${escaparHtml(grupo.parte)}</div>` : ""}
          ${grupo.libro ? `<h2>${escaparHtml(grupo.libro)}</h2>` : ""}
          <div class="indice-listado">${itemsHtml}</div>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      ${PWA_META}
      <title>${escaparHtml(indice.nombre)} | Índice temático</title>
      ${PWA_NAV_STYLE}
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px;
          line-height: 1.6;
          background: #f8fafc;
          color: #0f172a;
        }
        .hero,
        .indice-grupo,
        .info-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          box-shadow: 0 1px 10px rgba(15, 23, 42, 0.06);
        }
        .hero {
          padding: 28px;
          margin-bottom: 22px;
        }
        .hero h1 {
          margin: 0 0 6px;
          font-size: 1.85rem;
        }
        .hero p {
          margin: 0;
          color: #475569;
        }
        .hero-badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }
        .badge {
          background: #e2e8f0;
          color: #0f172a;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .hero-actions a,
        .indice-link {
          display: inline-block;
          text-decoration: none;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 0.95rem;
        }
        .hero-actions .primary {
          background: #0f172a;
          color: #ffffff;
        }
        .hero-actions .secondary,
        .indice-link {
          background: #e2e8f0;
          color: #0f172a;
        }
        .indice-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .indice-link-primary {
          background: #0f172a;
          color: #ffffff;
        }
        .contenido {
          display: grid;
          gap: 18px;
        }
        .indice-grupo {
          padding: 20px;
        }
        .indice-parte {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
          margin-bottom: 8px;
          font-weight: 700;
        }
        .indice-grupo h2 {
          margin: 0 0 16px;
          font-size: 1.2rem;
        }
        .indice-listado {
          display: grid;
          gap: 14px;
        }
        .indice-item {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          background: #fcfdff;
        }
        .indice-item h3 {
          margin: 4px 0 8px;
          font-size: 1.02rem;
        }
        .indice-jerarquia {
          color: #334155;
          font-weight: 600;
        }
        .indice-rango {
          color: #0f172a;
          font-weight: 700;
          margin-bottom: 12px;
        }
        @media (max-width: 768px) {
          body {
            padding: 16px;
          }
          .hero,
          .indice-grupo {
            padding: 18px;
          }
          .hero h1 {
            font-size: 1.45rem;
          }
          .hero-actions a,
          .indice-link {
            width: 100%;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      ${renderTopNav([
        { href: "/", label: "Inicio" },
        { href: "/constituciones", label: "Constituciones" },
        { href: "/codigos", label: "Códigos" },
        backLink,
        { href: fichaHref, label: "Ficha" },
        { href: textoHref, label: "Texto", active: true },
      ])}
      <section class="hero">
        <h1>${escaparHtml(indice.nombre)}</h1>
        <p>${escaparHtml(indice.titulo)}</p>
        <div class="hero-badges">
          <span class="badge">${indice.items.length} bloques indexados</span>
          <span class="badge">${indice.tieneEnlacesProfundos ? "Con enlaces oficiales por bloque" : "Con acceso oficial al texto"}</span>
        </div>
        <div class="hero-actions">
          <a class="primary" href="${escaparHtml(indice.urlFuente)}" target="_blank" rel="noopener">Abrir fuente oficial</a>
          <a class="secondary" href="${escaparHtml(fichaHref)}">Volver a la ficha</a>
        </div>
      </section>
      <main class="contenido">
        ${gruposHtml}
      </main>
      ${PWA_REGISTER_SCRIPT}
    </body>
    </html>
  `;
}

function extraerBloqueIndiceDesdeHtml(html = "", anchor = "") {
  const fuente = stripScriptsAndStyles(String(html || ""));
  const anchorEscapado = String(anchor || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (!anchorEscapado) {
    return null;
  }

  const patronInicio = new RegExp(
    `<a[^>]+(?:name|id)=["']${anchorEscapado}["'][^>]*>[\\s\\S]*?<\\/a>`,
    "i"
  );
  const inicioMatch = fuente.match(patronInicio);

  if (!inicioMatch || inicioMatch.index === undefined) {
    return null;
  }

  const inicio = inicioMatch.index;
  const despuesDelInicio = inicio + inicioMatch[0].length;
  const resto = fuente.slice(despuesDelInicio);
  const siguienteAnchorMatch = resto.match(/<a[^>]+(?:name|id)=["'][^"']+["'][^>]*>/i);
  const fin = siguienteAnchorMatch && siguienteAnchorMatch.index !== undefined
    ? despuesDelInicio + siguienteAnchorMatch.index
    : fuente.length;

  const encabezadoHtml = inicioMatch[0];
  const bloqueHtml = `${encabezadoHtml}${fuente.slice(despuesDelInicio, fin)}`;
  const textoBloque = limpiarTextoNorma(
    bloqueHtml
      .replace(/<\/p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
  );
  const textoNormalizado = normalizarSaltos(textoBloque);
  const lineas = textoNormalizado.split("\n").map((linea) => linea.trim()).filter(Boolean);
  const encabezado = lineas.shift() || "";
  const contenido = lineas.join("\n").trim();

  if (!encabezado && !contenido) {
    return null;
  }

  return {
    encabezado,
    contenido,
  };
}

function extraerBloqueIndiceFallback(html = "") {
  const norma = extraerNorma(html);
  const encabezado = String(
    norma.titulo || norma.encabezado || ""
  )
    .replace(/\s+/g, " ")
    .trim();
  const contenido = String(norma.textoPlano || norma.encabezado || "")
    .replace(/\s+\n/g, "\n")
    .trim();

  if (!encabezado && !contenido) {
    return null;
  }

  return {
    encabezado,
    contenido,
  };
}

function renderBloqueIndiceHtml({
  nombre = "",
  parte = "",
  libro = "",
  titulo = "",
  capitulo = "",
  epigrafe = "",
  rango = "",
  bloque = { encabezado: "", contenido: "" },
  fichaHref = "",
  backLink = { href: "/", label: "Volver" },
  indiceHref = "",
  fuente = "",
}) {
  const contenidoHtml = escaparHtml(bloque.contenido || "").replace(/\n/g, "<br>");
  const subtitulo = [parte, libro, titulo, capitulo].filter(Boolean);

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      ${PWA_META}
      <title>${escaparHtml(epigrafe || nombre || "Bloque indexado")} | Lector</title>
      ${PWA_NAV_STYLE}
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
          line-height: 1.7;
          background: #f8fafc;
          color: #0f172a;
        }
        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          box-shadow: 0 1px 10px rgba(15, 23, 42, 0.06);
          padding: 24px;
          margin-bottom: 18px;
        }
        .eyebrow {
          color: #475569;
          font-size: 0.9rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        h1 {
          margin: 8px 0 10px;
          font-size: 1.8rem;
          line-height: 1.2;
        }
        .meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .meta span {
          background: #e2e8f0;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .acciones {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .acciones a {
          display: inline-block;
          text-decoration: none;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 0.95rem;
        }
        .acciones .primary {
          background: #0f172a;
          color: #ffffff;
        }
        .acciones .secondary {
          background: #e2e8f0;
          color: #0f172a;
        }
        .contenido {
          white-space: pre-wrap;
          color: #334155;
        }
        @media (max-width: 768px) {
          body {
            padding: 16px;
          }
          .card {
            padding: 18px;
          }
          h1 {
            font-size: 1.45rem;
          }
          .acciones a {
            width: 100%;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      ${renderTopNav([
        { href: "/", label: "Inicio" },
        { href: "/constituciones", label: "Constituciones" },
        { href: "/codigos", label: "Códigos" },
        backLink,
        { href: fichaHref, label: "Ficha" },
        { href: indiceHref, label: "Índice" },
        { href: indiceHref, label: "Bloque", active: true },
      ])}
      <section class="card">
        <div class="eyebrow">${escaparHtml(nombre || "Código indexado")}</div>
        <h1>${escaparHtml(epigrafe || bloque.encabezado || "Bloque")}</h1>
        ${subtitulo.length ? `<p>${escaparHtml(subtitulo.join(" · "))}</p>` : ""}
        <div class="meta">
          ${rango ? `<span>${escaparHtml(rango)}</span>` : ""}
          ${bloque.encabezado ? `<span>${escaparHtml(bloque.encabezado)}</span>` : ""}
        </div>
        <div class="acciones">
          <a class="primary" href="${escaparHtml(indiceHref)}">Volver al índice</a>
          ${fuente ? `<a class="secondary" href="${escaparHtml(fuente)}" target="_blank" rel="noopener">Abrir fuente oficial</a>` : ""}
        </div>
      </section>
      <section class="card">
        <div class="contenido">${contenidoHtml}</div>
      </section>
      ${PWA_REGISTER_SCRIPT}
    </body>
    </html>
  `;
}

function normalizarTextoClave(texto = "") {
  return decodeHtmlEntities(String(texto || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugifyTexto(texto = "") {
  return normalizarTextoClave(texto)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extraerPrimerArticuloDeRango(rango = "") {
  const limpio = normalizarTextoClave(rango).replace(/\barts?\b/g, "articulo");
  const match = limpio.match(/\b(\d{1,4})\b/);
  return match ? match[1] : "";
}

function construirObjetivoIndiceDesdeQuery(query = {}) {
  return {
    parte: String(query.parte || "").trim(),
    libro: String(query.libro || "").trim(),
    titulo: String(query.tituloIndice || query.titulo || "").trim(),
    capitulo: String(query.capitulo || "").trim(),
    epigrafe: String(query.epigrafe || "").trim(),
    rango: String(query.rango || "").trim(),
    nombre: String(query.nombre || "").trim(),
    fuente: String(query.fuente || "").trim(),
  };
}

function tieneObjetivoIndice(objetivo = {}) {
  return Boolean(
    objetivo.parte ||
      objetivo.libro ||
      objetivo.titulo ||
      objetivo.capitulo ||
      objetivo.epigrafe ||
      objetivo.rango
  );
}

function obtenerRutaJerarquica(item = {}) {
  return [item.parte, item.libro, item.titulo, item.capitulo]
    .filter(Boolean)
    .map((valor) => normalizarTextoClave(valor))
    .filter(Boolean);
}

function coincidenJerarquias(candidata = [], objetivo = []) {
  if (objetivo.length === 0) return true;
  if (candidata.length < objetivo.length) return false;
  return objetivo.every((segmento, index) => candidata[index] === segmento);
}

function resolverObjetivoIndiceEnBloques(bloques = [], objetivo = {}) {
  if (!tieneObjetivoIndice(objetivo)) {
    return null;
  }

  const jerarquiaObjetivo = obtenerRutaJerarquica(objetivo);
  const tituloNormalizado = normalizarTextoClave(objetivo.titulo);
  const capituloNormalizado = normalizarTextoClave(objetivo.capitulo);
  const libroNormalizado = normalizarTextoClave(objetivo.libro);
  const parteNormalizada = normalizarTextoClave(objetivo.parte);
  const epigrafeNormalizado = normalizarTextoClave(objetivo.epigrafe);
  const primerArticulo = extraerPrimerArticuloDeRango(objetivo.rango);

  const coincidenciaDivision = (nivel, valorNormalizado) =>
    bloques.find((bloque) => {
      if (bloque.type !== "division" || bloque.level !== nivel) return false;
      if (!valorNormalizado) return false;
      return (
        bloque.normalizedTitle === valorNormalizado ||
        bloque.contextPath.includes(valorNormalizado)
      );
    });

  if (capituloNormalizado) {
    const match = coincidenciaDivision("capitulo", capituloNormalizado);
    if (match) return match;
  }

  if (tituloNormalizado) {
    const match = coincidenciaDivision("titulo", tituloNormalizado);
    if (match) return match;
  }

  if (libroNormalizado) {
    const match = coincidenciaDivision("libro", libroNormalizado);
    if (match) return match;
  }

  if (parteNormalizada) {
    const match = coincidenciaDivision("parte", parteNormalizada);
    if (match) return match;
  }

  if (primerArticulo) {
    const articulo = bloques.find((bloque) => {
      if (bloque.type !== "article") return false;
      if (String(bloque.articleNumber || "") !== primerArticulo) return false;
      return coincidenJerarquias(bloque.contextPath || [], jerarquiaObjetivo);
    });

    if (articulo) {
      return articulo;
    }
  }

  if (epigrafeNormalizado) {
    const porEpigrafe = bloques.find((bloque) => {
      const contenido = normalizarTextoClave(`${bloque.title || ""} ${bloque.plainText || ""}`);
      if (!contenido.includes(epigrafeNormalizado)) return false;
      return coincidenJerarquias(bloque.contextPath || [], jerarquiaObjetivo);
    });

    if (porEpigrafe) {
      return porEpigrafe;
    }
  }

  const fallbackJerarquia = [...jerarquiaObjetivo].reverse().find(Boolean);
  if (fallbackJerarquia) {
    const match = bloques.find((bloque) => {
      if (bloque.type !== "division") return false;
      return bloque.contextPath.includes(fallbackJerarquia);
    });

    if (match) {
      return match;
    }
  }

  return null;
}

function renderFichaNormaHtml({ urlOrigen = "", norma, opciones = {}, returnTo = "", indiceTematico = null }) {
  const esIndice = Boolean(indiceTematico);
  const fichaHref = buildLectorHref(urlOrigen, returnTo);
  const backLink = getContextualBackLink(returnTo, "/");
  const destinoLectura = obtenerDestinoLecturaPreferido(opciones, urlOrigen);
  
  const botones = [
    esIndice
      ? `<a class="boton-principal" href="${escaparHtml(
          buildVerTextoHref({
            url: destinoLectura.url,
            origen: urlOrigen,
            modo: destinoLectura.modo,
            returnTo: fichaHref,
          })
        )}">Ver índice temático</a>`
      : "",
    opciones.textoActualizado && !esIndice
      ? `<a class="boton-principal" href="${escaparHtml(
          buildVerTextoHref({
            url: opciones.textoActualizado,
            origen: urlOrigen,
            modo: "actualizado",
            returnTo: fichaHref,
          })
        )}">Texto actualizado</a>`
      : "",
    opciones.textoCompleto && !esIndice
      ? `<a class="boton-secundario" href="${escaparHtml(
          buildVerTextoHref({
            url: opciones.textoCompleto,
            origen: urlOrigen,
            modo: "completo",
            returnTo: fichaHref,
          })
        )}">Texto completo</a>`
      : "",
    opciones.regimenLegal
      ? `<a class="boton-secundario" href="${escaparHtml(
          buildVerTextoHref({
            url: opciones.regimenLegal,
            origen: urlOrigen,
            modo: "regimen",
            returnTo: fichaHref,
          })
        )}">Régimen legal</a>`
      : "",
    esIndice
      ? `<a class="boton-secundario" href="${escaparHtml(destinoLectura.url)}" target="_blank" rel="noopener">Abrir índice oficial en Infoleg</a>`
      : "",
    (!opciones.textoActualizado && !opciones.textoCompleto && !esIndice)
      ? `<a class="boton-principal" href="${escaparHtml(
          buildVerTextoHref({
            url: urlOrigen,
            origen: urlOrigen,
            returnTo: fichaHref,
          })
        )}">Ver texto completo</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      ${PWA_META}
      <title>${escaparHtml(norma.titulo)} | Buscador Normativo</title>
      ${PWA_NAV_STYLE}
      <style>
        body {
          font-family: system-ui, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 32px;
          line-height: 1.6;
          background: #f8fafc;
          color: #0f172a;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 1px 8px rgba(0,0,0,.08);
        }
        h1, h2 {
          margin-top: 0;
        }
        .meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin: 12px 0 20px;
        }
        .tag {
          background: #e2e8f0;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 14px;
        }
        .acciones {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .boton-principal,
        .boton-secundario {
          display: inline-block;
          text-decoration: none;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 14px;
        }
        .boton-principal {
          background: #0f172a;
          color: white;
        }
        .boton-secundario {
          background: #e2e8f0;
          color: #0f172a;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: inherit;
          margin: 0;
        }
      </style>
      <style>
        @media (max-width: 768px) {
          body {
            padding: 16px;
            font-size: 14px;
          }
          .card {
            padding: 16px;
            margin-bottom: 16px;
          }
          .meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .acciones {
            flex-direction: column;
            gap: 8px;
          }
          .boton-principal, .boton-secundario {
            text-align: center;
            padding: 14px 16px;
            font-size: 16px;
          }
        }
      </style>
    </head>
    <body>
      ${renderTopNav([
        { href: '/', label: 'Inicio' },
        { href: '/constituciones', label: 'Constituciones' },
        { href: '/codigos', label: 'Códigos' },
        backLink,
        { href: fichaHref, label: 'Ficha', active: true },
      ])}
      <div class="card">
        <h1>${escaparHtml(norma.titulo)}</h1>
        <div class="meta">
          <span class="tag">Tipo: ${escaparHtml(norma.tipo || "-")}</span>
          <span class="tag">Número: ${escaparHtml(norma.numero || "-")}</span>
          <span class="tag">Fecha: ${escaparHtml(norma.fecha || "-")}</span>
        </div>

        <h2>Resumen</h2>
        <pre>${escaparHtml(norma.resumen || "")}</pre>

        <div class="acciones">
          ${botones || `<a class="boton-principal" href="${escaparHtml(
            buildVerTextoHref({
              url: urlOrigen,
              origen: urlOrigen,
              returnTo: fichaHref,
            })
          )}">Ver texto completo</a>`}
        </div>
      </div>

      <div class="card">
        <h2>Encabezado</h2>
        <pre>${escaparHtml(norma.encabezado || "")}</pre>
      </div>
      ${PWA_REGISTER_SCRIPT}
    </body>
    </html>
  `;
}

function esUrlNormativa(url = "") {
  const u = url.toLowerCase();
  return (
    u.includes("servicios.infoleg.gob.ar/infoleginternet") ||
    u.includes("vernorma.do") ||
    u.includes("texact.htm") ||
    u.includes("norma.htm")
  );
}

function puntuarResultado(titulo = "", url = "") {
  const t = titulo.toLowerCase();
  const u = url.toLowerCase();

  let score = 0;

  if (esUrlNormativa(u)) score += 10;
  if (/ley|decreto|resoluci|disposici|acordada|decisión administrativa|decision administrativa/.test(t)) score += 6;
  if (/texto actualizado|texto ordenado|norma/.test(t)) score += 3;
  if (/servicios\.infoleg\.gob\.ar/.test(u)) score += 4;

  if (/page_id=|category|tag|author|feed|wp-content|wp-json|javascript:|mailto:/.test(u)) score -= 8;
  if (/ir al contenido|consultas particulares|constituciones del resto del mundo|códigos provinciales|ver anteproyectos/i.test(t)) score -= 8;
  if (titulo.length < 8) score -= 5;

  return score;
}

function deduplicarResultados(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = `${item.titulo}::${item.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }

  return out;
}

async function fetchHTML(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Error consultando ${url}: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || '';
  let encoding = 'utf-8';
  if (contentType.includes('iso-8859-1') || contentType.includes('latin1') || contentType.includes('windows-1252')) {
    encoding = 'iso-8859-1';
  } else if (url.includes('servicios.infoleg.gob.ar')) {
    // forzar para servicios que a veces no especifica pero es latin1
    encoding = 'iso-8859-1';
  }
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

function extraerResultados(html) {
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gis)];

  const resultados = matches
    .map((m) => {
      const titulo = limpiarTituloResultado(m[2]);
      const url = limpiarUrlResultado(absolutizarUrl(m[1]));
      const scoreBase = puntuarResultado(titulo, url);

      const tipo = extraerTipoDesdeTitulo(titulo);
      const numero = extraerNumeroDesdeTitulo(titulo);

      let score = scoreBase;

      if (tipo === "Ley") score += 2;
      if (tipo === "Decreto") score += 1;
      if (numero) score += 2;
      if (/texto actualizado|texto ordenado/i.test(titulo)) score += 3;
      if (/servicios\.infoleg\.gob\.ar/i.test(url)) score += 3;

      return {
        titulo,
        url,
        score,
        tipo,
        numero,
      };
    })
    .filter((r) => r.titulo.length > 5)
    .filter((r) => r.score > 0);

  const unicos = deduplicarResultados(resultados);

  return unicos
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(({ titulo, url, tipo, numero }) => ({ titulo, url, tipo, numero }));
}

function stripScriptsAndStyles(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

function extraerTituloNorma(html = "") {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const limpio = limpiar(h1[1]);
    if (limpio) return limpio;
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    const limpio = limpiar(title[1]);
    if (limpio) return limpio;
  }

  return "Norma";
}

function extraerTipoNorma(texto = "") {
  const t = texto.toLowerCase();

  if (/\bley\b/.test(t)) return "Ley";
  if (/\bdecreto\b/.test(t)) return "Decreto";
  if (/resoluci[oó]n/.test(t)) return "Resolución";
  if (/disposici[oó]n/.test(t)) return "Disposición";
  if (/acordada/.test(t)) return "Acordada";
  if (/decisi[oó]n administrativa/.test(t)) return "Decisión Administrativa";

  return "";
}

function extraerNumeroNorma(texto = "") {
  const m = texto.match(/\b(?:ley|decreto|resoluci[oó]n|disposici[oó]n|acordada|decisi[oó]n administrativa)\s+(\d{1,6}(?:\/\d{2,4})?)\b/i);
  if (m) return m[1];

  const m2 = texto.match(/\bN[uú]mero:\s*(\d{1,6})\b/i);
  if (m2) return m2[1];

  return "";
}

function extraerFechaNorma(texto = "") {
  const limpio = texto.toLowerCase();

  // 01/08/1995 o 01-08-1995
  const m1 = limpio.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
  if (m1) return m1[1];

  // 09-ago-1995 o 09/ago/1995
  const m2 = limpio.match(/\b(\d{1,2}\s*[-\/]\s*[a-záéíóúñ]{3,}\s*[-\/]\s*\d{4})\b/);
  if (m2) return m2[1];

  // 9 de agosto de 1995
  const m3 = limpio.match(/\b(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\b/);
  if (m3) return m3[1];

  return "";
}

function extraerTipoDesdeTitulo(titulo = "") {
  const t = titulo.toLowerCase();

  if (/\bley\b/.test(t)) return "Ley";
  if (/\bdecreto\b/.test(t)) return "Decreto";
  if (/resoluci[oó]n/.test(t)) return "Resolución";
  if (/disposici[oó]n/.test(t)) return "Disposición";
  if (/acordada/.test(t)) return "Acordada";

  return "";
}

function extraerNumeroDesdeTitulo(titulo = "") {
  const limpio = String(titulo).replace(/[.,]/g, "");

  const m = limpio.match(/\b(\d{4,6})(?:\/\d{2,4})?\b/);

  return m ? m[1] : "";
}

function normalizarTipoNorma(tipo = "") {
  const t = String(tipo).trim().toLowerCase();

  if (t === "ley") return "Ley";
  if (t === "decreto") return "Decreto";
  if (t === "resolucion" || t === "resolución") return "Resolución";
  if (t === "disposicion" || t === "disposición") return "Disposición";
  if (t === "acordada") return "Acordada";

  return "";
}

function construirUrlBusquedaNorma(tipo = "", numero = "", anio = "") {
  const tipoNorma = mapearTipoNormaInfoleg(tipo);
  const nro = String(numero || "").replace(/\D/g, "");
  const anioSancion = String(anio || "").trim();

  if (!tipoNorma || !nro) return "";

  return `https://servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do?anioSancion=${encodeURIComponent(anioSancion)}&numero=${encodeURIComponent(nro)}&tipoNorma=${encodeURIComponent(tipoNorma)}`;
}
function mapearTipoNormaInfoleg(tipo = "") {
  const t = normalizarTipoNorma(tipo);

  // verificado
  if (t === "Ley") return "1";
  if (t === "Decreto") return "2";

  // fallback: para los demás tipos, por ahora no forzamos buscarNormas.do
  return "";
}

function coincideTipo(resultado = {}, tipoBuscado = "") {
  if (!tipoBuscado) return true;
  return String(resultado.tipo || "").toLowerCase() === String(tipoBuscado).toLowerCase();
}

function coincideNumero(resultado = {}, numeroBuscado = "") {
  if (!numeroBuscado) return true;

  const numeroResultado = String(resultado.numero || "").replace(/\D/g, "");
  const numeroConsulta = String(numeroBuscado || "").replace(/\D/g, "");

  return numeroResultado === numeroConsulta;
}

function filtrarBusquedaNorma(resultados = [], tipo = "", numero = "") {
  const tipoNorm = normalizarTipoNorma(tipo);
  const numeroNorm = String(numero || "").replace(/\D/g, "");

  let filtrados = [...resultados];

  if (tipoNorm) {
    filtrados = filtrados.filter(
      (r) => String(r.tipo || "").toLowerCase() === tipoNorm.toLowerCase()
    );
  }

  // si no se pidió número, devolvemos lo filtrado por tipo
  if (!numeroNorm) {
    return filtrados;
  }

  // 1) coincidencia exacta por número normalizado
  const exactos = filtrados.filter((r) => {
    const nro = String(r.numero || "").replace(/\D/g, "");
    return nro === numeroNorm;
  });

  if (exactos.length > 0) {
    return exactos;
  }

  // 2) coincidencia del número dentro del título
  const enTitulo = filtrados.filter((r) =>
    String(r.titulo || "").replace(/\D/g, "").includes(numeroNorm)
  );

  if (enTitulo.length > 0) {
    return enTitulo;
  }

  // 3) si se pidió número y no hubo coincidencias, devolvemos vacío
  return [];
}

function limpiarTituloNorma(titulo = "") {
  return titulo
    .replace(/^Infoleg\s*-\s*Informaci[oó]n Legislativa\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extraerResumenNorma(texto = "") {
  const m = texto.match(/Resumen:\s*([\s\S]{1,1200})/i);
  if (m) {
    return m[1]
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
  }

  return texto.slice(0, 1200).trim();
}

function normalizarSaltos(texto = "") {
  return String(texto)
    .replace(/\r/g, "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function limpiarBasuraResidual(texto = "") {
  return texto
    .replace(/Infoleg\s*-\s*Informaci[oó]n Legislativa/gi, " ")
    .replace(/Ministerio de Justicia/gi, " ")
    .replace(/Aviso Legal/gi, " ")
    .replace(/Copyright/gi, " ")
    .replace(/infoleg@jus\.gob\.ar/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizarTextoComparacion(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function esTituloGeneralNorma(linea = "", tituloNorma = "") {
  const lineaNorm = normalizarTextoComparacion(linea);
  const tituloNorm = normalizarTextoComparacion(tituloNorma);

  if (!lineaNorm || !tituloNorm) return false;
  if (lineaNorm === tituloNorm) return true;

  return (
    lineaNorm.length >= 12 &&
    tituloNorm.length >= 12 &&
    (lineaNorm.includes(tituloNorm) || tituloNorm.includes(lineaNorm))
  );
}

function esPosibleEncabezadoEstructural(linea = "") {
  const limpio = String(linea || "").trim();
  if (!limpio) return false;
  if (limpio.length > 120) return false;

  return /^(?:PARTE|LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N)\b/i.test(limpio);
}

function extraerDatosDivision(linea = "") {
  const limpio = String(linea || "").trim().replace(/\s+/g, " ");
  const match = limpio.match(
    /^(PARTE|LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N)\s+(.+?)(?:\s*[-–—.:]\s*(.+))?$/i
  );

  if (!match) return null;

  const tipo = match[1];
  const identificador = String(match[2] || "").trim();
  const detalle = String(match[3] || "").trim();

  if (!identificador) return null;

  return {
    tipo,
    identificador,
    detalle,
  };
}

function esLineaComplementariaDivision(linea = "") {
  const limpio = String(linea || "").trim();
  if (!limpio) return false;
  if (limpio.length > 100) return false;
  if (esPosibleEncabezadoEstructural(limpio)) return false;
  if (/^(?:ART[ÍI]CULO|ARTICULO|ART\.?)\b/i.test(limpio)) return false;

  return /^[A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9 ,;()/"'°º.-]*$/.test(limpio);
}

function buscarSiguienteLineaNoVacia(lines = [], startIndex = 0) {
  for (let i = startIndex; i < lines.length; i++) {
    const line = String(lines[i] || "").trim();
    if (line) {
      return { line, index: i };
    }
  }

  return { line: "", index: -1 };
}

function esEpigrafeIntermedio(linea = "", siguienteLinea = "") {
  const limpio = String(linea || "").trim();
  const siguiente = String(siguienteLinea || "").trim();

  if (!limpio || !siguiente) return false;
  if (limpio.length < 4 || limpio.length > 90) return false;
  if (esPosibleEncabezadoEstructural(limpio)) return false;
  if (/^(?:ART[ÍI]CULO|ARTICULO|ART\.?)\b/i.test(limpio)) return false;
  if (!/^(?:ART[ÍI]CULO|ARTICULO|ART\.?)\b/i.test(siguiente)) return false;
  if (/[.:;]$/.test(limpio)) return false;

  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length > 8) return false;

  const letras = limpio.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letras.length < 4) return false;

  const mayusculas = (limpio.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length;
  const proporcionMayusculas = mayusculas / letras.length;

  return proporcionMayusculas >= 0.75;
}

function extraerArticulos(texto = "") {
  const limpio = normalizarSaltos(String(texto));
  const lines = limpio.split("\n");
  const articulos = [];
  let actual = null;
  let prevLine = "";

  const encabezadoArticulo = /^(?:ART[ÍI]CULO|ARTICULO|ART\.?)\s+(\d{1,4}(?:[°º]?|bis|ter|quater|quinquies)?)(?:\s*[-–—.:]\s*(.*))?$/i;

  const esLineaVacia = (line) => !/\S/.test(line);
  const esEncabezadoPrevio = (line) => /^(?:ART[ÍI]CULO|ARTICULO|ART\.?|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N|PARTE)\b/i.test(String(line).trim());

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(encabezadoArticulo);
    const canOpenArticulo = match && (prevLine === "" || esLineaVacia(prevLine) || esEncabezadoPrevio(prevLine));

    if (canOpenArticulo) {
      if (actual) {
        articulos.push({
          numero: actual.numero,
          texto: actual.texto.join("\n").trim(),
        });
      }

      const numero = String(match[1] || "").replace(/[°º]$/i, "").trim();
      const textoInicial = String(match[2] || "").trim();

      actual = {
        numero,
        texto: textoInicial ? [textoInicial] : [],
      };
      prevLine = rawLine;
      continue;
    }

    if (actual && line) {
      actual.texto.push(line);
    }

    prevLine = rawLine;
  }

  if (actual) {
    articulos.push({
      numero: actual.numero,
      texto: actual.texto.join("\n").trim(),
    });
  }

  return articulos;
}

function extraerEncabezadoNorma(texto = "") {
  const limpio = normalizarSaltos(String(texto).replace(/@@BOLD_(?:START|END)@@/g, ""));
  const idx = limpio.search(/(^|\n)\s*(?:ART[ÍI]CULO|ARTICULO|ART\.?)(?:\s+)1(?:\s*[-–—.:]\s*|\s*$)/i);

  let encabezado = idx === -1 ? limpio.slice(0, 1200) : limpio.slice(0, idx);

  return encabezado
    .replace(/Infoleg.*?\n/gi, "")
    .replace(/Ministerio de Justicia.*?\n/gi, "")
    .replace(/Aviso Legal.*?\n/gi, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extraerItemsColeccion(html) {
  const anchors = [...String(html).matchAll(/<a[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)];

  const items = anchors
    .map((m) => {
      const hrefValue = m[1] || m[2] || "";
      const href = absolutizarUrl(hrefValue);
      const texto = limpiarTituloResultado(limpiar(m[3])).trim();

      // Filtrar links relevantes: verNorma.do o norma.htm
      if (!href.includes('verNorma.do') && !href.includes('norma.htm')) {
        return null;
      }

      // Evitar links vacíos o irrelevantes
      if (!texto || texto.length < 3) {
        return null;
      }

      return {
        titulo: texto,
        url: href,
      };
    })
    .filter(Boolean)
    .filter((item) => item.titulo && item.url);

  return items;
}

function escaparHtml(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderListadoColeccion(titulo, items = [], currentPath = "") {
  const listado = items
    .map(
      (item) => `
      <div class="item">
        <div class="titulo">${escaparHtml(item.titulo)}</div>
        <div class="acciones">
          <a class="boton-texto" href="${escaparHtml(buildLectorHref(item.url, currentPath))}">Ver ficha</a>
        </div>
      </div>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      ${PWA_META}
      <title>${escaparHtml(titulo)} | Buscador Normativo</title>
      ${PWA_NAV_STYLE}
      <style>
        body {
          font-family: system-ui, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 32px;
          background: #f8fafc;
          color: #0f172a;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 1px 8px rgba(0,0,0,.08);
        }
        h1 {
          margin-top: 0;
        }
        .sub {
          color: #475569;
          margin-top: -6px;
        }
        .navegacion {
          margin-bottom: 20px;
        }
        .navegacion a {
          text-decoration: none;
          background: #e2e8f0;
          color: #0f172a;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
        }
        .item {
          background: white;
          padding: 16px;
          margin-bottom: 10px;
          border-radius: 10px;
          box-shadow: 0 1px 8px rgba(0,0,0,.08);
        }
        .titulo {
          font-weight: bold;
          margin-bottom: 8px;
        }
        .acciones {
          margin-top: 12px;
        }
        .boton-texto {
          display: inline-block;
          text-decoration: none;
          background: #0f172a;
          color: white;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
        }
        .boton-texto:hover {
          opacity: .92;
        }
      </style>
      <style>
        @media (max-width: 768px) {
          body {
            padding: 16px;
          }
          .card {
            padding: 16px;
            margin-bottom: 16px;
          }
          .item {
            padding: 12px;
          }
          .boton-texto {
            padding: 12px 16px;
            font-size: 16px;
          }
        }
      </style>
    </head>
    <body>
      ${renderTopNav([
        { href: '/', label: 'Inicio' },
        { href: '/constituciones', label: 'Constituciones', active: currentPath === '/constituciones' },
        { href: '/codigos', label: 'Códigos', active: currentPath === '/codigos' },
        getContextualBackLink("", "/"),
      ])}
      <div class="card">
        <h1>${escaparHtml(titulo)}</h1>
        <p class="sub">Selecciona una norma para consultar su ficha completa.</p>
        <div class="navegacion">
          <a href="/">← Volver al inicio</a>
        </div>
      </div>

      ${listado || `<div class="card">No se encontraron items en esta colección.</div>`}
      ${PWA_REGISTER_SCRIPT}
    </body>
    </html>
  `;
}

function extraerNorma(html) {
  const limpio = stripScriptsAndStyles(html)
    .replace(/<(strong|b)[^>]*>/gi, "@@BOLD_START@@")
    .replace(/<\/(strong|b)>/gi, "@@BOLD_END@@");

  const posibleContenido = limpio
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");

  const textoMarcadoSinLimpiar = limpiarTextoNorma(posibleContenido);
  const textoMarcado = normalizarSaltos(textoMarcadoSinLimpiar).replace(/@@BOLD_(?:START|END)@@/g, "");
  const textoPlano = limpiarBasuraResidual(textoMarcado);

  const tituloRaw = extraerTituloNorma(html);
  const titulo = limpiarTituloNorma(tituloRaw);

  const base = `${titulo}\n${textoPlano}`;

  const tipo = extraerTipoNorma(base);
  const numero = extraerNumeroNorma(base);
  const fecha = extraerFechaNorma(base);
  const resumen = extraerResumenNorma(textoPlano);
  const encabezado = extraerEncabezadoNorma(textoMarcado);
  const articulos = extraerArticulos(textoMarcado);

  return {
    titulo,
    tipo,
    numero,
    fecha,
    resumen,
    encabezado,
    articulos,
    textoPlano,
  };
}

function extraerBloquesNormativos(texto = "", tituloNorma = "") {
  const ordinalsAntes = [
    "PRIMERA",
    "SEGUNDA",
    "TERCERA",
    "CUARTA",
    "QUINTA",
    "SEXTA",
    "SÉPTIMA",
    "OCTAVA",
    "NOVENA",
    "DÉCIMA",
    "UNDÉCIMA",
    "DUODÉCIMA",
  ];
  const ordinalsDespues = [
    "PRIMERO",
    "SEGUNDO",
    "TERCERO",
    "CUARTO",
    "QUINTO",
    "SEXTO",
    "SÉPTIMO",
    "OCTAVO",
    "NOVENO",
    "DÉCIMO",
    "UNDÉCIMO",
    "DUODÉCIMO",
  ];
  const romanNumerals = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];

  const encabezadoArticulo = /^(?:ART[ÍI]CULO|ARTICULO|ART\.?)(?:\s+)(\d{1,4}(?:[°º]?|bis|ter|quater|quinquies)?)(?:\s*[-–—.:]\s*(.*))?$/i;
  const encabezadoEstructural = /^(?:PARTE|LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N)\b/i;

  const rawLines = normalizarSaltos(String(texto)).split(/\n/);
  const lines = rawLines.map((line) => line.trim());
  let prevLine = "";

  const bloques = [];
  let actual = { type: "intro", title: "", lines: [] };

  const cerrarBloqueActual = () => {
    if (actual.type === "intro" && actual.lines.length === 0) {
      return;
    }
    bloques.push(actual);
  };

  const normalizarTituloDivision = (raw = "") =>
    String(raw || "")
      .replace(/\bLIBRO\b/gi, "Libro")
      .replace(/\bT[IÍ]TULO\b/gi, "Título")
      .replace(/\bCAP[IÍ]TULO\b/gi, "Capítulo")
      .replace(/\bSECCI[ÓO]N\b/gi, "Sección")
      .replace(/\bPARTE\b/gi, "Parte")
      .replace(/\bPRIMERA\b/gi, "Primera")
      .replace(/\bSEGUNDA\b/gi, "Segunda")
      .replace(/\bTERCERA\b/gi, "Tercera")
      .replace(/\bCUARTA\b/gi, "Cuarta")
      .replace(/\bQUINTA\b/gi, "Quinta")
      .replace(/\bSEXTA\b/gi, "Sexta")
      .replace(/\bPRIMERO\b/gi, "Primero")
      .replace(/\bSEGUNDO\b/gi, "Segundo")
      .replace(/\bTERCERO\b/gi, "Tercero")
      .replace(/\bCUARTO\b/gi, "Cuarto")
      .replace(/\bQUINTO\b/gi, "Quinto")
      .replace(/\bSEXTO\b/gi, "Sexto")
      .trim();

  const detectarNivelDivision = (titulo = "") => {
    if (/^parte\b/i.test(titulo)) return "parte";
    if (/^libro\b/i.test(titulo)) return "libro";
    if (/^t[íi]tulo\b/i.test(titulo)) return "titulo";
    if (/^cap[íi]tulo\b/i.test(titulo)) return "capitulo";
    if (/^secci[óo]n\b/i.test(titulo)) return "seccion";
    return "division";
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = lines[i];
    const siguienteNoVacia = buscarSiguienteLineaNoVacia(lines, i + 1);
    const siguienteLinea = siguienteNoVacia.line || "";
    const divisionData = extraerDatosDivision(line);
    const articuloMatch = line.match(encabezadoArticulo);

    const puedeAbrir = !prevLine || !/\S/.test(prevLine) || encabezadoEstructural.test(String(prevLine).trim()) || /^(?:ART[ÍI]CULO|ARTICULO|ART\.?)\b/i.test(String(prevLine).trim());

    if (esTituloGeneralNorma(line, tituloNorma) && actual.type === "intro" && actual.lines.length === 0) {
      prevLine = rawLine;
      continue;
    }

    if (divisionData && puedeAbrir) {
      cerrarBloqueActual();
      const resto = String(divisionData.detalle || "").trim();
      const consumioSiguienteLinea =
        Boolean(siguienteLinea) &&
        esLineaComplementariaDivision(siguienteLinea) &&
        !resto;
      const tituloRaw = [line.trim(), consumioSiguienteLinea ? siguienteLinea : ""]
        .filter(Boolean)
        .join(" ")
        .trim();
      const titulo = normalizarTituloDivision(tituloRaw);

      actual = {
        type: "division",
        title: titulo,
        lines: resto ? [resto] : [],
      };
      if (consumioSiguienteLinea) {
        i += 1;
      }
      prevLine = rawLine;
      continue;
    }

    if (articuloMatch && puedeAbrir) {
      cerrarBloqueActual();
      const numero = String(articuloMatch[1] || "").replace(/[°º]$/i, "").trim();
      const resto = String(articuloMatch[2] || "").trim();
      actual = {
        type: "article",
        title: `Artículo ${numero}`,
        lines: resto ? [resto] : [],
      };
      prevLine = rawLine;
      continue;
    }

    if ((actual.type === "article" || actual.type === "division") && esEpigrafeIntermedio(line, siguienteLinea)) {
      cerrarBloqueActual();
      actual = {
        type: "epigraph",
        title: line,
        lines: [],
      };
      prevLine = rawLine;
      continue;
    }

    if (!/\S/.test(rawLine)) {
      actual.lines.push("");
    } else {
      actual.lines.push(line);
    }

    prevLine = rawLine;
  }

  cerrarBloqueActual();

  const contexto = {
    parte: "",
    libro: "",
    titulo: "",
    capitulo: "",
  };

  const bloquesNormalizados = bloques.map((bloque, index) => {
    const plainTextOriginal = String(bloque.lines.join("\n"))
      .replace(/@@BOLD_(?:START|END)@@/g, "")
      .trim();
    const plainText =
      bloque.type === "intro" && index === 0
        ? plainTextOriginal
            .split("\n")
            .filter((linea) => !esTituloGeneralNorma(linea, tituloNorma))
            .join("\n")
            .trim()
        : plainTextOriginal;
    const contentHtml = escaparHtml(plainText).replace(/\n/g, "<br>");

    if (bloque.type === "division") {
      const level = detectarNivelDivision(bloque.title);
      const normalizedTitle = normalizarTextoClave(bloque.title);

      if (level === "parte") {
        contexto.parte = bloque.title;
        contexto.libro = "";
        contexto.titulo = "";
        contexto.capitulo = "";
      } else if (level === "libro") {
        contexto.libro = bloque.title;
        contexto.titulo = "";
        contexto.capitulo = "";
      } else if (level === "titulo") {
        contexto.titulo = bloque.title;
        contexto.capitulo = "";
      } else if (level === "capitulo") {
        contexto.capitulo = bloque.title;
      } else if (level === "seccion") {
        contexto.capitulo = bloque.title;
      }

      const contextPath = obtenerRutaJerarquica(contexto);
      const id = `bloque-${level}-${slugifyTexto(bloque.title) || index + 1}`;

      return {
        type: "division",
        level,
        title: bloque.title,
        normalizedTitle,
        plainText,
        contentHtml,
        id,
        contextPath,
      };
    }

    if (bloque.type === "article") {
      const articleNumber = String(
        (bloque.title.match(/\d{1,4}/) || [])[0] || ""
      ).trim();

      return {
        type: "article",
        title: bloque.title,
        plainText,
        contentHtml,
        id: `articulo-${articleNumber || index + 1}`,
        articleNumber,
        contextPath: obtenerRutaJerarquica(contexto),
      };
    }

    if (bloque.type === "epigraph") {
      return {
        type: "epigraph",
        title: bloque.title,
        plainText,
        contentHtml,
        id: `epigrafe-${slugifyTexto(bloque.title) || index + 1}`,
        contextPath: obtenerRutaJerarquica(contexto),
      };
    }

    return {
      type: index === 0 ? "intro" : "paragraph",
      title: "",
      plainText,
      contentHtml,
      id: index === 0 ? "texto-intro" : `parrafo-${index + 1}`,
      contextPath: obtenerRutaJerarquica(contexto),
    };
  });

  const bloquesFusionados = [];

  for (const bloque of bloquesNormalizados) {
    const anterior = bloquesFusionados[bloquesFusionados.length - 1];

    if (
      bloque.type === "article" &&
      anterior?.type === "epigraph" &&
      coincidenJerarquias(bloque.contextPath || [], anterior.contextPath || [])
    ) {
      bloquesFusionados[bloquesFusionados.length - 1] = {
        ...bloque,
        subtitle: anterior.title,
      };
      continue;
    }

    bloquesFusionados.push(bloque);
  }

  return bloquesFusionados;
}

function renderBloquesNormativosHtml(bloques = [], objetivo = null) {
  const objetivoId = objetivo?.id || "";

  return bloques
    .map((bloque) => {
      const esObjetivo = objetivoId && bloque.id === objetivoId;
      const attrsObjetivo = esObjetivo
        ? ' data-target-match="true" tabindex="-1"'
        : "";

      if (bloque.type === "division") {
        return `
          <section id="${escaparHtml(bloque.id)}" class="bloque bloque-division"${attrsObjetivo}>
            <div class="division-titulo">${escaparHtml(bloque.title)}</div>
            ${bloque.plainText ? `<div class="division-contenido">${bloque.contentHtml}</div>` : ""}
          </section>
        `;
      }

      if (bloque.type === "article") {
        return `
          <section id="${escaparHtml(bloque.id)}" class="bloque bloque-articulo"${attrsObjetivo}>
            <div class="articulo-titulo">${escaparHtml(bloque.title)}</div>
            ${bloque.subtitle ? `<div class="articulo-subtitulo">${escaparHtml(bloque.subtitle)}</div>` : ""}
            <div class="articulo-texto">${bloque.contentHtml}</div>
          </section>
        `;
      }

      if (bloque.type === "epigraph") {
        return `
          <section id="${escaparHtml(bloque.id)}" class="bloque bloque-epigrafe"${attrsObjetivo}>
            <div class="epigrafe-titulo">${escaparHtml(bloque.title)}</div>
          </section>
        `;
      }

      const clase = bloque.type === "intro" ? "bloque bloque-intro" : "bloque bloque-parrafo";
      return `
        <section id="${escaparHtml(bloque.id)}" class="${clase}"${attrsObjetivo}>
          ${bloque.contentHtml}
        </section>
      `;
    })
    .join("");
}
function renderBuscadorHtml({
  q = "",
  tipo = "",
  numero = "",
  anio = "",
  resultados = [],
  currentPath = "/",
} = {}) {
  const items = resultados.length
    ? resultados
        .map(
          (r) => `
          <div class="resultado">
  <div class="titulo">${escaparHtml(r.titulo)}</div>
  <div class="meta">
    <span>${escaparHtml(r.tipo || "-")}</span>
    <span>${escaparHtml(r.numero || "-")}</span>
  </div>
  <div class="url">${escaparHtml(r.url)}</div>
  <div class="acciones">
    <a class="boton-texto" href="${escaparHtml(buildLectorHref(r.url, currentPath))}">Ver ficha</a>
  </div>
</div>
          `
        )
        .join("")
    : (q || tipo || numero || anio)
    ? `<div class="vacio">No se encontraron resultados con ese criterio de búsqueda.</div>`
    : "";

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      ${PWA_META}
      <title>Buscador Normativo</title>
      ${PWA_NAV_STYLE}
      <style>
        body {
          font-family: system-ui, sans-serif;
          max-width: 1024px;
          margin: 0 auto;
          padding: 32px;
          background: #f8fafc;
          color: #0f172a;
        }
        .card {
          background: white;
          border-radius: 18px;
          padding: 28px;
          margin-bottom: 24px;
          box-shadow: 0 2px 18px rgba(15, 23, 42, 0.06);
          border: 1px solid #e2e8f0;
        }
        h1, h2 {
          margin-top: 0;
        }
        h1 {
          font-size: 2.4rem;
          letter-spacing: -0.03em;
          line-height: 1.05;
        }
        h2 {
          font-size: 1.2rem;
          margin-bottom: 18px;
          color: #0f172a;
        }
        .sub {
          color: #475569;
          margin-top: 8px;
          font-size: 1rem;
          line-height: 1.6;
          max-width: 760px;
        }
        .notice {
          margin-top: 18px;
          color: #334155;
          font-size: 0.93rem;
          line-height: 1.5;
          opacity: 0.88;
        }
        .help {
          margin: 0;
          color: #475569;
          font-size: 0.95rem;
          line-height: 1.6;
        }
        form {
          display: grid;
          gap: 16px;
        }
        .fila {
          display: grid;
          grid-template-columns: 180px 1.2fr 130px auto;
          gap: 14px;
          align-items: end;
        }
        .fila-simple {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: stretch;
        }
        input, select {
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          font-size: 15px;
          color: #0f172a;
          background: #f8fafc;
        }
        input::placeholder,
        select option {
          color: #94a3b8;
        }
        button {
          padding: 14px 18px;
          border: none;
          background: #0f172a;
          color: white;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          min-width: 140px;
        }
        button:hover {
          opacity: 0.94;
        }
        .resultado {
          display: block;
          text-decoration: none;
          color: black;
          background: white;
          padding: 18px;
          margin-bottom: 12px;
          border-radius: 14px;
          box-shadow: 0 1px 12px rgba(15, 23, 42, 0.06);
        }
        .resultado:hover {
          outline: 1px solid #94a3b8;
        }
        .titulo {
          font-weight: 700;
          margin-bottom: 6px;
          font-size: 1rem;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 8px 0;
          font-size: 12px;
          color: #475569;
        }
        .meta span {
          background: #e2e8e0;
          border-radius: 999px;
          padding: 4px 10px;
        }
        .url {
          font-size: 12px;
          color: #64748b;
          word-break: break-all;
        }
        .vacio {
          background: white;
          padding: 18px;
          border-radius: 14px;
          box-shadow: 0 1px 12px rgba(15, 23, 42, 0.06);
          color: #475569;
        }
        .acciones {
          margin-top: 12px;
        }
        .boton-texto {
          display: inline-block;
          text-decoration: none;
          background: #0f172a;
          color: white;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
        }
        .boton-texto:hover {
          opacity: .92;
        }
        .navegacion {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .nav-card {
          background: white;
          border-radius: 18px;
          padding: 18px 20px;
          text-align: left;
          box-shadow: 0 1px 12px rgba(15, 23, 42, 0.06);
          text-decoration: none;
          color: #0f172a;
          transition: transform 0.2s, border-color 0.2s;
          border: 1px solid transparent;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 118px;
        }
        .nav-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
          border-color: #0f172a;
        }
        .nav-card h3 {
          margin: 0 0 10px 0;
          font-size: 1.05rem;
          line-height: 1.3;
        }
        .nav-card p {
          margin: 0;
          color: #475569;
          font-size: 0.95rem;
          line-height: 1.6;
        }
        .card-action {
          display: inline-block;
          margin-top: 10px;
          color: #0f172a;
          font-size: 0.95rem;
          font-weight: 600;
        }
      </style>
      <style>
        @media (max-width: 768px) {
          body {
            padding: 16px;
            font-size: 14px;
          }
          .card {
            padding: 20px;
            margin-bottom: 18px;
          }
          .navegacion {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .fila, .fila-simple {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          input, select, button {
            padding: 16px;
            font-size: 16px; /* Evitar zoom en iOS */
          }
          .resultado {
            padding: 16px;
          }
          .boton-texto {
            padding: 14px 18px;
            font-size: 16px;
          }
        }
      </style>
    </head>
    <body>
      ${renderTopNav([
        { href: '/', label: 'Inicio', active: true },
        { href: '/constituciones', label: 'Constituciones' },
        { href: '/codigos', label: 'Códigos' },
      ])}
      <div class="card page-hero">
        <h1>Buscador Normativo</h1>
        <p class="sub">Consulte el repositorio normativo oficial de InfoLEG.</p>
        <p class="notice">Esta aplicación consulta documentación oficial de InfoLEG y está diseñada para uso como herramienta de consulta normativa.</p>
      </div>

      <div class="navegacion">
        <a href="/constituciones" class="nav-card">
          <div>
            <h3>📜 Constitución y tratados constitucionales</h3>
          </div>
          <span class="card-action">Explorar sección</span>
        </a>
        <a href="/codigos" class="nav-card">
          <div>
            <h3>⚖️ Códigos</h3>
          </div>
          <span class="card-action">Explorar sección</span>
        </a>
      </div>

      <div class="card">
        <h2>Buscar norma por tipo y número</h2>
        <form method="GET" action="/">
          <div class="fila">
            <select name="tipo">
              <option value="">Tipo de norma</option>
              <option value="Ley" ${tipo === "Ley" ? "selected" : ""}>Ley</option>
              <option value="Decreto" ${tipo === "Decreto" ? "selected" : ""}>Decreto</option>
              <option value="Resolución" ${tipo === "Resolución" ? "selected" : ""}>Resolución</option>
              <option value="Disposición" ${tipo === "Disposición" ? "selected" : ""}>Disposición</option>
              <option value="Acordada" ${tipo === "Acordada" ? "selected" : ""}>Acordada</option>
            </select>

            <input
              type="text"
              name="numero"
              value="${escaparHtml(numero)}"
              placeholder="Ej.: 24522"
            />

            <input
              type="text"
              name="anio"
              value="${escaparHtml(anio)}"
              placeholder="Año de sanción (opcional)"
            />

            <button type="submit">Consultar norma</button>
          </div>
          <p class="help">El año de sanción es opcional; utilícelo para afinar la localización de la norma.</p>
        </form>
      </div>

      <div class="card">
        <h2>Buscar por texto libre</h2>
        <form method="GET" action="/">
          <div class="fila-simple">
            <input
              type="text"
              name="q"
              value="${escaparHtml(q)}"
              placeholder="Ej.: contrato de trabajo, responsabilidad civil, derechos humanos"
            />
            <button type="submit">Consultar texto</button>
          </div>
        </form>
      </div>

      ${items}
      ${PWA_REGISTER_SCRIPT}
    </body>
    </html>
  `;
}


app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const tipo = String(req.query.tipo || "").trim();
    const numero = String(req.query.numero || "").trim();
    const anio = String(req.query.anio || "").trim();
    const currentPath = req.originalUrl || "/";

    if (!q && !tipo && !numero && !anio) {
      return res.send(renderBuscadorHtml({ currentPath }));
    }

    let html = "";
    let resultados = [];

    if (tipo && numero) {
      const urlNorma = construirUrlBusquedaNorma(tipo, numero, anio);

      if (urlNorma) {
        html = await fetchHTML(urlNorma);
        resultados = extraerResultados(html);
        resultados = filtrarBusquedaNorma(resultados, tipo, numero);
      } else {
        const consulta = [tipo, numero, anio].filter(Boolean).join(" ");
        const url = `https://www.infoleg.gob.ar/?buscar=${encodeURIComponent(consulta)}`;
        html = await fetchHTML(url);
        resultados = extraerResultados(html);
        resultados = filtrarBusquedaNorma(resultados, tipo, numero);
      }
    } else {
      const url = `https://www.infoleg.gob.ar/?buscar=${encodeURIComponent(q)}`;
      html = await fetchHTML(url);
      resultados = extraerResultados(html);
    }

       
    res.send(
      renderBuscadorHtml({
      q,
      tipo,
      numero,
      anio,
      resultados,
      currentPath,
    })
  );
  } catch (e) {
    res.status(500).send(`
      <h1>Error</h1>
      <pre>${escaparHtml(e.message)}</pre>
    `);
  }
});

app.get("/constituciones", async (req, res) => {
  try {
    const html = await fetchHTML("https://www.infoleg.gob.ar/?page_id=63");
    const items = extraerItemsColeccion(html);
    res.send(renderListadoColeccion("Constitución y tratados constitucionales", items, req.originalUrl || "/constituciones"));
  } catch (e) {
    res.status(500).send(`Error: ${escaparHtml(e.message)}`);
  }
});

app.get("/codigos", async (req, res) => {
  try {
    const html = await fetchHTML("https://www.infoleg.gob.ar/?page_id=67");
    const items = extraerItemsColeccion(html);
    res.send(renderListadoColeccion("Códigos", items, req.originalUrl || "/codigos"));
  } catch (e) {
    res.status(500).send(`Error: ${escaparHtml(e.message)}`);
  }
});

app.get("/api/infoleg/search", async (req, res) => {
  try {
    const texto = String(req.query.texto || "").trim();
    const url = `https://www.infoleg.gob.ar/?buscar=${encodeURIComponent(texto)}`;

    const html = await fetchHTML(url);
    const resultados = extraerResultados(html);

    res.json({
      ok: true,
      query: texto,
      total: resultados.length,
      resultados,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.get("/api/infoleg/norma", async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "Falta el parámetro url",
      });
    }

    let html = await fetchHTML(url);

    const urlTextoCompleto = buscarUrlTextoCompleto(html, url);
    if (urlTextoCompleto) {
      html = await fetchHTML(urlTextoCompleto);
    }

    const norma = extraerNorma(html);

    res.json({
      ok: true,
      origen: url,
      norma,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.get("/lector", async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();
    const returnTo = String(req.query.returnTo || "").trim();

    if (!url) {
      return res.status(400).send("Falta el parámetro url");
    }

    const html = await fetchHTML(url);
    const norma = extraerNorma(html);
    const opciones = extraerOpcionesTextoNorma(html, url);
    const destinoLectura = obtenerDestinoLecturaPreferido(opciones, url);
    let indiceTematico = extraerIndiceTematico(html, url);

    if (!indiceTematico && destinoLectura.url && destinoLectura.url !== url) {
      try {
        const htmlLectura = await fetchHTML(destinoLectura.url);
        indiceTematico = extraerIndiceTematico(htmlLectura, destinoLectura.url);
      } catch (innerError) {
        console.warn("No se pudo inspeccionar índice temático en texto preferido:", innerError.message);
      }
    }

    console.log("OPCIONES DETECTADAS:", opciones);

    res.send(
      renderFichaNormaHtml({
        urlOrigen: url,
        norma,
        opciones,
        returnTo,
        indiceTematico,
      })
    );
  } catch (e) {
    res.status(500).send(`Error: ${escaparHtml(e.message)}`);
  }
});

app.get("/debug-opciones", async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).send("Falta el parámetro url");
    }

    const html = await fetchHTML(url);
    // Guardar HTML para debug
    writeFileSync('/tmp/debug.html', html);
    const opciones = extraerOpcionesTextoNorma(html, url);

    // Extraer todos los enlaces para debug
    const anchors = [...String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const enlaces = anchors.map(m => ({
      href: limpiarUrlResultado(absolutizarUrl(m[1])),
      texto: limpiar(m[2]).toLowerCase()
    }));

    res.json({
      url,
      opciones,
      enlaces,
      htmlLength: html.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/ver-bloque-indice", async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();
    const anchor = String(req.query.anchor || "").trim();
    const origen = String(req.query.origen || "").trim();
    const returnTo = String(req.query.returnTo || "").trim();
    const nombre = String(req.query.nombre || "").trim();
    const parte = String(req.query.parte || "").trim();
    const libro = String(req.query.libro || "").trim();
    const titulo = String(req.query.titulo || "").trim();
    const capitulo = String(req.query.capitulo || "").trim();
    const epigrafe = String(req.query.epigrafe || "").trim();
    const rango = String(req.query.rango || "").trim();
    const fuente = String(req.query.fuente || "").trim();
    const fuenteResuelta = resolverFuenteBloqueIndice({ url, anchor, fuente });
    const urlBloque = fuenteResuelta.url;
    const anchorBloque = fuenteResuelta.anchor;
    const fuenteOficial = fuenteResuelta.fuente;

    if (!urlBloque) {
      return res.status(400).send("Falta una fuente válida para abrir el bloque indexado");
    }

    const html = await fetchHTML(urlBloque);
    const bloque = anchorBloque
      ? extraerBloqueIndiceDesdeHtml(html, anchorBloque) || extraerBloqueIndiceFallback(html)
      : extraerBloqueIndiceFallback(html);

    if (!bloque) {
      return res.status(404).send("No se pudo localizar el contenido solicitado en la fuente oficial");
    }

    const fichaHref = buildLectorHref(origen || urlBloque, returnTo);
    const indiceHref = returnTo || buildVerTextoHref({ url: urlBloque, origen, returnTo: fichaHref });
    const backLink = getContextualBackLink(returnTo, indiceHref);

    res.send(
      renderBloqueIndiceHtml({
        nombre,
        parte,
        libro,
        titulo,
        capitulo,
        epigrafe,
        rango,
        bloque,
        fichaHref,
        backLink,
        indiceHref,
        fuente: fuenteOficial,
      })
    );
  } catch (e) {
    res.status(500).send(`Error: ${escaparHtml(e.message)}`);
  }
});

app.get("/ver-texto", async (req, res) => {
  try {
    let url = String(req.query.url || "").trim();
    const origen = String(req.query.origen || "").trim();
    const modo = String(req.query.modo || "").trim();
    const returnTo = String(req.query.returnTo || "").trim();
    const objetivoIndice = construirObjetivoIndiceDesdeQuery(req.query);
    const fichaHref = buildLectorHref(origen || url, returnTo);
    const backLink = getContextualBackLink(returnTo, fichaHref);

    if (!url) {
      return res.status(400).send("Falta el parámetro url");
    }

    let html = await fetchHTML(url);

    if (modo === "actualizado" || modo === "completo") {
      const opciones = extraerOpcionesTextoNorma(html, url);

      if (modo === "actualizado" && opciones.textoActualizado) {
        url = opciones.textoActualizado;
        html = await fetchHTML(url);
      } else if (modo === "completo" && opciones.textoCompleto) {
        url = opciones.textoCompleto;
        html = await fetchHTML(url);
      }
    }

    const norma = extraerNorma(html);
    const indiceTematico = extraerIndiceTematico(html, url);
    const textoHref = buildVerTextoHref({ url, origen, modo, returnTo });

    if (indiceTematico && !tieneObjetivoIndice(objetivoIndice)) {
      return res.send(
        renderIndiceTematicoHtml({
          indice: indiceTematico,
          fichaHref,
          backLink,
          textoHref,
          textoUrl: url,
          origenUrl: origen || url,
        })
      );
    }

    const bloquesNormativos = extraerBloquesNormativos(norma.textoPlano, norma.titulo);
    const objetivoResuelto = resolverObjetivoIndiceEnBloques(bloquesNormativos, objetivoIndice);
    const textoHtml = renderBloquesNormativosHtml(bloquesNormativos, objetivoResuelto);
    const pistaObjetivo = [objetivoIndice.capitulo, objetivoIndice.titulo, objetivoIndice.libro, objetivoIndice.parte, objetivoIndice.rango]
      .filter(Boolean)
      .join(" · ");
    const fallbackBloqueHref = objetivoResuelto || !tieneObjetivoIndice(objetivoIndice)
      ? ""
      : buildVerBloqueIndiceHref({
          url,
          origen,
          returnTo: textoHref,
          nombre: objetivoIndice.nombre || norma.titulo,
          parte: objetivoIndice.parte,
          libro: objetivoIndice.libro,
          titulo: objetivoIndice.titulo,
          capitulo: objetivoIndice.capitulo,
          epigrafe: objetivoIndice.epigrafe,
          rango: objetivoIndice.rango,
          fuente: objetivoIndice.fuente,
        });
    const scriptPosicionamiento = objetivoResuelto
      ? `
        <script>
          window.addEventListener('load', () => {
            const target = document.getElementById(${JSON.stringify(objetivoResuelto.id)});
            if (!target) return;
            target.classList.add('bloque-destacado');
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.setTimeout(() => target.classList.remove('bloque-destacado'), 2600);
            if (typeof history.replaceState === 'function') {
              history.replaceState(null, '', '#' + target.id);
            }
          });
        </script>
      `
      : "";

    const htmlRender = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        ${PWA_META}
        <title>${escaparHtml(norma.titulo)} | Texto de la Norma</title>
        ${PWA_NAV_STYLE}
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 820px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.7;
            background: #f8fafc;
            color: #0f172a;
            font-size: 16px;
          }
          @media (max-width: 768px) {
            body {
              padding: 14px;
              font-size: 15px;
            }
          }
          .titulo {
            font-size: 1.6em;
            font-weight: 700;
            margin-bottom: 20px;
            text-align: center;
            color: #1e293b;
          }
          .contenido {
            display: grid;
            gap: 20px;
          }
          .contexto-destino {
            margin: 0 0 20px;
            padding: 16px 18px;
            border-radius: 14px;
            background: #e0f2fe;
            border: 1px solid #7dd3fc;
            color: #0f172a;
          }
          .contexto-destino strong {
            display: block;
            margin-bottom: 4px;
          }
          .bloque {
            border-radius: 14px;
            padding: 18px;
            background: white;
            box-shadow: 0 1px 12px rgba(15,23,42,0.06);
            scroll-margin-top: 92px;
            transition: box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease;
          }
          .bloque-intro {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #334155;
          }
          .bloque-division {
            border-left: 4px solid #94a3b8;
            border: 1px solid #e2e8f0;
            background: white;
            padding: 16px 18px;
          }
          .division-titulo {
            font-weight: 600;
            color: #334155;
            margin-bottom: 8px;
            text-transform: none;
            letter-spacing: -0.01em;
          }
          .division-contenido,
          .articulo-texto,
          .bloque-parrafo {
            color: #334155;
            line-height: 1.85;
            white-space: pre-wrap;
          }
          .bloque-articulo {
            border: 1px solid #e2e8f0;
            padding: 18px;
          }
          .bloque-epigrafe {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            padding: 14px 18px;
          }
          .bloque-destacado {
            border-color: #0284c7;
            box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18), 0 8px 24px rgba(14, 165, 233, 0.16);
            background: #f0f9ff;
          }
          .articulo-titulo {
            font-weight: 700;
            margin-bottom: 12px;
            color: #0f172a;
          }
          .articulo-subtitulo {
            margin: -2px 0 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #334155;
          }
          .epigrafe-titulo {
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #334155;
            text-align: center;
          }
          .navegacion {
            text-align: center;
            margin-bottom: 24px;
          }
          .navegacion a {
            text-decoration: none;
            background: #0f172a;
            color: white;
            padding: 10px 16px;
            border-radius: 10px;
            font-size: 14px;
          }
          .navegacion a:hover {
            opacity: 0.92;
          }
        </style>
        <style>
          @media (max-width: 768px) {
            body {
              padding: 14px;
              font-size: 15px;
            }
            .titulo {
              font-size: 1.3em;
            }
            .bloque {
              padding: 16px;
            }
            .navegacion a {
              padding: 14px 18px;
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        ${renderTopNav([
          { href: '/', label: 'Inicio' },
          { href: '/constituciones', label: 'Constituciones' },
          { href: '/codigos', label: 'Códigos' },
          backLink,
          { href: fichaHref, label: 'Ficha' },
          { href: textoHref, label: 'Texto', active: true },
        ])}
        <h1 class="titulo">${escaparHtml(norma.titulo)}</h1>
        ${tieneObjetivoIndice(objetivoIndice) ? `
          <section class="contexto-destino">
            <strong>${objetivoResuelto ? "Ubicado desde el índice temático" : "No se pudo ubicar el tramo exacto"}</strong>
            <div>${escaparHtml(pistaObjetivo || objetivoIndice.epigrafe || "Entrada del índice")}</div>
            ${objetivoIndice.epigrafe ? `<div>${escaparHtml(objetivoIndice.epigrafe)}</div>` : ""}
            ${!objetivoResuelto && fallbackBloqueHref ? `<div style="margin-top:10px;"><a href="${escaparHtml(fallbackBloqueHref)}">Abrir bloque aislado como fallback</a></div>` : ""}
          </section>
        ` : ""}
        <div class="contenido">${textoHtml}</div>
${scriptPosicionamiento}
${PWA_REGISTER_SCRIPT}
    </body>
      </html>
    `;

    res.send(htmlRender);
  } catch (e) {
    res.status(500).send(`Error: ${escaparHtml(e.message)}`);
  }
});

app.get("/debug-links", async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({ ok: false, error: "Falta url" });
    }

    const html = await fetchHTML(url);

    const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({
        texto: limpiar(m[2]),
        hrefOriginal: m[1],
        hrefAbsoluto: limpiarUrlResultado(absolutizarUrl(m[1])),
      }))
      .filter((x) => x.texto || x.hrefOriginal);

    res.json({
      ok: true,
      origen: url,
      total: links.length,
      links,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
