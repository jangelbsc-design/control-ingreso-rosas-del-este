/*
 * ============================================================
 *  CONFIG. DE LA APP - Urbanización Rosas del Este
 *  Control de Ingreso (Directorio de vecinos)
 * ============================================================
 *  Este es el UNICO archivo que necesitas editar.
 *
 *  1) SPREADSHEET_ID: el ID de tu documento de Google Sheets.
 *     Está en el enlace de compartir:
 *     docs.google.com/spreadsheets/d/<ESTE_ES_EL_ID>/edit
 *
 *  2) SHEET_NAME: nombre EXACTO de la pestaña (hoja) que tiene
 *     la base de vecinos. Debe tener columnas como:
 *     MANZANO · PROPIETARIO · CELULAR · ESTADO · PLACA
 *     (el reconocimiento de columnas es automático).
 *
 *  IMPORTANTE: el documento debe estar compartido como
 *  "Cualquier persona con el enlace -> Lector" para que la app
 *  pueda leer los datos. (Mira el archivo RECUERDAME.md)
 * ============================================================
 */
var APP_CONFIG = {
  SPREADSHEET_ID: "1YdYeE6JLRlP5FsxI9TprBFiQ0lbYEXUO",
  SHEET_NAME: "PROPIETARIOS",

  APP_NAME: "Urbanización Rosas del Este",
  APP_SUBTITLE: "Control de Ingreso",

  /* Prefijo internacional para llamadas/WhatsApp (Bolivia: 591).
     Cambiar si la urbanización está en otro país. */
  COUNTRY_CODE: "591",

  /* Intervalo en minutos para recargar los datos de forma
     automática. Poner 0 para desactivar la recarga. */
  AUTO_REFRESH_MIN: 0,

  /* Guardar los datos en el navegador para funcionar offline */
  OFFLINE_CACHE: true,

  /* ============================================================
     SINCRONIZACIÓN DE LA BITÁCORA ENTRE DISPOSITIVOS
     ============================================================
     La URL del web app de Google Apps Script que guarda/lee la
     bitácora en tu hoja de cálculo (ver server/Bitacora.gs y la
     sección 10 de RECUERDAME.md).

     Dejar "" para funcionar solo en este dispositivo (sin
     sincronización). Ejemplo completo:
     BITACORA_URL: "https://script.google.com/macros/s/XXXXXXXX/exec"
     ============================================================ */
  BITACORA_URL: "https://script.google.com/macros/s/AKfycbzOfFgIHrSBJgYCAjAeI-FwlTFadtBq3jYLfTaWa69-426LmsDj2k0AFwx3XP4UQO4D/exec",

  /* Versión visible de la app (ajústala cada vez que cambies algo).
     Sirve para comprobar de qué versión está cada teléfono. */
  APP_VERSION: "5"
};