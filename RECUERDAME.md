# RECUERDAME — App Control de Ingreso · Urbanización Rosas del Este

> **Este archivo es el manual de la app.** Léelo cada vez que necesites recordar cómo funciona, cómo conectarla a tu base de datos, cómo actualizarla y cómo subirla a GitHub.

---

## 1. Qué es la app

Es una web app (instalable en el celular como una app normal) para que el guardia de turno **busque al instante** a cualquier vecino escribiendo **el manzano, el nombre, el celular o la placa del vehículo**. Al tocar un resultado se abre la **ficha del vecino** con:

- Estado: **VIGENTE** (verde) o **EN MORA** (rojo)
- Propietario(s) — la tarjeta y la ficha muestran **"Manzano X - Lote Y"** (ej. `M21 - 21` → "Manzano 21 - Lote 21")
- Placa(s) del vehículo en formato "chapa"
- Teléfono(s) con botones de **Llamar** y **WhatsApp** (uno por cada número; acepta 2 o 3 números de referencia en una misma casilla)
- **Mini mapa de Google** si la hoja tiene la columna `UBICACIÓN` (GPS del lote): muestra una vista previa del mapa dentro de la ficha y al presionarla abre **Google Maps completo** con esa ubicación
- Botón **Registrar ingreso** que guarda el evento en la bitácora

También incluye una **Bitácora de ingresos** (con hora y fecha, exportable a CSV) que **agrupa los registros por día**: al pasar la medianoche o al entrar el primer dato del día nuevo, la pestaña Bitácora muestra un **encabezado negro con el día y la fecha** (ej. "Sábado, 13 de septiembre de 2026"), para distinguir de un vistazo cada jornada. Hay un **registro manual** para visitantes o vehículos externos y abajo hay **dos botones separados: "Registro" y "Bitácora"**.

En la cabecera se muestra tu logo (`imágenes/logo.webp`) y, cuando el navegador permite la instalación, un botón verde **"Instalar"** que agrega la app al celular como aplicación nativa (sección 5). El **ícono y la pantalla de inicio** de la app instalada se generan a partir de tu logo (los PNG en `icons/`), no del escudo por defecto. Si quitas o renombras `imágenes/logo.webp`, la app muestra por defecto un escudo verde en la cabecera.

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
| `SHEET_GID` | Número `gid` de esa pestaña (aparece en la URL al abrirla: `.../edit#gid=<AQUÍ>`). La app lo usa para descargar la hoja **en crudo** y así **no perder** los teléfonos con guiones/espacios | `1653009094` |
| `SHEET_USERS` | Pestaña con los usuarios y contraseñas del login | `Usuarios` |
| `COUNTRY_CODE` | Prefijo del país para llamadas/WhatsApp (Bolivia = 591) | `591` |
| `AUTO_REFRESH_MIN` | Minutos entre recargas automáticas (0 = desactivado, ahora recarga sola cada 5 min) | `5` |
| `BITACORA_URL` | URL del web app de Apps Script (sección 10) | la `/exec` configurada |
| `APP_VERSION` | Número de versión visible en la Bitácora (útil para detectar teléfonos desactualizados) | `16` |
| `QR_IMAGE` | Ruta de la imagen del QR de pago que se adjunta a los recordatorios | `imágenes/QR pago expensas.jpeg` |

### 3.3 Columnas de la hoja
La app **reconoce las columnas automáticamente** por su nombre. Reconoce cualquier de estos encabezados:

| Dato | Nombres de columna que acepta |
|---|---|
| Manzano | `MAZANO`, `MANZANO`, `BLOQUE` |
| Propietario | `PROPIETARIO`, `PROPIETARIOS`, `NOMBRE` |
| Celular | `CELULAR`, `NO. CELULAR`, `TELÉFONO` |
| Placa | `PLACA`, `PLACA VEHÍCULO`, `MATRÍCULA`, `PATENTE` |
| Ubicación | `UBICACIÓN`, `UBICACION GPS`, `GPS`, `COORDENADAS`, `LATITUD` (muestra un mini mapa en la ficha) |
| Estado | `ESTADO`, `MOROSO` (acepta `VIGENTE` / `EN MORA` / `MOROSO`) |
| Piscina | `PISCINA`, `MANILLAS`, `MANILLA` (sale discreta en la tarjeta y en la ficha; ver 3.6) |
| (opcional) | `TIPO`, `SITUACION`, `CANCELADO`, `COMENTARIO`, `GESTIÓN DE COBRANZAS` se muestran como "Detalles" extra en la ficha |

