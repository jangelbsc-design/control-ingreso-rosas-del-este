# Registrar pago desde la app (v25) — instructivo de instalación

> ⚠️ **HACÉ EL PASO 1 ANTES DE QUE NADIE ABRA LA v25.** Si la app ya se
> actualizó pero el script sigue viejo, el botón «Registrar pago» dará el
> error `Acción inválida: updatePago`. En cuanto pegues el código y
> vuelvas a implementar, empieza a funcionar solo (no hay que tocar la URL).

## Qué hace

Desde la ficha de un vecino, un **Admin** toca **«Registrar pago»**, elige
mes y año y la app escribe en Google Sheets, **en una sola llamada**:

- `PROPIETARIOS.ESTADO` → `VIGENTE`
- `Hoja1.CANCELADO` → el mes (ej. `Noviembre`)
- `Hoja1.GESTIÓN` → el año (ej. `2026`)
- `Hoja1.ESTADO` → `VIGENTE`

El mismo panel tiene **«Marcar en mora (deshacer)»** para corregir un pago
registrado por error: cambia el estado en las dos pestañas pero **no borra
el mes pagado**. Cada acción queda en la bitácora con origen `PAGO`.

---

## Paso 1 — Actualizar el Apps Script (esto NO va por git)

1. Abrí la hoja de los vecinos → **Extensiones → Apps Script**.
2. Abrí el archivo de código (suele llamarse `Bitacora.gs` o `Código.gs`).
3. **Ctrl+A** (seleccionar todo) y **Supr**.
4. En este repo abrí **`server/Codigo-para-pegar.gs`**, **Ctrl+A**, **Ctrl+C**
   (es la misma lógica que `server/Bitacora.gs` pero sin el encabezado largo
   de instrucciones, para que no se rompa al copiar).
5. **Antes de pegar, confirmá que el editor quedó vacío** (Ctrl+A + Supr).
   Pegá todo con **Ctrl+V**. Guardá y mirá que no haya errores en rojo.
6. **Implementar → Administrar implementaciones → lápiz (Editar) →
   Versión: «Nueva versión» → Implementar.** Este paso es OBLIGATORIO:
   guardar no cambia lo que responde la URL `/exec`. Si solo guardás, la app
   sigue hablando con el código viejo.

> **Diagnóstico rápido:** abrí en el navegador
> `<TU_URL>/exec?action=diag`. Si devuelve JSON con `"ok":true`, el código
> nuevo está activo. Si dice `Acción inválida: diag`, el deploy es viejo.
6. **Guardá** (Ctrl+S / ícono de disquete).
7. **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién puede acceder: **Cualquier persona**
   - Clic en **Implementar** y autorizá (Avanzado → Ir a… → Permitir).
8. Copiá la URL que termina en **`/exec`** de la *Aplicación web* (NO la de
   *Prueba de desarrollo*). Debe ser **exactamente igual** a la que está en
   `js/config.js` → `BITACORA_URL`. Si te sale una URL distinta, pegá la
   nueva en `BITACORA_URL`, subí `APP_VERSION` y los `?v=` de `index.html` y
   `sw.js`, y hacé `git push` (si no, el Service Worker sigue sirviendo el
   `config.js` viejo con la URL anterior).

> **URL actual (v26):**
> `https://script.google.com/macros/s/AKfycbwtD4oVwzNlF59A-UKvuYvZ8EQD0wLxoR0fO9B-xu_qmp3rPn9I/exec`
>
> El script puede estar pegado en **cualquier documento** de Sheets: el
> código usa `openByUrl` con el ID fijo en la línea 5, así que el documento
> contenedor no importa. Lo que sí importa es que esa línea diga
> `1YdYeE6JLRlP5FsxI9TprBFiQ0lbYEXUO`.

> Si hacés una implementación **nueva** sin borrar la anterior, Google puede
> darte una URL distinta. Para conservar la misma URL, en **Implementar →
> Administrar implementaciones** elegí la versión existente y **Editar →
> nueva versión** en vez de crear otra.

## Paso 2 — La app ya está publicada

El código de la app (v25) ya se subió con `git push` y GitHub Pages la
publica sola en:

https://jangelbsc-design.github.io/control-ingreso-rosas-del-este/

En los celulares puede tardar unos minutos en aparecer la v25. Para forzar:
cerrar la app y abrirla 1–2 veces (o limpiar caché). El número de versión se
ve en la Bitácora → debe decir **v25**.

## Paso 3 — Probar con Marianela (o cualquier vecino)

1. Ingresá como **Admin** → Directorio → buscar `M22 - 40` o `Marianela`.
2. Tocá la ficha → botón verde **«Registrar pago»**.
3. Elegí **Noviembre** y **2026** → **Guardar pago**.
4. Debe aparecer: `ACCESO AUTORIZADO` y `Cancelado Noviembre 2026`, y el
   toast **«Guardado en Google Sheets ✓»**.
5. Verificá en la hoja: `PROPIETARIOS` fila de M22-40 → `ESTADO = VIGENTE`;
   `Hoja1` fila de M22-40 → `CANCELADO = Noviembre`, `GESTIÓN = 2026`,
   `ESTADO = VIGENTE`.
6. Verificá en Bitácora el registro con origen **«pago registrado»** y la
   nota `Pago registrado: Noviembre 2026 · por <tu usuario>`.
7. Probá **«Marcar en mora (deshacer)»**: debe volver a `EN MORA` en la app
   y a `MOROSO` en las dos pestañas, conservando `Noviembre` en `CANCELADO`.

---

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| **`Illegal return statement`, línea 22** | Se pegó solo un fragmento, o quedó contenido viejo mezclado: un `return` quedó fuera de una función | Borrar **todo** el contenido del editor (Ctrl+A + Supr, verificar que quede vacío) y pegar completo `server/Codigo-para-pegar.gs`. Si aún falla, **Archivo → Historial de versiones** y restaurar la última versión que funcionaba, y volver a pegar |
| `Acción inválida: updatePago` | Falta el Paso 1 | Pegar el `.gs` y volver a implementar |
| `No se encuentran las pestañas…` | La hoja no se llama `PROPIETARIOS` o `Hoja1` | Revisar `SHEET_NAME` / `SHEET_CANCELADO` en `js/config.js` |
| `Manzano no encontrado o duplicado` | El manzano no existe, está repetido, **o la fila de encabezados de `Hoja1` no es la primera** (hay filas vacías u ocultas arriba) | Desde v25.1 el script busca el encabezado en las primeras 15 filas, así que esto ya no debería pasar. Verificar con `?action=diag`: `Hoja1` debe mostrar `"filaEncabezado"` y `"mz"` distinto de `-1` |
| `Una celda destino tiene fórmula` | Alguien puso una fórmula en ESTADO/CANCELADO/GESTIÓN | La app no sobrescribe nada; corregir la celda a mano |
| `Error de red al guardar` | Sin internet o cambió la URL del script | Revisar conexión y `BITACORA_URL` |
| El guardia sigue viendo «EN MORA» | Caché vieja en ese celular | Cerrar y abrir la app 1–2 veces |

## Riesgo conocido (no resuelto)

El control de Admin es **solo del lado del navegador** (lo mismo que ya
pasaba con el selector de piscina): el web app de Apps Script está publicado
para «cualquier persona» y no valida quién llama. Sirve para evitar cambios
accidentales del guardia, **no como seguridad real**. Si algún día se quiere
blindar, hay que agregar un token en el payload y validarlo en el script, o
pasar a autenticación real de Google (fuera de alcance de este cambio).
