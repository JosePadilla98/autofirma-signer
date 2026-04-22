# AutoFirma Signer

Prototipo funcional para firmar documentos PDF con [AutoFirma](https://firmaelectronica.gob.es/Home/Descargas.html), construido con React 18, TypeScript y [Rsbuild](https://rsbuild.dev/).

Permite seleccionar un PDF, enviarlo a la aplicación nativa AutoFirma para firmarlo electrónicamente con el certificado del usuario, y descargar el PDF firmado, todo desde el navegador.

---

## Requisitos previos

- **Node.js** ≥ 18
- **AutoFirma** instalado en el equipo (descarga oficial: https://firmaelectronica.gob.es/Home/Descargas.html)
- En modo móvil: servidor con los servlets de AutoFirma desplegados (ver [Soporte móvil](#soporte-móvil))

---

## Instalación y desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:3000
npm run build      # compilación de producción → dist/
npm run preview    # previsualización del build
```

---

## Variables de entorno

Copia `.env.example` como `.env` en la raíz del proyecto y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PUBLIC_SERVLET_BASE_URL` | Solo en móvil | URL base del servidor con los servlets de AutoFirma para el modo móvil. Ejemplo: `https://firmas.mi-empresa.com` |

> Las variables con prefijo `PUBLIC_` se incrustan en el bundle del cliente en tiempo de compilación. No incluyas secretos con este prefijo.

### Ejemplo de `.env`

```dotenv
PUBLIC_SERVLET_BASE_URL=https://firmas.mi-empresa.com
```

Si la variable no está definida, la aplicación funciona con normalidad en escritorio y muestra un aviso bloqueante en dispositivos móviles.

---

## Estructura del proyecto

```
autofirma-signer/
├── public/
│   ├── index.html          # Plantilla HTML (punto de entrada Rsbuild)
│   ├── sample.pdf          # PDF de prueba incluido por defecto
│   └── vendor/
│       └── autoscript.js   # Librería oficial de AutoFirma (v1.9.0)
│
├── src/
│   ├── main.tsx            # Punto de entrada de React (createRoot)
│   ├── App.tsx             # Componente principal: UI, estados y flujo de firma
│   ├── lib/
│   │   ├── autofirma.ts    # Wrapper sobre AutoScript: initAutoFirma, signPdf
│   │   └── base64.ts       # Utilidades Base64: arrayBufferToBase64, base64ToBlob
│   └── types/
│       └── global.d.ts     # Declaraciones de tipos globales (Window.AutoScript,
│                           #   ImportMetaEnv con PUBLIC_SERVLET_BASE_URL)
│
├── .env.example            # Plantilla de variables de entorno
├── .gitignore
├── MOBILE_SUPPORT.md       # Documentación detallada del soporte móvil
├── package.json
├── rsbuild.config.ts       # Configuración de Rsbuild
├── tsconfig.json
└── vercel.json             # Configuración de despliegue en Vercel
```

---

## Flujo de firma

1. El usuario pulsa **Firmar PDF**.
2. La app carga `sample.pdf` (o el PDF configurado), lo convierte a Base64.
3. Se llama a `AutoScript.sign()`, que abre la aplicación nativa AutoFirma.
4. El usuario elige su certificado en AutoFirma y confirma la firma.
5. AutoFirma devuelve el PDF firmado en Base64.
6. La app genera un Blob y muestra un enlace de descarga.

Todos los pasos quedan registrados en el panel de logs de la interfaz.

---

## Despliegue

### Vercel

El proyecto incluye `vercel.json` con la configuración necesaria. Basta con conectar el repositorio en [vercel.com](https://vercel.com) y añadir la variable de entorno en el panel de Vercel antes de cada despliegue:

```
Settings → Environment Variables → PUBLIC_SERVLET_BASE_URL
```

### Otros proveedores

Cualquier servicio de hosting estático es compatible (Netlify, GitHub Pages, S3…). El comando de build es `npm run build` y el directorio de salida es `dist/`.

---

## Soporte móvil

AutoFirma en móvil (Android / iOS) no usa WebSocket local sino un servidor intermediario. Para habilitarlo es necesario desplegar dos servlets Java y configurar `PUBLIC_SERVLET_BASE_URL`.

Consulta [MOBILE_SUPPORT.md](MOBILE_SUPPORT.md) para instrucciones detalladas.

---

## Tecnologías

| Tecnología | Versión | Rol |
|---|---|---|
| React | 18.3 | Framework UI |
| TypeScript | 5.5 | Tipado estático |
| Rsbuild | 1.3 | Build tool |
| autoscript.js | 1.9.0 | Cliente JavaScript de AutoFirma |
