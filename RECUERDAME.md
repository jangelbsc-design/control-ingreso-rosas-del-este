# RECUERDAME — App Control de Ingreso · Urbanización Rosas del Este

> **Este archivo es el manual de la app.** Léelo cada vez que necesites recordar cómo funciona, cómo conectarla a tu base de datos, cómo actualizarla y cómo subirla a GitHub.

---

## 1. Qué es la app

Es una web app (instalable en el celular como una app normal) para que el guardia de turno **busque al instante** a cualquier vecino escribiendo **el manzano, el nombre, el celular o la placa del vehículo**. Al tocar un resultado se abre la **ficha del vecino** con:

- Estado: **VIGENTE** (verde) o **EN MORA** (rojo)
- Propietario(s) — la tarjeta y la ficha muestran **"Manzano X - Lote Y"** (ej. `M21 - 21` → "Manzano 21 - Lote 21")
- Placa(s) del vehículo en formato "chapa"
- Teléfono(s) con botones de **Llamar** y **WhatsApp** (uno por cada número; acepta 2 o 3 números de referencia en una misma casilla)
- Botón **Registrar ingreso** que guarda el evento en la bitácora

También incluye una **Bitácora de ingresos** (con hora y fecha, exportable a CSV) y un **registro manual** para visitantes o vehículos externos. Abajo hay **dos botones separados: "Registro" y "Bitácora"**. En la cabecera se muestra tu logo (`imágenes/logo.webp`); si lo quitas o renombras, la app usa por defecto un escudo verde.

La app se sincroniza con los registros de todos los celulares (sección 10) y tiene un **acceso de administración** con tu pestaña `Usuarios` que permite al Admin **enviar recordatorios de cobranza por WhatsApp** a los vecinos en mora (sección 11).

