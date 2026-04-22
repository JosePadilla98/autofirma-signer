# AutoFirma en dispositivos móviles

## Por qué no funciona en móvil

### El mecanismo en escritorio: WebSocket local

En un navegador de escritorio, AutoScript se comunica con la app AutoFirma instalada en el propio equipo mediante un **WebSocket local**:

```
Navegador (escritorio)
    │
    └── wss://127.0.0.1:<puerto>
                │
                ▼
        AutoFirma (app instalada en el PC)
```

Todo ocurre dentro del mismo equipo, sin necesidad de ningún servidor externo.

### El problema en móvil: no existe `localhost`

En un dispositivo móvil no hay ningún proceso escuchando en `localhost`. La app AutoFirma del móvil no puede conectarse directamente al navegador porque ambos son procesos separados sin canal de comunicación directo.

AutoScript lo detecta automáticamente en su código fuente:

```javascript
// autoscript.js, línea ~849
if (forceWSMode || Platform.isIOS() || Platform.isAndroid()) {
    clienteFirma = new AppAfirmaJSWebService(clientAddress, window, undefined);
    // ...requiere storageServlet y retrieverServlet
}
```

Cuando detecta iOS o Android, abandona el modo WebSocket y cambia a un modo de **servidor intermediario**, que requiere dos endpoints de backend.

---

## Qué se necesita para soportar móvil

### Los dos servlets

AutoScript en móvil necesita dos servicios web Java desplegados en un servidor accesible desde internet:

| Servlet | Función |
|---|---|
| `afirma-signature-storage` | Recibe el documento cifrado desde el navegador móvil y lo almacena temporalmente |
| `afirma-signature-retriever` | Recibe la firma generada por la app AutoFirma del móvil y se la devuelve al navegador |

### Flujo completo en móvil

```
1. Navegador móvil
   └── POST documento cifrado ──► storageServlet
                                        │ almacena con ID de sesión

2. AutoScript lanza la app AutoFirma móvil
   └── afirma://sign?stservlet=...&id=...
                │
                ▼
        App AutoFirma (móvil)
            │ descarga el doc desde storageServlet
            │ el usuario selecciona certificado y firma
            └── POST firma cifrada ──► retrieverServlet

3. Navegador móvil (polling)
   └── GET resultado ──► retrieverServlet
                              └── devuelve la firma en Base64
```

### URL que busca AutoScript por defecto

Si no se configuran explícitamente, AutoScript espera los servlets en el mismo dominio de la página web (líneas ~3789–3795 de `autoscript.js`):

```
https://tu-dominio.com/afirma-signature-storage/StorageService
https://tu-dominio.com/afirma-signature-retriever/RetrieveService
```

Para usar URLs distintas se puede llamar a:

```javascript
AutoScript.setServlets(
  'https://mi-servidor.com/afirma-signature-storage/StorageService',
  'https://mi-servidor.com/afirma-signature-retriever/RetrieveService'
);
```

---

## Dónde está el código fuente de los servlets

Están publicados por el Gobierno de España en el repositorio oficial de AutoFirma:

**[github.com/ctt-gob-es/clienteafirma](https://github.com/ctt-gob-es/clienteafirma)**

Módulos relevantes dentro del repositorio:

- [`/afirma-signature-storage`](https://github.com/ctt-gob-es/clienteafirma/tree/master/afirma-signature-storage)
- [`/afirma-signature-retriever`](https://github.com/ctt-gob-es/clienteafirma/tree/master/afirma-signature-retriever)

---

## Cómo compilar los servlets

### Requisitos previos

- Java JDK 8 o superior
- Apache Maven 3.x

### Compilación

```bash
git clone https://github.com/ctt-gob-es/clienteafirma.git
cd clienteafirma
mvn clean install -Denv=install -DskipTests
```

Los WAR se generan en:

```
afirma-signature-storage/target/afirma-signature-storage.war
afirma-signature-retriever/target/afirma-signature-retriever.war
```

### Despliegue en Tomcat

```bash
cp afirma-signature-storage/target/afirma-signature-storage.war   $TOMCAT_HOME/webapps/
cp afirma-signature-retriever/target/afirma-signature-retriever.war $TOMCAT_HOME/webapps/
```

Tomcat los despliega automáticamente al arrancar o al copiar los WAR con el servidor en marcha.

---

## Por qué Vercel no sirve para esto

Los servlets son aplicaciones **Java con estado** (almacenan temporalmente documentos y firmas en memoria/disco). Vercel solo sirve contenido estático y funciones serverless sin estado, por lo que **no puede alojar estos servlets**.

Para desplegar los servlets se necesita uno de estos entornos:

| Opción | Ejemplos |
|---|---|
| VPS / servidor dedicado | DigitalOcean, Hetzner, AWS EC2 |
| Plataforma Java en la nube | AWS Elastic Beanstalk, Google App Engine (Java), Railway |
| Contenedor Docker | Cualquier plataforma que acepte contenedores |

---

## Resumen

| | Escritorio | Móvil sin backend | Móvil con backend |
|---|---|---|---|
| Mecanismo | WebSocket a `localhost` | — | HTTP a servlets remotos |
| Requiere app AutoFirma | Sí (PC) | Sí (móvil) | Sí (móvil) |
| Requiere servidor Java | No | No | **Sí** |
| Funciona en Vercel | ✅ | ❌ | ❌ (servlets en otro server) |
| Implementado en este prototipo | ✅ | — | ❌ |