Tu pestaña `PROPIETARIOS` tiene exactamente: `MANZANO · PROPIETARIO · CELULAR · ESTADO · PLACA · PISCINA · UBICACIÓN`. Solo quedó pendiente tu parte: **llenar la columna PLACA** con las carrocerías de cada vecino.

### 3.3.1 Columna PLACA (varios vehículos en una casilla)

Un vecino puede tener más de un vehículo. Escribelos **en la misma casilla separados por ` - `**, y la app los muestra como una plaquita cada uno:

```
726NTE - 4057BKP
1875IYF - 5175CIY - 5664RPC - 2602HPB
```

También funcionan la coma, la barra y el espacio como separadores. Lo que la app **no** hace es partir una placa por su guion interno (`4412-SHX` es **una** placa, no dos).

> Con los datos reales (octubre 2026): **51 vecinos sin placa**, 18 con una y 24 con varias (hay uno con 4).

> **En la tarjeta ya no sale el contador** de placas (antes decía "2 placas · Toca para ver ficha"). Se quitó en la v23 porque estaba de más: las placas ya se ven arriba, una por plaquita. La **ficha** sí las sigue mostrando todas.

### 3.4 Columna UBICACIÓN (mini mapa en la ficha)
Si agregas una columna `UBICACIÓN` (o `GPS`, `COORDENADAS`, `LATITUD`), la ficha de cada vecino mostrará un **mini mapa** de esa ubicación y, al tocarlo, abrirá **Google Maps** completo. Puedes poner:
- **Coordenadas**: `-17.7833, -63.1821` (latitud, longitud del lote), o
- **Una dirección o punto**: ej. `Av. Banzer Km 9, Santa Cruz`.

> El mini mapa se genera con el *embed* público de Google Maps (no requiere API key). Necesita internet para cargar; si estás offline se ve en blanco pero el resto de la ficha funciona igual.

### 3.5 Números de celular — IMPORTANTE
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

### 3.6 Columna PISCINA (las manillas del vecino) — v22
La columna `PISCINA` **está en la misma pestaña `PROPIETARIOS`**, así que la app la lee con todo lo demás (no hay que descargar nada aparte, a diferencia de CANCELADO). Es **informativa**: la app no cobra ni descuenta nada con este dato.

Se muestra **discreta**, en dos sitios:

**1) En la tarjeta del vecino** — al pie, en la misma línea de "Toca para ver ficha", con un puntito del color de la manilla:

```
┌─────────────────────────────────────┐
│ Manzano 22 - 31          VIGENTE    │
│ Aldo Rivero Justiniano              │
│ [ 4449IBP ]                         │
│ [ 7707 4393 ]                       │
│ ─────────────────────────────────── │
│ Toca para ver ficha   ● 5 Maniilas Rojas   ›  │
└─────────────────────────────────────┘
```

**2) En la ficha del vecino** — El estado se muestra como un **botón interactivo** debajo del letrero de estado, alineado a la derecha:

```
EN MORA                        ┌──────────────┐
Tiene deudas pendientes...     │ CANCELADO    │
                               │ Enero 2025   │
                               └──────────────┘
                        PISCINA [● Sin Manillas]
```

Al tocar el botón de estado, se despliega un **selector rápido** con las opciones predefinidas:
* ⚪ **Sin Manillas**
* 🔴 **5 Manillas Rojas**
* 🟢 **5 Manillas Verdes**

**Sincronización en tiempo real**: Al elegir una opción, la app se conecta silenciosamente a la hoja de Google Sheets (vía el script `Bitacora.gs` mediante la orden `updatePool`) y actualiza la celda de la columna `PISCINA` en la pestaña `PROPIETARIOS`. Esto evita tener que abrir el Excel manualmente para dar de alta o bajar las manillas de un vecino. La app mostrará "Guardando en Google Sheets..." y luego "Guardado en Google Sheets ✓".

> **La app no reescribe, no resume y no corrige este dato.** Si la hoja dice algo distinto (como "Prestadas"), en la app se leerá tal cual, aunque el selector sólo ofrecerá los 3 botones estándar para cambiarlo.
> Si la hoja no tiene la columna, o la casilla está **vacía**, no se pinta nada (ni el punto ni el renglón) hasta que el vecino tenga manillas, o se le asigne desde el propio excel.

