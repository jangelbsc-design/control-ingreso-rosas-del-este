# RECUERDAME — App Control de Ingreso · Urbanización Rosas del Este

> **Este archivo es el manual de la app.** Léelo cada vez que necesites recordar cómo funciona, cómo conectarla a tu base de datos, cómo actualizarla y cómo subirla a GitHub.

---

## 1. Qué es la app

Es una web app (instalable en el celular como una app normal) para que el guardia de turno **busque al instante** a cualquier vecino escribiendo **el manzano, el nombre, el celular o la placa del vehículo**. Al tocar un resultado se abre la **ficha del vecino** con:

- Estado: **VIGENTE** (verde) o **EN MORA** (rojo)
- Propietario(s)
- Placa(s) del vehículo en formato "chapa"
- Teléfono(s) con botones de **Llamar** y **WhatsApp**
- Botón **Registrar ingreso** que guarda el evento en la bitácora

También incluye una **Bitácora de ingresos** (con hora y fecha, exportable a CSV) y un **ingreso manual** para visitantes o vehículos externos. En la cabecera se muestra tu logo (`imágenes/logo.webp`); si lo quitas o renombras, la app usa por defecto un escudo verde.

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
| `COUNTRY_CODE` | Prefijo del país para llamadas/WhatsApp (Bolivia = 591) | `591` |
| `AUTO_REFRESH_MIN` | Minutos entre recargas automáticas (0 = desactivado) | `0` |

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
1. En el repositorio: **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Guardar. Espera 1–2 minutos.
4. Te dará una URL tipo: `https://TU_USUARIO.github.io/control-ingreso-rosas-del-este/`

**Instrucciones para el equipo de seguridad:** esa URL se abre en el celular y se instala como en el punto 5 (con Chrome/Safari). Añadir "Agregar a pantalla de inicio".

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
| Encontró datos de otra pestaña | El `SHEET_NAME` en `config.js` no coincide con la pestaña correcta. |
| No aparece la placa | La columna `PLACA` está vacía en la hoja para ese vecino. La ficha muestra "Sin placa registrada". |
| Búsqueda con tildes no encuentra | No importa: la app ignora mayúsculas, tildes y guiones. |
| "Datos locales · …" en amarillo | Estás viendo datos guardados sin conexión; conecta e internet y recarga. |
| Cambié la hoja y no se refleja | Recarga la página (F5). Si se usó caché, los datos se actualizan al recargar con internet. |
| Celfone nuevo sin datos | Ábrela una vez con internet para que guarde la copia. |

---

## 9. Mejoras posibles (para después)

- 🔒 Contraseña / clave de acceso para guardias.
- 📷 Escáner de placas con la cámara (OCR).
- 💬 Envío de boletas de cobranza por WhatsApp desde la ficha.
- 📊 Reportes mensuales de ingresos/salidas.
- 🌐 Integración con N8N (si la administración usa flujos).

---

*Última actualización: septiembre 2026. El tutorial de GitHub también referencia el archivo `README.md` del repositorio.*