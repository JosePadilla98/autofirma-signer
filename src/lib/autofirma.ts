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
 * Must be called before sign(). Resolves immediately; connection errors
 * surface later through the sign() error callback.
 */
export function initAutoFirma(): void {
  if (!isAutoScriptLoaded()) {
    throw new Error('AutoScript no está cargado. Comprueba que /vendor/autoscript.js está disponible.');
  }
  window.AutoScript.cargarAppAfirma();
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