**Para apagarlo por completo:** poner `MOSTRAR_PISCINA: false` en `js/config.js`. La app queda exactamente como antes, como si la columna no existiera.

**Datos reales de la hoja (94 filas · octubre 2026):** 71 vecinos con `Sin Manillas`, 19 con `5 Maniilas Rojas`, 3 con `5 Manillas Verdes`. Los 30 en mora aparecen como **Sin Manillas**, y 41 vigentes también: **"Sin Manillas" no distingue mora de vigente**, ese dato ya lo dice el estado del vecino.

> **Sobre el typo "Maniilas":** la hoja tuvo 18 filas con `Maniilas` (con **II** en vez de LL) y ya fueron corregidas a `Manillas` (verificado el 10/10/2026: las 19 filas dicen `5 Manillas Rojas`). Si vuelve a colarse un typo, la app **no lo arregla**: se lee tal cual, porque la hoja es la fuente de verdad. El puntito rojo sale igual de todas formas, porque ese color lo deduce la app y no depende de cómo esté escrito.

> **Nota:** esto es solo el **dato de la hoja**. El control completo de manillas (el `−`/`+`, cobro de extras y devolución) es otra cosa y sigue **en resguardo**, sin conectar: carpeta `piscina-en-resguardo/` y sección 13.

---

## 4. Trabajar sin conexión (offline)

La primera vez que la app carga con internet, **guarda una copia de los datos en el navegador** (`localStorage`). Si más adelante no hay internet:

- La app sigue abriendo y sigue funcionando la búsqueda.
- Arriba verás el aviso **"Sin conexión (datos guardados)"** en amarillo.
- Se usan los datos de la última vez que estuvo en línea.

Para "refrescar" los datos guardados, abre la app con internet y recarga.

> Ojo: si abres la app en un PC/celular **nuevo** sin haberla cargado antes con internet, no tendrá datos guardados.

> Si la app todavía **no tiene esa copia guardada** (celular nuevo o poco usado) y además no hay internet, **no se queda en "Cargando…"** para siempre: cambia al aviso **"Sin conexión"** con el botón **Reintentar**. Tócalo cuando vuelva la red, o la app lo intenta sola al reconectarse.

---

## 5. Instalar la app en el celular (como app nativa)

La app es una **PWA** (Progressive Web App). En **Android (Chrome)** tiene de fábrica un botón verde **"Instalar"** en la barra superior: tócalo y aparece el cuadro del navegador para instalar. Si no lo ves (o prefieres el menú):

**Android (Chrome):**
1. Abre la app en Chrome.
2. Toca los 3 puntos (⋮) → **"Instalar app"** o "Agregar a pantalla de inicio".

**iPhone/iPad (Safari):**
1. Abre la app en Safari. (En iPhone **no existe** el botón "Instalar": Safari no lo permite.)
2. Toca el botón Compartir (cuadro con flecha) → **"Agregar a pantalla de inicio"**.

