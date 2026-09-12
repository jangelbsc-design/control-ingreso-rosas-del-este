# Urbanización Rosas del Este · Control de Ingreso

App web (PWA) de **directorio de vecinos y control de acceso**: el guardia escribe el **manzano, nombre, celular o placa** y al instante ve la ficha del vecino con su estado (VIGENTE/EN MORA), teléfonos con botones llamar/WhatsApp, placas y un botón para registrar el ingreso en la bitácora.

- **Diseño:** verde, rojo, blanco y negro (colores de la urbanización).
- **Datos:** leídos en vivo desde un Google Sheets (una sola pestaña, reconocimiento automático de columnas).
- **Offline:** guarda una copia en el navegador para funcionar sin internet.
- **Instalable** en celulares como app nativa (PWA).

## Estructura

```
├── index.html          # interfaz
├── styles.css          # diseño
├── js/config.js        # ⚙️ CONFIG: ID de la hoja, pestaña, país ⚙️
├── js/utils.js         # parser CSV + utilidades
├── js/app.js           # lógica (búsqueda, ficha, bitácora)
├── sw.js               # service worker (offline)
├── manifest.webmanifest
├── icons/icon.svg
├── imágenes/logo.webp   # logo de la urbanización (usado en la cabecera)
├── RECUERDAME.md        # 📖 MANUAL COMPLETO (léelo)
└── README.md
```

## Inicio rápido

1. Abre la app (servidor local o haz doble clic en `index.html`).
2. El documento de Sheets debe estar compartido como **"cualquier persona con el enlace → Lector"**.
3. Edita `js/config.js` si cambia el documento o la pestaña.

## Documentación

📖 **Todo está explicado en [RECUERDAME.md](RECUERDAME.md)**: conexión a Sheets, instalación en el celular, subida a GitHub (GitHub Pages) y solución de problemas.