# Infoleg Proxy

`infoleg-proxy` es un proxy ligero y lector de la plataforma InfoLEG de la Argentina. Permite buscar normas, mostrar fichas normativas y acceder a textos oficiales con una interfaz sencilla alojada localmente.

## Características

- Búsqueda por norma (tipo, número, año)
- Búsqueda por texto libre
- Visualización de fichas normativas con metadatos básicos
- Detección de índices temáticos en normas como la Ley 340 (Código Civil histórico)
- Redirección honesta al sitio oficial de InfoLEG cuando el texto normativo no está disponible como un texto lineal único
- Secciones dedicadas para:
  - Constitución y tratados constitucionales
  - Códigos

## Requisitos

- Node.js 18+ o compatible
- Conexión a Internet para consultar InfoLEG

## Instalación

```bash
cd /home/chelo/infoleg-proxy
npm install
```

## Uso

```bash
npm start
```

Luego abrir en el navegador:

- `http://localhost:8787/` — Home y buscador
- `http://localhost:8787/constituciones` — Sección Constitución y tratados
- `http://localhost:8787/codigos` — Sección Códigos

## API local

### `/api/infoleg/search`

Parámetros:

- `texto` — texto para buscar en InfoLEG

Ejemplo:

```
/api/infoleg/search?texto=contrato
```

### `/api/infoleg/norma`

Parámetros:

- `url` — URL de la norma en InfoLEG

Ejemplo:

```
/api/infoleg/norma?url=https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=109481
```

## Archivo principal

- `server.js` — servidor Express principal y lógica de scraping/transformación

## Notas

- El proyecto no incluye una base de datos ni almacenamiento persistente.
- Las rutas de lectura de InfoLEG se consultan en tiempo real.
- El registro de la lógica principal está en `server.js`.

## Estructura del proyecto

- `server.js` — implementación del servidor y renderizado HTML
- `package.json` — dependencias y script de inicio
- `README.md` — documentación del proyecto