> El botón **"Instalar"** solo aparece cuando el navegador detecta que la app es instalable (Chrome en Android/PC y sirviendo por HTTPS). Una vez instalada, el botón desaparece. La app queda como un ícono en tu pantalla, a pantalla completa y sin barra del navegador. El **ícono y el arranque** usan el logo de la urbanización (PNG en `icons/`).

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
| Un teléfono **no aparece** aunque esté en la hoja | El celular está escrito con guiones/espacios (ej. `71616102 - 75015599`) y la columna CELULAR está como *número*: Google **borra** esas casillas al exportar. Ya está corregido en la app (v18 usa el export crudo por `SHEET_GID`, que conserva todo). Aun así, conviene dejar la columna CELULAR en **Texto sin formato** (ver punto 3.5) para evitar que Google las borre. Si un teléfono sigue sin salir, **cierra la app y ábrela 1–2 veces con internet** para que baje la versión nueva. |
| Encontrar datos de otra pestaña | El `SHEET_NAME` en `config.js` no coincide con la pestaña correcta. |
| No aparece la placa | La columna `PLACA` está vacía en la hoja para ese vecino. La ficha muestra "Sin placa registrada". |
| Búsqueda con tildes no encuentra | No importa: la app ignora mayúsculas, tildes y guiones. |
| "Datos locales · …" en amarillo | Estás viendo datos guardados sin conexión; conecta e internet y recarga. |
| Cambié la hoja y no se refleja | Recarga la página (F5). Si se usó caché, los datos se actualizan al recargar con internet. |
| Celular nuevo sin datos | Ábrela una vez con internet para que guarde la copia. |
| La app se queda en **"Cargando…"** o muestra **"Sin conexión"** con botón Reintentar | La hoja no respondió y ese dispositivo **todavía no tiene copia guardada**. Revisa la conexión y toca **Reintentar** (la app lo intenta sola al reconectarse). |
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
| ¿Cómo borro un **registro de la bitácora**? | Solo el **Admin** ve un ícono de basurero (🗑) en cada registro de la Bitácora. Lo toca, confirma y el registro se borra de todos los celulares y de la hoja `bitacora`. También puedes borrar la fila directamente en la hoja. Si el Admin borra **sin conexión**, el borrado queda anotado en ese celular y se efectúa cuando vuelve la red (el registro **no "revive"**). |
| No sale el **mini mapa** en la ficha del vecino | Ya estaba corregido el bug que lo impedía (faltaba propagar la columna de ubicación al procesar los registros). Si aún no te sale en un celular, verifica, en orden: ① la columna se llama `UBICACIÓN` (o `GPS`/`COORDENADAS`) y la casilla tiene las coordenadas (ej. `-17.79663154067356, -63.08891626799334`); ② en la Bitácora la versión sea la última (v17 o superior); ③ solo las filas con dato muestran mapa. Luego **cierra la app por completo y ábrela con internet** (espera ~10 s y recarga una vez más). Si sigue sin salir, **desinstala y vuelve a instalar** la app (el celular puede tener guardada una copia vieja). El mapa necesita internet para cargar. |
| No sale el dato de **PISCINA** en la tarjeta o en la ficha | Verifica, en orden: ① la columna se llama `PISCINA` (o `MANILLAS`) **en la pestaña `PROPIETARIOS`**; ② la casilla tiene texto (las vacías no pintan nada); ③ `MOSTRAR_PISCINA` no esté en `false` en `js/config.js`; ④ en la Bitácora la versión sea **v22 o superior**. Si el texto sale pero **sin el punto de color**, revisa que la casilla diga el color (ej. `5 Manillas Rojas`): un texto raro se muestra literal, en gris. |

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

La app usa **tu pestaña `bitacora`** (en minúsculas; si no existe, la crea sola). Añade el encabezado (si está vacía) y guarda cada ingreso en las columnas: `ID · FECHA · HORA · MANZANO · PROPIETARIO · VISITANTE · PLACA · NOTA · ORIGEN`. Ahí podrás ver desde tu PC todos los ingresos en vivo, y también quedan en la hoja como respaldo. Cada fila guarda su **FECHA** (dd/mm/aaaa); en la pestaña **Bitácora** de la app esos registros se agrupan por día con un encabezado negro (sección 1).

> **Cómo funciona por dentro:** cada celular guarda sus registros localmente (para funcionar sin internet) y los **envía al web app**, que los escribe en la hoja. La app **pide los registros cada minuto** (y al abrirla) y los mezcla, así todos ven lo mismo. Si un celular está desconectado, guarda la entrada en espera y la envía en cuanto vuelve la red. Igual con los **borrados**: si un Admin borra un registro sin conexión, ese borrado se anota en el celular y se envía al web app cuando vuelve la red, de modo que el registro no reaparece al sincronizar.

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

## 12. Botón "atrás" del teléfono (Android)

El botón atrás del celular **no saca de la app de una vez**; se comporta como "volver atrás" dentro de la app:

- Si hay una ventana abierta (ficha del vecino, acciones del teléfono, recordatorio de cobranza o acceso de administración), la **cierra**.
- Si estás en **Bitácora**, **Registro** o **Admin**, vuelve a la **pantalla principal** (Directorio).
- Si ya estás en la pantalla principal, aparece un aviso discreto: **"Para salir, presiona atrás otra vez"**. Si presionas atrás nuevamente dentro de ~2 segundos, la app **se cierra**.

Es el patrón "doble atrás para salir" que usan la mayoría de las apps de Android. Funciona también en la versión web del navegador; en iPhone no hay botón atrás físico.

---

## 13. Control de manillas de la piscina (EN PRUEBA)

> Estado: **funciona en el sandbox, todavía NO se sube a producción.**
> Los datos viven **solo en el navegador** de un solo dispositivo
> (ver 13.7 — es lo primero que hay que resolver).

