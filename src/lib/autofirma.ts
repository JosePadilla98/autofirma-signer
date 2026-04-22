const SIGN_ALGORITHM = 'SHA256withRSA';
const SIGN_FORMAT = 'PAdES';
const SIGN_PARAMS = 'format=PAdES';

/**
 * Returns true if autoscript.js has been loaded and AutoScript is available on window.
 */
export function isAutoScriptLoaded(): boolean {
  return typeof window.AutoScript !== 'undefined';
}

/**
 * Initialises the AutoFirma native client.
 *
 * On desktop: uses a local WebSocket connection — no servletBaseUrl needed.
 * On mobile:  uses the intermediate-server mode. Pass the base URL of the
 *             server where the two AutoFirma servlets are deployed, e.g.
 *             "https://mi-servidor.com". AutoScript will automatically resolve:
 *               - /afirma-signature-storage/StorageService
 *               - /afirma-signature-retriever/RetrieveService
 *
 * @param servletBaseUrl - Origin of the servlet server (mobile mode only).
 */
export function initAutoFirma(servletBaseUrl?: string): void {
  if (!isAutoScriptLoaded()) {
    throw new Error('AutoScript no está cargado. Comprueba que /vendor/autoscript.js está disponible.');
  }

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobile && !servletBaseUrl) {
    throw new Error(
      'Modo móvil: configura PUBLIC_SERVLET_BASE_URL con la URL del servidor de servlets.',
    );
  }

  // Passing servletBaseUrl lets AutoScript derive the two servlet paths from it
  // and switch to AppAfirmaJSWebService mode on mobile automatically.
  window.AutoScript.cargarAppAfirma(servletBaseUrl ?? undefined);
}

/**
 * Signs a PDF (supplied as a Base64 string) using AutoFirma PAdES/SHA256withRSA.
 *
 * @param base64Pdf - The PDF content encoded in Base64.
 * @returns A Promise that resolves with the signed PDF in Base64.
 */
export function signPdf(base64Pdf: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isAutoScriptLoaded()) {
      reject(new Error('AutoScript no está cargado.'));
      return;
    }

    window.AutoScript.sign(
      base64Pdf,
      SIGN_ALGORITHM,
      SIGN_FORMAT,
      SIGN_PARAMS,
      (signatureB64: string) => {
        resolve(signatureB64);
      },
      (errorType: string, errorMessage: string) => {
        reject(buildSignError(errorType, errorMessage));
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSignError(errorType: string, errorMessage: string): Error {
  const knownTypes: Record<string, string> = {
    'es.gob.afirma.standalone.afirma5.ws.client.socket.AutoFirmaConnectionException':
      'No se pudo conectar con AutoFirma. ¿Está instalado y en ejecución?',
    java_cancel: 'El usuario canceló la operación de firma.',
    cancel: 'El usuario canceló la operación de firma.',
    timeout: 'Tiempo de espera agotado. AutoFirma no respondió.',
  };

  const friendly = knownTypes[errorType] ?? `Error inesperado: ${errorMessage ?? errorType}`;
  const err = new Error(friendly);
  err.name = errorType ?? 'AutoFirmaError';
  return err;
}
