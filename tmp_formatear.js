function formatearTextoNormativo(texto = "") {
  const ordinalAntes = "PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[EÉ]PTIMA|OCTAVA|NOVENA|D[EÉ]CIMA|UND[EÉ]CIMA|DUOD[EÉ]CIMA";
  const ordinalDespues = "PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PTIMO|OCTAVO|NOVENO|D[EÉ]CIMO|UND[EÉ]CIMO|DUOD[EÉ]CIMO";
  const romanos = "I{1,4}|V?I{0,3}|X{1,3}|[IVXLCDM]{1,4}";
  const divisionHeaderPattern = `(?:(?:${ordinalAntes})\\s+(?:PARTE|LIBRO)|(?:PARTE|LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N)\\s+(?:${ordinalDespues}|${romanos}))`;
  const divisionStartRegex = new RegExp(`(^|\\n)(${divisionHeaderPattern})(?=\\s|$)`, "gi");

  const limpio = String(texto)
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(divisionStartRegex, "$1\n\n$2")
    .replace(/\b(ART[ÍI]CULO|ARTICULO|ART\.?)(\s*)(\d{1,4}[°º]?)/gi, "\n\n$1 $3")
    .trim();

  const segmentos = limpio
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  return segmentos
    .map((segmento, index) => {
      const primerLinea = segmento.split(/\n/)[0].trim();
      const divisionHeaderStart = new RegExp(`^${divisionHeaderPattern}(?=\\s|$)`, "i");
      const esArticulo = /^(ART[ÍI]CULO\b|ARTICULO\b|ART\.?\s*\d+)/i.test(primerLinea);

      if (divisionHeaderStart.test(primerLinea)) {
        const match = primerLinea.match(divisionHeaderStart);
        const tituloRaw = match ? match[0].trim() : primerLinea;
        const titulo = String(tituloRaw)
          .replace(/\bLIBRO\b/gi, "Libro")
          .replace(/\bT[IÍ]TULO\b/gi, "Título")
          .replace(/\bCAP[IÍ]TULO\b/gi, "Capítulo")
          .replace(/\bSECCI[ÓO]N\b/gi, "Sección")
          .replace(/\bPARTE\b/gi, "Parte")
          .trim();

        const resto = segmento.slice(tituloRaw.length).trim();
        const contenido = resto ? `<div class="division-contenido">${escaparHtml(resto).replace(/\n/g, '<br>')}</div>` : "";

        return `\n          <div class="bloque bloque-division">\n            <div class="division-titulo">${escaparHtml(titulo)}</div>\n            ${contenido}\n          </div>\n        `;
      }

      if (esArticulo) {
        const tituloMatch = segmento.match(/^(ART[ÍI]CULO|ARTICULO|ART\.?)(\s*)(\d{1,4}[°º]?)/i);
        const numero = tituloMatch && tituloMatch[3] ? tituloMatch[3].replace(/[°º]$/i, "") : "";
        const titulo = numero ? `Artículo ${numero}` : (tituloMatch ? tituloMatch[0].replace(/ART\.?/i, "Artículo") : primerLinea);
        const texto = segmento.slice(tituloMatch ? tituloMatch[0].length : primerLinea.length).trim();

        return `\n          <div class="bloque bloque-articulo">\n            <div class="articulo-titulo">${escaparHtml(titulo)}</div>\n            <div class="articulo-texto">${escaparHtml(texto).replace(/\n/g, '<br>')}</div>\n          </div>\n        `;
      }

      const claseIntro = index === 0 ? 'bloque bloque-intro' : 'bloque bloque-parrafo';

      return `\n        <div class="${claseIntro}">\n          ${escaparHtml(segmento).replace(/\n/g, '<br>')}\n        </div>\n      `;
    })
    .join("");
}
module.exports={fn:formatearTextoNormativo};