### 13.1 La regla de la piscina

- Para entrar a la piscina se necesita **manilla**.
- Cada propietario tiene **5 manillas base** y **se las quedan** (no se devuelven).
- Puede tomar **manillas extra** pagando **Bs 20 cada una, sin límite por día**.
- Las **extras se devuelven al cierre del día**.
- Los **EN MORA no acceden a la piscina**. Lo que tuviera pasa a ser deuda:
  debe devolver **todo**.

### 13.1.1 Lo que la app da por hecho (muy importante)

| Vecino | La app asume | Cómo se corrige |
|---|---|---|
| **Vigente** | **Sí tiene sus 5 manillas.** Es lo normal. | Con el `−` si entregó alguna |
| **Mora** | **No tiene manillas** (arranca en 0). | El administrador **se las asigna a mano** con el `+` si en realidad sí las tiene |

Esto es a propósito: un moroso en la mayoría de los casos ya no las tiene, así
que la app no inventa una deuda que no existe. Si el administrador sabe que sí
las tiene, las asigna una vez y **ese conteo queda guardado** (es un movimiento
más en el registro, no un valor temporal). Recién ahí se activa el mensaje de
cobranza pidiendo la devolución.

Para asignar varias de una vez no hay botón especial: se aprieta `+` las veces
que haga falta. Cada pulsación queda registrada con el saldo ya corregido.

### 13.2 Cómo se ve en la app

Todo vive **dentro de la ficha del vecino** (no hay lista aparte todavía):
al abrir la ficha sale una caja arriba con el aviso y el contador.

| Situación | Lo que sale |
|---|---|
| Vigente con sus 5 | `Tiene sus 5 manillas` · `Puede acceder a la piscina con ellas.` |
| Vigente con extras | `Tiene 8 manillas · 3 extras por devolver` · `...Total a cobrar: Bs 60.` |
| Le faltan (las entregó) | `Tiene 3 manillas` · `Le faltan 2 de las 5 que le corresponden.` |
| Mora sin manillas (lo normal) | `Sin acceso a piscina` · `No tiene manillas.` |
| Mora al que el admin le asignó manillas | `Debe devolver 5 manillas` · `En mora no puede acceder a la piscina...` |

El contador `− 5 +` permite **quitar y agregar a mano** en cualquier momento,
que es lo que pidió la administración. Solo el **admin** ve los botones; un
usuario normal ve el aviso pero no puede editar.

### 13.3 Las cuatro reglas del botón `+`

1. **Nunca cobra a un moroso.** El `+` existe para *corregir* un `−` apretado
   por error. Sale "solo para corregir".
2. **No cobra hasta pasar de 5.** El que tiene 3 y llega a 5 está completando
   las suyas: sale `Completó sus 5 manillas · sin costo`.
3. **La 6ta y siguientes sí son extra** a Bs 20.
4. Solo a los **vigentes** les sale la sugerencia `+1 = Bs 20`.
5. En un moroso, el `+` **sirve para asignarle las manillas que en realidad
   tiene** (ver 13.1.1). No cobra y el conteo queda guardado.

### 13.4 Botones según el estado

| | Botones |
|---|---|
| **Vigente** | `−` `+` · `Devolver las N extras` · `Restaurar 5` (solo si le faltan) · `Cobrar manillas extras` (solo si tiene extra) |
| **Mora** | `−` `+` (el `+` no cobra; asigna las que tenga) · `Devolver todas` · `Cobrar manillas` |

El botón de cobro es **uno solo** y cambia de texto según el contexto: a un
vigente le cobra las extras, a un mora le pide la devolución. Un moroso ya no
ve el resumen del día, porque en mora **no puede tomar** manillas y ese dato
solo confunde.

### 13.5 Los dos mensajes

**Al vigente** (cobro de extras). El monto **no va fijo**: sale de cuántas tomó
realmente y se muestra el precio por manilla, para que se vea cómo se calcula.

> Buenas tardes, NOMBRE, vecino de Rosas del Este (Manzano X - Lote Y).
>
> Se le entregan 3 manillas ADICIONALES para el uso de la piscina.
> El valor es de Bs 20 por manilla, total Bs 60.
>
> Las manillas adicionales son de uso diario: deben devolverlas en
> administración al cierre del día. Las 5 manillas que le corresponden se
> conservan con usted.

**Al mora** (petición de devolución):

