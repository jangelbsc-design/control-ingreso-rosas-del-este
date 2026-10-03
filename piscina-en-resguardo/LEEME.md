# Manillas de piscina — en resguardo

Esta carpeta es **el código de la sección de manillas, guardado y funcionando,
pero NO está conectado a la app**. La app actual (`index.html`, `js/`, `styles.css`)
quedó como estaba antes de todo esto.

Se guardó el **2026-10-03**, después de haberla probado de punta a punta
con los 93 vecinos reales. La razón de guardarla es que la función estaba
completa y funcionando; lo que faltaba era la **decisión** de si se quería.

---

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `app.js-manillas.txt` | El módulo completo (~500 líneas). Va **al final** de `js/app.js`. |
| `config-js.txt` | El bloque `PISCINA` que va dentro de `APP_CONFIG`, antes del `};` final. |
| `index-html.txt` | Los 2 agregados: el aviso en la ficha y la hoja del recibo. |
| `styles-css.txt` | Los estilos. Van después de `.detail-content`. |
| `conexion-en-app-js.txt` | Las **2 líneas** que hay que pegar dentro del `app.js` que ya existe. |

La explicación de **cómo funciona, qué reglas tiene y qué falta** está en
`RECUERDAME.md`, sección **13**. Allá está todo el detalle; acá está el código.

---

## Cómo retomarla

Son 6 pasos, en este orden:

1. **`js/config.js`** — pegar el bloque `PISCINA` de `config-js.txt` dentro de
   `APP_CONFIG`, antes del `};` de cierre. Subir `APP_VERSION` a `"19"`.
2. **`js/app.js`** — pegar el módulo de `app.js-manillas.txt` **al final** del
   archivo, después de `document.addEventListener("DOMContentLoaded", init);`.
3. **`js/app.js`** — agregar las **2 líneas** de `conexion-en-app-js.txt`
   (una en `onBackPressed()`, otra en `openDetail()`).
4. **`index.html`** — pegar los 2 bloques de `index-html.txt`. Subir los dos
   `?v=` de los `<script>`/`stylesheet` a `19`.
5. **`styles.css`** — pegar `styles-css.txt` después de `.detail-content`.
6. **`sw.js`** — cambiar `CACHE` a `"rde-app-v19"` y los `?v=` de los assets.

Después: `node --check js/app.js` y probar en el sandbox
(`node "$env:TEMP\opencode\serve.js" "<esta carpeta>" 8099`).

---

## Lo que YA estaba resuelto

- El modelo de datos: `tiene` es un **valor absoluto** guardado en cada
  movimiento, no una suma. Por eso se puede corregir a mano.
- El aviso con los 5 estados (vigente con sus 5 / con extras / le faltan /
  mora con manillas / mora sin manillas).
- El `−` y el `+` que editan el conteo, solo para el admin.
- El `+` cobra **solo a partir de la 6ta** manilla; a un moroso nunca le cobra.
- Los dos mensajes de WhatsApp (cobro de extras / cobro de devolución al mora).
- La hoja inferior con WhatsApp y Copiar, y el botón atrás del teléfono.

## Lo que FALTABA

- **No se sincroniza con Google Sheets.** Todo vive en el `localStorage` de
  un solo celular. Si ese celular se rompe, se pierde. Es lo primero que
  habría que hacer.
- No hay lista de admin ni "cierre del día" para ver de un vistazo quién
  debe manillas.
- Al regularizar, las 5 no se restauran solas: hay que tocar "Restaurar 5".
- No se controla el stock de manillas de la caseta.
- No se pueden asignar varias manillas de una vez (hay que apretar `+` N veces).

## Trampa conocida

**El saldo depende del orden de los movimientos**, y varios caen en el **mismo
milisegundo** (pasa cuando el guardia aprieta rápido). Por eso `manSaldos()`
recorre la lista **al revés**. Si alguna vez se toca esa función, no cambiar
eso por un `sort()` por fecha: rompe los saldos.