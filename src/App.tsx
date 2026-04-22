import { useCallback, useEffect, useRef, useState } from 'react';
import { initAutoFirma, isAutoScriptLoaded, signPdf } from './lib/autofirma';
import { arrayBufferToBase64, base64ToBlob } from './lib/base64';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppState = 'idle' | 'checking' | 'loading' | 'signing' | 'success' | 'error';

interface LogEntry {
  id: number;
  level: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

// ---------------------------------------------------------------------------
// Styles (inline – no external CSS dependency)
// ---------------------------------------------------------------------------

const styles = {
  root: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    minHeight: '100vh',
    background: '#f5f6fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box' as const,
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '40px',
    maxWidth: '560px',
    width: '100%',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 28px',
  },
  mobileWarning: {
    background: '#fffbeb',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#92400e',
    marginBottom: '20px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  },
  btn: (variant: 'primary' | 'secondary', disabled: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'opacity 0.2s',
    opacity: disabled ? 0.5 : 1,
    background: variant === 'primary' ? '#4f46e5' : '#e5e7eb',
    color: variant === 'primary' ? '#ffffff' : '#374151',
  }),
  logPanel: {
    background: '#0f172a',
    borderRadius: '8px',
    padding: '16px',
    minHeight: '160px',
    maxHeight: '260px',
    overflowY: 'auto' as const,
    fontFamily: "'Fira Code', 'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '1.7',
  },
  logEmpty: {
    color: '#475569',
    fontStyle: 'italic',
  },
  logLine: (level: LogEntry['level']): React.CSSProperties => ({
    color:
      level === 'error'
        ? '#f87171'
        : level === 'success'
        ? '#4ade80'
        : level === 'warn'
        ? '#fbbf24'
        : '#94a3b8',
    margin: 0,
  }),
  downloadSection: {
    marginTop: '20px',
    padding: '16px',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  downloadLink: {
    color: '#166534',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusDot: (state: AppState): React.CSSProperties => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '6px',
    background:
      state === 'success'
        ? '#22c55e'
        : state === 'error'
        ? '#ef4444'
        : state === 'idle'
        ? '#d1d5db'
        : '#f59e0b',
  }),
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const servletBaseUrl = import.meta.env.PUBLIC_SERVLET_BASE_URL?.replace(/\/$/, '') || undefined;
const mobileReady = !isMobile || !!servletBaseUrl;

let logCounter = 0;
function makeLog(level: LogEntry['level'], message: string): LogEntry {
  return { id: ++logCounter, level, message };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs((prev) => [...prev, makeLog(level, message)]);
  }, []);

  // ── Auto-scroll log panel ─────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Load autoscript.js dynamically ───────────────────────────────────────
  useEffect(() => {
    if (isAutoScriptLoaded()) {
      setScriptReady(true);
      addLog('success', 'AutoScript ya estaba cargado.');
      return;
    }

    const script = document.createElement('script');
    script.src = '/vendor/autoscript.js';
    script.async = true;

    script.onload = () => {
      setScriptReady(true);
      addLog('success', 'AutoScript cargado correctamente (/vendor/autoscript.js).');
    };

    script.onerror = () => {
      addLog(
        'error',
        'No se pudo cargar /vendor/autoscript.js. ' +
          'Coloca el archivo en public/vendor/autoscript.js.',
      );
    };

    document.head.appendChild(script);

    return () => {
      // cleanup only if still unloaded
      if (!isAutoScriptLoaded()) document.head.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check AutoFirma ───────────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    setState('checking');
    setLogs([]);

    if (!scriptReady || !isAutoScriptLoaded()) {
      addLog('error', 'AutoScript no está cargado. Espera a que se cargue el script.');
      setState('error');
      return;
    }

    try {
      initAutoFirma(servletBaseUrl);
      addLog('success', 'AutoFirma inicializado. Intentando conectar…');
      if (isMobile) {
        addLog('info', `Modo móvil: usando servidor intermedio en ${servletBaseUrl}.`);
      }
      addLog(
        'info',
        'La conexión real se verifica al firmar. ' +
          'Si AutoFirma no está instalado, el error aparecerá entonces.',
      );
      setState('idle');
    } catch (err) {
      addLog('error', (err as Error).message);
      setState('error');
    }
  }, [scriptReady, addLog]);

  // ── Sign PDF ──────────────────────────────────────────────────────────────
  const handleSign = useCallback(async () => {
    // Revoke previous object URL to avoid memory leaks
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    setState('loading');
    setLogs([]);

    // 1. Verify AutoScript
    if (!scriptReady || !isAutoScriptLoaded()) {
      addLog('error', 'AutoScript no está cargado.');
      setState('error');
      return;
    }
    addLog('success', 'AutoScript disponible.');

    // 2. Ensure AutoFirma client is initialised
    try {
      initAutoFirma(servletBaseUrl);
      addLog('success', `AutoFirma inicializado${isMobile ? ' (modo móvil)' : ''}.`);
    } catch (err) {
      addLog('error', (err as Error).message);
      setState('error');
      return;
    }

    // 3. Fetch sample PDF
    addLog('info', 'Cargando /sample.pdf…');
    let arrayBuffer: ArrayBuffer;
    try {
      const response = await fetch('/sample.pdf');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al cargar /sample.pdf`);
      }
      arrayBuffer = await response.arrayBuffer();
      addLog('success', `PDF cargado (${arrayBuffer.byteLength} bytes).`);
    } catch (err) {
      addLog('error', `Error al cargar el PDF: ${(err as Error).message}`);
      setState('error');
      return;
    }

    // 4. Encode to Base64
    const base64Pdf = arrayBufferToBase64(arrayBuffer);
    addLog('info', 'PDF codificado a Base64.');

    // 5. Sign
    setState('signing');
    addLog('info', 'Firma iniciada. Esperando acción del usuario en AutoFirma…');
    addLog('warn', 'La ventana de AutoFirma puede aparecer en segundo plano.');

    let signedBase64: string;
    try {
      signedBase64 = await signPdf(base64Pdf);
      addLog('success', 'Firma completada correctamente.');
    } catch (err) {
      addLog('error', `Error de firma: ${(err as Error).message}`);
      setState('error');
      return;
    }

    // 6. Convert to Blob & create download URL
    const blob = base64ToBlob(signedBase64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    addLog('success', `PDF firmado listo para descargar (${blob.size} bytes).`);
    setState('success');
  }, [scriptReady, addLog, downloadUrl]);

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isBusy = state === 'checking' || state === 'loading' || state === 'signing';
  const isBlocked = isMobile && !servletBaseUrl;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Header */}
        <h1 style={styles.title}>AutoFirma Signer</h1>
        <p style={styles.subtitle}>
          <span style={styles.statusDot(state)} />
          Estado:{' '}
          <strong>
            {state === 'idle' && 'Listo'}
            {state === 'checking' && 'Comprobando…'}
            {state === 'loading' && 'Cargando PDF…'}
            {state === 'signing' && 'Esperando firma del usuario…'}
            {state === 'success' && 'Firma completada'}
            {state === 'error' && 'Error'}
          </strong>
        </p>

        {/* Mobile notice */}
        {isMobile && (
          isBlocked ? (
            <div style={{ ...styles.mobileWarning, background: '#fef2f2', borderColor: '#fca5a5', color: '#7f1d1d' }}>
              <strong>⛔ Servidor de servlets no configurado.</strong>
              <br />
              Para firmar desde móvil se necesita un servidor con los servlets de AutoFirma desplegados.
              Configura la variable <code>PUBLIC_SERVLET_BASE_URL</code> en el fichero <code>.env</code> con
              la URL de ese servidor.
              <br /><br />
              Consulta <code>MOBILE_SUPPORT.md</code> para más información.
            </div>
          ) : (
            <div style={styles.mobileWarning}>
              <strong>📱 Modo móvil activo.</strong>
              <br />
              Usando servidor intermedio en <code>{servletBaseUrl}</code>.
              Asegúrate de tener la app AutoFirma instalada en este dispositivo.
            </div>
          )
        )}

        {/* Actions */}
        <div style={styles.buttonRow}>
          <button
            style={styles.btn('secondary', isBusy || isBlocked)}
            disabled={isBusy || isBlocked}
            onClick={handleCheck}
          >
            Comprobar AutoFirma
          </button>
          <button
            style={styles.btn('primary', isBusy || isBlocked)}
            disabled={isBusy || isBlocked}
            onClick={handleSign}
          >
            {state === 'signing' ? 'Firmando…' : 'Firmar PDF'}
          </button>
        </div>

        {/* Log panel */}
        <div style={styles.logPanel}>
          {logs.length === 0 ? (
            <p style={styles.logEmpty}>— Los logs aparecerán aquí —</p>
          ) : (
            logs.map((entry) => (
              <p key={entry.id} style={styles.logLine(entry.level)}>
                {entry.level === 'error'
                  ? '✖'
                  : entry.level === 'success'
                  ? '✔'
                  : entry.level === 'warn'
                  ? '⚠'
                  : '›'}{' '}
                {entry.message}
              </p>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Download link */}
        {downloadUrl && (
          <div style={styles.downloadSection}>
            <span style={{ fontSize: '24px' }}>📄</span>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#166534' }}>
                PDF firmado listo:
              </p>
              <a
                href={downloadUrl}
                download="firmado.pdf"
                style={styles.downloadLink}
              >
                ⬇ Descargar firmado.pdf
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