> Le informamos que su cuenta se encuentra EN MORA, por lo que no puede acceder a la piscina.
>
> Tiene 5 manillas en su poder. Mientras siga en mora debe devolverlas todas en administración.
>
> Puede hacer la entrega en administración en horario de atención.

Ambos se mandan por WhatsApp o se copian al portapapeles.

### 13.6 Dónde quedó el código

- `js/config.js`: bloque `PISCINA: { MANILLAS_BASE: 5, PRECIO_EXTRA: 20, MONEDA: "Bs", SOLO_VIGENTES: true }`.
- `js/app.js`: el bloque de manillas va **al final del archivo**, después de
  `document.addEventListener("DOMContentLoaded", init);`. Lo único tocado de
  código viejo son **dos líneas**: una en `openDetail()` (pinta el aviso) y una
  en `onBackPressed()` (cierra la hoja con el botón atrás).
- Llave: `MAN_KEY = "rde_manillas_v1"` (solo navegador, sin sincronizar).
- Eventos guardados: `TOMA`, `DEVOLUCION`, `AJUSTE`.
- `tiene` es un **valor absoluto** que se guarda en cada movimiento (no una
  suma). Por eso se puede corregir a mano con el `+` y el `−`.

### 13.7 Lo que falta (importante)

1. **No se sincroniza con Google Sheets.** Si el guardia cambia de celular o
   se limpia el navegador, **se pierden todos los conteos** y no hay forma de
   saber a quién le faltaba devolver.
   Lo propuesto y **pendiente de aprobación**: una pestaña nueva `piscina` en
   la hoja, con una fila por movimiento:
   `ID · FECHA · HORA · MANZANO · PROPIETARIO · EVENTO · CANTIDAD · MONTO · SALDO · USUARIO`
   (reutiliza el mismo Apps Script y el mismo código de sincronización que la
   bitácora). Opcional: una columna de resumen en `PROPIETARIOS` calculada sola
   con fórmula, que devuelve el último `SALDO` de cada vecino.
2. **No hay lista de vecinos** para ver de un vistazo quién debe manillas, ni
   "cierre del día" que reporte quién no devolvió sus extras.
3. Cuando un vecino **regulariza y vuelve a vigente**, sus 5 no vuelven solas:
   hay que apretar `Restaurar 5`.
4. No se controla el **stock** de manillas de la administración.
5. No hay forma de **asignar varias manillas de una sola vez**: se aprieta `+`
   una vez por manilla.

### 13.8 Bugs que se encontraron probando (no volver a cometerlos)

1. El saldo salía `undefined` porque la función que lo calcula no se actualizó
   al cambiar el modelo de "extras del día" a "manillas en la mano".
2. Los botones `−`/`+` no hacían nada: la clave del vecino estaba en el
   contenedor de botones de abajo, no en la tarjeta. **La clave va en la tarjeta.**
3. El sello de cierre se contaba como un vecino más con 5 manillas.
4. **El más importante:** el saldo dependía del orden en que se recorrían los
   movimientos, y varios caen en el **mismo milisegundo** → salía mal. La lista
   se guarda del más reciente al más antiguo, así que hay que **recorrerla al
   revés**. No volver a usar `sort()` por `ts` para esto.
5. `TOMA` ignoraba el saldo explícito y sumaba la cantidad (daba lo mismo por
   casualidad, pero era una bomba de tiempo). **Los tres eventos respetan `saldo`.**
6. Dos fuentes de verdad en la misma caja: el título decía el estado de ahora
   y el subtítulo acumulaba todo el día ("tomó 3 y devolvió 2"), lo que se leía
   como contradicción. **Regla: lo que se muestra sale del estado actual
   (`tiene` vs `base`), nunca de contadores acumulados.**
7. Al editar quedó un `if` duplicado y una `var` repetida. Con `node --check`
   se ve antes de que llegue al navegador. **Siempre: `node --check js/app.js`
   después de cada cambio.**
8. **Suponer que el moroso tiene 5 manillas inventa una deuda.** Se llegó a
   eso y después se corrigió: ahora el moroso **arranca en 0** y es el
   administrador quien le asigna las que realmente tiene (ver 13.1.1).
   La regla general: **la app no debe suponer una deuda que nadie registró.**

---

## 14. Aviso de "CANCELADO" (última cuota pagada) — v19