**Colores de la urbanización usados:** verde (#0e7a3d) para VIGENTE, rojo (#d92d20) para EN MORA, blanco y negro para el resto del diseño.

---

## 2. Cómo abre la app (desde tu PC)

1. Instala una extensión de servidor local (ej. *Live Server* en VS Code) o usa:
   ```
   python -m http.server 8080
   ```
   y abre `http://localhost:8080`.

2. O simplemente abre el archivo `index.html` con doble clic. (Recomendado usar servidor local para que todo funcione bien.)

---

## 3. Cómo se conecta a tu Google Sheets (IMPORTANTE)

La app lee la base de datos **directamente del documento de Google Sheets** (no necesita copiar archivos). Para que funcione:

### 3.1 Compartir el documento
1. Ve a tu hoja de cálculo.
2. Botón **Compartir** (arriba a la derecha).
3. Cambia a **"Cualquier persona con el enlace"**.
4. Permiso: **Lector**.
5. Copia el enlace.

> Si no compartes la hoja como "cualquiera con el enlace", la app mostrará **"Sin datos · Verifica la hoja"** en rojo.

### 3.2 Config (archivo único a editar)
Todo se configura en **`js/config.js`**:

| Opción | Qué es | Valor actual |
|---|---|---|
| `SPREADSHEET_ID` | El ID que está en el enlace de tu hoja (`.../d/<AQUÍ>/edit`) | `1YdYeE6JLRlP5FsxI9TprBFiQ0lbYEXUO` |
| `SHEET_NAME` | Nombre exacto de la pestaña con la base de vecinos | `PROPIETARIOS` |
| `SHEET_USERS` | Pestaña con los usuarios y contraseñas del login | `Usuarios` |
| `COUNTRY_CODE` | Prefijo del país para llamadas/WhatsApp (Bolivia = 591) | `591` |
| `AUTO_REFRESH_MIN` | Minutos entre recargas automáticas (0 = desactivado) | `0` |
| `BITACORA_URL` | URL del web app de Apps Script (sección 10) | la `/exec` configurada |
| `APP_VERSION` | Número de versión visible en la Bitácora (útil para detectar teléfonos desactualizados) | `11` |
| `QR_IMAGE` | Ruta de la imagen del QR de pago que se adjunta a los recordatorios | `imágenes/QR pago expensas.jpeg` |

### 3.3 Columnas de la hoja
La app **reconoce las columnas automáticamente** por su nombre. Reconoce cualquier de estos encabezados:

| Dato | Nombres de columna que acepta |
|---|---|
| Manzano | `MAZANO`, `MANZANO`, `BLOQUE` |
| Propietario | `PROPIETARIO`, `PROPIETARIOS`, `NOMBRE` |
| Celular | `CELULAR`, `NO. CELULAR`, `TELÉFONO` |
| Placa | `PLACA`, `PLACA VEHÍCULO`, `MATRÍCULA`, `PATENTE` |
| Estado | `ESTADO`, `MOROSO` (acepta `VIGENTE` / `EN MORA` / `MOROSO`) |
| (opcional) | `TIPO`, `SITUACION`, `CANCELADO`, `COMENTARIO`, `GESTIÓN DE COBRANZAS` se muestran como "Detalles" extra en la ficha |

Tu pestaña `PROPIETARIOS` tiene exactamente: `MANZANO · PROPIETARIO · CELULAR · ESTADO · PLACA`. Solo quedó pendiente tu parte: **llenar la columna PLACA** con las carrocerías de cada vecino.

### 3.4 Números de celular — IMPORTANTE
La columna **CELULAR** debe estar formateada como **"Texto sin formato"** para que muestre los números múltiples:

1. En la hoja, haz clic en la **letra de la columna CELULAR** para seleccionarla toda.
2. Menú **Formato → Número → Texto sin formato** (Plain text).

Si la columna queda como *número*, Google **borra** (envía vacías) las casillas que tienen letras o guiones, y esos teléfonos no aparecen en la app.

**Cómo escribir 2 o 3 números de referencia** (en una misma casilla): separa con ` - `, por ejemplo:
```
78500613 - 70905191
76399492 - 73133074 - 76605336
```
También funcionan `7603 6960 - 7903 9893`, `76-036-960` o `+591 7123-4567`. La app reconoce cada número, los muestra separados (sin el prefijo +591) y al tocarlos ofrece Llamar / WhatsApp con el prefijo del país (591).

---

## 4. Trabajar sin conexión (offline)

La primera vez que la app carga con internet, **guarda una copia de los datos en el navegador** (`localStorage`). Si más adelante no hay internet:

- La app sigue abriendo y sigue funcionando la búsqueda.
- Arriba verás el aviso **"Sin conexión (datos guardados)"** en amarillo.
- Se usan los datos de la última vez que estuvo en línea.

Para "refrescar" los datos guardados, abre la app con internet y recarga.

> Ojo: si abres la app en un PC/celular **nuevo** sin haberla cargado antes con internet, no tendrá datos guardados.

---

## 5. Instalar la app en el celular (como app nativa)

La app es una **PWA** (Progressive Web App). Para instalarla:

**Android (Chrome):**
1. Abre la app en Chrome.
2. Toca los 3 puntos (⋮) → **"Instalar app"** o "Agregar a pantalla de inicio".

**iPhone/iPad (Safari):**
1. Abre la app en Safari.
2. Toca el botón Compartir (cuadro con flecha) → **"Agregar a pantalla de inicio"**.

Quedará como un ícono en tu pantalla, a pantalla completa, sin barra del navegador.

---

## 6. Cómo subirla a GitHub

### Opción A — Subir con el explorador (fácil, sin instalar nada)
1. Entra a https://github.com/new
2. Crea un repositorio (nombre sugerido: `control-ingreso-rosas-del-este`). No marques "Initialize with README".
3. En tu PC, **comprime TODA la carpeta** de la app en un `.zip` (deben estar los archivos `index.html`, `styles.css`, `js/`, `sw.js`, `manifest.webmanifest`, `icons/`, `RECUERDAME.md`...).
4. En GitHub, dentro del repositorio, entra a **Add file → Upload files** y arrastra el `.zip`/archivos.
5. Haz clic en **Commit changes**.

### Opción B — Con Git (línea de comandos)
```bash
cd "C:\Users\jabustos\Desktop\APP y N8N\Urbanización Rosas del Este"
git init
git add .
git commit -m "App control de ingreso · Urbanización Rosas del Este"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/control-ingreso-rosas-del-este.git
git push -u origin main
```

### 6.2 Activar GitHub Pages (para que la app quede publicada como web)
Hoy **ya está publicado y se actualiza solo**. Cada vez que haces `git push` a la rama `main`, el archivo `.github/workflows/deploy-pages.yml` ejecuta un despliegue automático y 1–2 minutos después la URL ya tiene la versión nueva:

`https://jangelbsc-design.github.io/control-ingreso-rosas-del-este/`

- **NO se necesita crear un "Release"** para actualizar la web; los Releases no afectan a GitHub Pages.
- Si algún día hubiera que reconfigurarlo: **Settings → Pages → Source: "GitHub Actions"** (el workflow se encarga).

**Instrucciones para el equipo de seguridad:** esa URL se abre en el celular y se instala como en el punto 5 (con Chrome/Safari). Añadir "Agregar a pantalla de inicio".

> **Actualizar la app instalada en el celular:** al publicar cambios, el celular tarda un par de aperturas en actualizar su copia. Cierra la app, ábrela, espera ~10 segundos y recarga una vez más. Si ves pantalla vieja o "0 vecinos", cierra y abre 1 vez más.

---

## 7. Seguridad y privacidad (LÉELO)

- ⚠️ Al publicar en **GitHub Pages**, la app y **sus datos** (nombres, teléfonos, placas) quedan **públicos en internet** para cualquiera con la URL.
- El documento de Google Sheets debe estar en modo **"Lector"**. Si luego lo quitas del modo "cualquier persona", la app deja de cargar datos (aunque seguirá usando la copia guardada).
- Opciones si te preocupa la privacidad (hablar con la administración):
  - Usar una **contraseña de acceso** a la app (se puede añadir después).
  - Servir la app en un hosting privado en vez de GitHub Pages.

---

## 8. Solución de problemas

| Problema | Solución |
|---|---|
| "Sin datos · Verifica la hoja" en rojo | La hoja no está compartida como *cualquiera con el enlace → Lector*, o cambió el `SPREADSHEET_ID`/`SHEET_NAME` en `config.js`. |
| La app abre con **0 vecinos** | Esto pasaba cuando la app no pedía encabezados a Google. Ya está corregido; si vuelve, cierra la app y ábrela 1–2 veces (actualiza la copia guardada). |
| Un teléfono **no aparece** aunque esté en la hoja | La columna CELULAR está como *número*: ponla en **Texto sin formato** (ver punto 3.4) para que no borre las casillas con guiones. |
| Encontrar datos de otra pestaña | El `SHEET_NAME` en `config.js` no coincide con la pestaña correcta. |
| No aparece la placa | La columna `PLACA` está vacía en la hoja para ese vecino. La ficha muestra "Sin placa registrada". |
| Búsqueda con tildes no encuentra | No importa: la app ignora mayúsculas, tildes y guiones. |
| "Datos locales · …" en amarillo | Estás viendo datos guardados sin conexión; conecta e internet y recarga. |
| Cambié la hoja y no se refleja | Recarga la página (F5). Si se usó caché, los datos se actualizan al recargar con internet. |
| Celular nuevo sin datos | Ábrela una vez con internet para que guarde la copia. |
| En la bitácora no se ve la **Nota** ni el **propietario** | Ya está corregido: la bitácora ahora muestra el propietario, el visitante, la placa, la nota y el origen. Si aún ves datos viejos, cierra y abre la app una vez. |
| En Bitácora dice **"Local"** | Falta activar la sincronización: sigue la **sección 10**. |
| En Bitácora dice **"Sin conexión"** | La app no pudo hablar con el web app (revisa red o BITACORA_URL). Se reintenta sola cada minuto. |
| Registro no aparece en otros celulares | Verifica que `BITACORA_URL` esté en `config.js` (sección 10) y que en la bitácora diga **"En línea"**. Si el otro teléfono muestra una versión distinta (ej. `v5` en vez de `v6`), está desactualizado: cierra y abre la app 1–2 veces con internet (ver "Actualizar la app instalada"). |
| No veo el botón de **cobranza** en la ficha | Tienes que estar **en mora** (tarjeta roja) y con la **sesión de admin iniciada** (sección 11): toca la versión o el logo → `Admin` + tu contraseña → "Cerrar sesión" para salir. |
| La app pide **iniciar sesión** al abrir | Correcto: es la protección. Escribe el usuario+contraseña (sección 11) la primera vez en ese dispositivo; luego queda guardado y ya no vuelve a pedirlo. |
| Olvidé la contraseña de un guardia | Se cambia desde la pestaña `Usuarios` de la hoja: edita el valor de la casilla. El cambio aplica la próxima vez que ese celular inicie sesión. |
| El botón dice **Recordatorio de pago** y no cobranza | Correcto: es el botón para vecinos **vigentes**. En mora dice "Enviar recordatorio de cobranza". |
| No aparece el **QR** en el recordatorio | Guarda tu imagen del QR en la ruta de `QR_IMAGE` en `config.js` (hoy `imágenes/QR pago expensas.jpeg`) y publica. Los mensajes siguen funcionando sin él. |
| ¿Cómo envío WhatsApp con el **QR adjunto**? | Toca **WhatsApp** y usa el botón **Compartir** del teléfono eligiendo WhatsApp: la foto del QR viaja adjunta con el mensaje. Si no, guarda el QR y adjúntalo manualmente. |
| ¿Cómo borro un **registro de la bitácora**? | Desde la app no se puede (se quitaron los botones a propósito). Se elimina desde tu hoja de cálculo: pestaña `bitacora`, borra la fila. El mismo celular lo verá desaparecer en ~1 minuto. |

---

## 10. Sincronizar la bitácora entre varios celulares (en vivo)

Para que los registros de un guardia **se vean al instante en cualquier otro celular** (todos comparten la misma bitácora), la app usa un pequeño *web app* de **Google Apps Script** que guarda cada entrada en tu hoja de cálculo. Se configura **una sola vez** (~5 minutos):

1. **Abre tu hoja de cálculo** de los vecinos (donde está la pestaña `PROPIETARIOS`).
2. Menú **Extensiones → Apps Script** (en hoja nueva en pantalla grande, a veces dice "Herramientas → Editor de secuencias"). Se abre el editor de Google.
3. **Borra** todo lo que haya en el editor y **pega el contenido del archivo `server/Bitacora.gs`** que está en la carpeta de la app.
4. **Guarda** (botón disquete o Ctrl+G). Ponle el nombre que quieras, ej. `Bitacora`.
5. **Implementar → Nueva implementación → Aplicación web:**
   - *Ejecutar como*: debe decir **Yo** (tu cuenta).
   - *Quién tiene acceso*: **Cualquier persona**.
   - Clic en **Implementar** y **autoriza** (elige tu cuenta de Google y, si te advierte que la app no está verificada, toca "Avanzado → Ir a … (no seguro) → Permitir").
6. Copia la **URL de la aplicación web** (la que termina en `/exec`; es la que NO pide "iniciar sesión").
7. Pega esa URL en **`js/config.js`** dentro de las comillas de `BITACORA_URL: "…"`, guarda y sube los cambios (`git push`). Ejemplo:
   ```js
   BITACORA_URL: "https://script.google.com/macros/s/AKfyOXJ_xxx/exec"
   ```
8. Vuelve a abrir la app en cada celular (cierra/abre una vez). En la **Bitácora** debe aparecer el indicador **"En línea"**.

La app usa **tu pestaña `bitacora`** (en minúsculas; si no existe, la crea sola). Añade el encabezado (si está vacía) y guarda cada ingreso en las columnas: `ID · FECHA · HORA · MANZANO · PROPIETARIO · VISITANTE · PLACA · NOTA · ORIGEN`. Ahí podrás ver desde tu PC todos los ingresos en vivo, y también quedan en la hoja como respaldo.

> **Cómo funciona por dentro:** cada celular guarda sus registros localmente (para funcionar sin internet) y los **envía al web app**, que los escribe en la hoja. La app **pide los registros cada minuto** (y al abrirla) y los mezcla, así todos ven lo mismo. Si un celular está desconectado, guarda la entrada en espera y la envía en cuanto vuelve la red.

---

## 11. Acceso de administración y recordatorios (cobranza y pago) por WhatsApp

Hay usuarios con rol **Admin** y otros solo de **Ingreso** (guardias). Solo el **Admin** ve los botones de recordatorio en la ficha de cada vecino: **"Enviar recordatorio de cobranza"** (para los **en mora**) y **"Recordatorio de pago"** (para los **vigentes**).

1. **El login usa tu pestaña `Usuarios`** (puedes cambiarla en `js/config.js` con `SHEET_USERS`). La hoja debe tener **2 columnas**:
   - `USUARIO` | `CONTRASEÑA` (y, opcionalmente, una 3.ª columna `ROL`).
   - Ejemplo: la primera fila puede ser el encabezado; los usuarios van debajo (`Admin | 6567`, `Ingreso | 7845`, …).
   - Si el usuario (o el rol) contiene la palabra *"admin"*, la app lo trata como **administrador**.
2. **Inicio de sesión obligatorio:** en cualquier dispositivo **nuevo**, la app se abre directamente en una **pantalla de inicio** y **no se puede usar hasta iniciar sesión** (usuario + contraseña de la pestaña `Usuarios`). Esa sesión **queda guardada en el celular**: las siguientes veces que lo abras ya no pedirá nada. El primer login de un celular necesita **internet** (para leer la pestaña `Usuarios`); luego la app funciona offline con la sesión guardada.
3. **Cambiar de sesión / cerrar sesión:** en la Bitácora, **toca la versión** (el "v9") o el **logo**. Si estás logueado ves tu usuario y "Cerrar sesión"; si no, verás el formulario. Al cerrar sesión la app vuelve a bloquearse con la pantalla de inicio. Junto a la versión se muestra quién está activo (ej. `v9 · Admin · Admin` o `v9 · Ingreso`).
3. **El QR de pago:** tu imagen del QR está guardada en la carpeta de la app como **`imágenes/QR pago expensas.jpeg`** (puedes cambiarla en `js/config.js` con `QR_IMAGE`). Al abrir el recordatorio, la app muestra el QR y te permite **Guardar QR**.
4. **Los dos mensajes** (se arman con saludo según la hora + **nombre del vecino + manzano y lote**):
   - **En mora ("Cobranza"):** invita a regularizar el pago, menciona el QR adjunto, los beneficios de estar al día y firma **Administración Rosas del Este Zona Sur**.
   - **Vigente ("Recordatorio de pago"):** *"Buenos días, estimado [Nombre] de Rosas del Este ([Manzano X - Lote Y]). Le enviamos este recordatorio para que pueda realizar el pago de sus expensas mediante el QR adjunto. Si usted ya realizó el pago, por favor ignore este mensaje. ¡Muchas gracias por su puntualidad y que tenga un excelente día!"* + firma.
5. **Enviar por WhatsApp con el QR adjunto:** si el vecino tiene **más de un número**, la app muestra **chips para elegir** a cuál enviar (toca el número correcto). El botón **WhatsApp** usa el botón **"Compartir"** del teléfono (Web Share), así puedes elegir **WhatsApp** y la foto del QR **ya viaja adjunta** con el mensaje como descripción. Si tu navegador no permite adjuntar, la app abre el WhatsApp con el texto y te avisa para que adjuntes el QR guardado.
6. **Enviar en bloque (a todos los en mora / a todos los vigentes):** con sesión de **Admin**, abajo aparece el botón **"Admin"**. Ahí ves dos opciones con sus contadores:
   - **"Enviar a EN MORA (N)"** → arma la lista de todos los morosos con su mensaje de cobranza.
   - **"Enviar a VIGENTES (N)"** → arma la lista de todos los vigentes con su recordatorio de pago.
   Toca la opción y aparecerá la **cola de mensajes** (ej. "Mensaje 1 de 35"): tocas **"Abrir mensaje"** → **WhatsApp** (envías con el QR adjunto si el teléfono lo permite) → vuelves y tocas **"Siguiente"**. Todo es manual a propósito: es lo que WhatsApp considera normal y evita que bloqueen la cuenta por enviar muchos seguidos.

---

## 9. Mejoras posibles (para después)

- 🔒 La app ya **exige iniciar sesión** para usarse (bloqueada con la pantalla de inicio, pestaña `Usuarios`). Pendiente si algún día se quiere: validación 100 % servidora (que las "contraseñas" no viajen como texto visible en la página pública).
- 📷 Escáner de placas con la cámara (OCR).
- 📊 Reportes mensuales de ingresos/salidas.
- 🌐 Integración con N8N (si la administración usa flujos).

---

*Última actualización: septiembre 2026 (tarjetas "Manzano X - Lote Y", dos botones abajo Registro/Bitácora, números múltiples por casilla, despliegue automático con Actions, **bitácora sincronizada entre dispositivos** con el web app de Apps Script — sección 10, **login obligatorio para usar la app**, sesión guardada en cada dispositivo, roles Admin/Ingreso y **recordatorios de cobranza (mora) y de pago (vigente) con QR por WhatsApp** — sección 11). El tutorial de GitHub también referencia el archivo `README.md` del repositorio.*