En la **esquina superior derecha de la ficha del vecino**, al lado opuesto del
letrero de estado (ACCESO AUTORIZADO / EN MORA), sale una cajita con el rótulo
**CANCELADO** y la última cuota que pagó ese vecino.

```
EN MORA                                  ┌──────────────┐
Tiene deudas pendientes · verificar...   │ CANCELADO    │
                                         │ Enero 2025   │
                                         └──────────────┘
```

### 14.1 Por qué hace falta una segunda descarga

La columna CANCELADO **NO está en la pestaña `PROPIETARIOS`** (la que lee la
app). Vive en otra pestaña del mismo documento: **`Hoja1`**. Por eso la app la
descarga **aparte** y la cruza con los vecinos **por manzano**.

Pestañas del documento: `Hoja1`, `Residentes`, `PROPIETARIOS`, `Bitacora`,
`Usuarios`, `Hoja 6`.

En `Hoja1` la columna se llama `CANCELADO` y el **manzano** está en `MAZANO`
(con una sola Z). El texto sale **literal**, tal cual está en la hoja.

### 14.2 El año (columna de al lado)

El año **no va dentro de CANCELADO**, va en la columna de al lado. Esa columna
**no tiene título** (viene vacía), por eso no se puede buscar por nombre; la app
toma la columna inmediatamente a la derecha de CANCELADO y **solo la acepta si
el valor es un año de 4 dígitos**.

El año se agrega **solo si el texto todavía no trae uno**:

| En la hoja | Se muestra | Por qué |
|---|---|---|
| `Enero` | **Enero 2025** | no traía año, se agrega el de al lado |
| `Mayo` | **Mayo 2026** | ídem |
| `Agosto // 25` | **Agosto // 25** | ya traía año abreviado, **no** se repite |
| `No Pagó 2025` | **No Pagó 2025** | ya traía año completo, no se repite |
| `Mayo // 26 - Septiembre // 26` | sin cambios | ya trae años |

Resultado con los datos reales: **77 de 93** vecinos con año completo y **16**
con el año abreviado que ya venía en la hoja.

Para quitarlo y dejar solo el mes: en `js/config.js` poner
`COL_CANCELADO_ANIO: ""`.

### 14.3 Configuración (`js/config.js`)

```js
SHEET_CANCELADO: "Hoja1",   // pestaña donde está la columna
COL_CANCELADO: "CANCELADO", // columna a mostrar
COL_CANCELADO_MZ: "MAZANO", // columna del manzano, para emparejar
COL_CANCELADO_ANIO: "GESTIÓN"  // "" = mostrar solo el mes
```

Poner `SHEET_CANCELADO: ""` **apaga el aviso por completo**.

### 14.4 Cómo funciona (y por qué no puede romper la app)

Todo el código está **al final de `js/app.js`** y lo único que se tocó del
código que ya existía son **DOS líneas**:

- en `finalize()`: `cargarCancelado(rows);` (después de `afterLoad()`)
- en `openDetail()`: `pintarCancelado(r);`

| Función | Qué hace |
|---|---|
| `claveManzano(txt)` | compara manzanos **por sus números**: "M21 - 20", "m21-20" y "M21 - 20 " son el mismo |
| `cargarCancelado(rows)` | descarga `Hoja1` con `loadViaJSONP` y guarda `r.cancelado` en cada vecino |
| `mapaCancelado(cols, records)` | devuelve `{ "21-20": "Enero 2025", ... }` |
| `textoYaTieneAnio(txt)` | `/\d{4}/` o `/\/\/\s*\d/` → ya trae año, no se le suma otro |
| `cacheCancelado()` | recupera el mapa de `localStorage` para que offline también salga |
| `pintarCancelado(r)` | pinta la cajita; si no hay texto, **no pinta nada** |

**La regla de oro: si la hoja del aviso falla, la app sigue funcionando
exactamente igual, solo que sin el aviso.** Nunca rompe la carga de los
vecinos. Esto está probado: con `SHEET_CANCELADO: ""` los 93 vecinos cargan,
0 errores y ninguna vista se rompe.

El aviso se guarda en `localStorage` (`rde_cancelado_v1`), así que también
funciona sin internet.

### 14.5 La trampa de Google (no volver a tropezar)

`gviz` **no siempre devuelve los títulos de columna**. En `Hoja1` devuelve
`cols` como letras (`"A","B","C"…`) y **la fila de encabezados cae dentro de
los datos**, no aparte:

```
cols  = ["A","B","C",…,"T"]
rows[0] = [null,null,"MAZANO",…,"CANCELADO",null,"ESTADO",…]
```

La primera versión buscaba "CANCELADO" en `cols` y dio **0 avisos**. Por eso
`mapaCancelado()` busca el encabezado **primero en `cols` y si no lo encuentra
lo busca en `records[0]`**, y en ese caso arranca los datos en la fila 1. Así
funciona con las dos formas de respuesta de Google.

### 14.6 Bugs encontrados (y cómo se verificaron)

1. **0 avisos**: la trampa de arriba. El bug más grave.
2. **`cacheCancelado()` podía devolver `null`** y el acceso por corchetes
   reventaba la ficha. Ahora se comprueba antes.
3. **Falsa alarma de solapamiento**: un script marcó `seChocan: true` en las
   93 fichas. Al medir el texto con `Range` en vez del rectángulo de la caja,
   el solapamiento era **0**. El `padding-right` reserva el espacio pero el
   rectángulo del elemento sigue midiendo el ancho completo. **Para medir texto
   hay que usar `Range`, no `getBoundingClientRect` del elemento.**
4. Con un texto largo (`Mayo // 26 - Septiembre // 26`) sí podía pisar el
   letrero, así que se le puso `padding-right: 165px` al título y al subtítulo
   cuando hay aviso (clase `con-aviso`).

Verificación final: **93/93 fichas con aviso, 0 solapes, 0 errores de consola,
las 4 vistas abren**, `node --check js/app.js` OK y sin mojibake.

---

## 9. Mejoras posibles (para después)

- 🏊 **Control de manillas de la piscina** en la ficha del vecino: aviso con
  cuántas tiene, contador `−`/`+` para corregir a mano, cobro de extras y
  petición de devolución por WhatsApp — **sección 13**. La app asume que un
  vigente tiene sus 5 y que un moroso **no tiene ninguna** (el admin se las
  asigna si de verdad las tiene). Falta sincronizarlo con Google Sheets
  (ahora solo vive en el navegador).

- 🔒 La app ya **exige iniciar sesión** para usarse (bloqueada con la pantalla de inicio, pestaña `Usuarios`). Pendiente si algún día se quiere: validación 100 % servidora (que las "contraseñas" no viajen como texto visible en la página pública).
- 🏊 **El dato de PISCINA de la hoja** ya se ve discreto en la tarjeta y en la ficha, **con el texto literal de la columna** (sección 3.6, v22). Lo que sigue pendiente es el **control completo** de manillas (contador `−`/`+`, cobro de extras, devolución y sincronización con Google Sheets), que está en resguardo sin conectar (sección 13).
- 📷 Escáner de placas con la cámara (OCR).
- 📊 Reportes mensuales de ingresos/salidas.
- 🌐 Integración con N8N (si la administración usa flujos).

---

*Última actualización: octubre 2026 (v23: **la tarjeta ya no dice "2 placas"**, solo "Toca para ver ficha"; las placas siguen visibles como plaquitas — sección 3.3.1. Antes: v22 con **el dato de piscina literal de la hoja** — sección 3.6, v21 con el chip de piscina, tarjetas "Manzano X - Lote Y", dos botones abajo Registro/Bitácora, números múltiples por casilla, despliegue automático con Actions, **bitácora sincronizada entre dispositivos** con el web app de Apps Script — sección 10, **login obligatorio para usar la app**, sesión guardada en cada dispositivo, roles Admin/Ingreso y **recordatorios de cobranza (mora) y de pago (vigente) con QR por WhatsApp** — sección 11, **borrado de registros de la bitácora solo para el Admin** — sección 11, **aviso "Sin conexión" con botón Reintentar cuando no hay copia local** — sección 4, **borrados pendientes para que un registro borrado sin internet no reaparezca al sincronizar** — sección 10, **ícono y pantalla de inicio con el logo de la urbanización (PNG en `icons/`)** y **botón "Instalar" en la barra superior (solo Android/Chrome)** — sección 5, **botón atrás del teléfono con "doble atrás para salir"** — sección 12, **bitácora agrupada por día con encabezado negro** — sección 1, y **mini mapa de Google en la ficha con la columna UBICACIÓN** — sección 3.4, con el **bug corregido que impedía que el mapa se mostrara** (v17)). El tutorial de GitHub también referencia el archivo `README.md` del repositorio.*
