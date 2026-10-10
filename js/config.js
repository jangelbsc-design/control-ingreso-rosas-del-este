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

  /* Numero de hoja (gid) de la pestaña SHEET_NAME. Se ve en la URL de
     la pestaña: .../edit#gid=<ESTE_NUMERO>. Se usa para descargar la
     hoja en crudo y así conservar los teléfonos con guiones/espacios
     (Google los borra en el formato número). Puedes dejarlo "" para
     desactivarlo y volver a solo gviz. */
  SHEET_GID: "1653009094",

  /* Pestaña con los usuarios y contraseñas para iniciar sesión
     (columnas: USUARIO · CONTRASEÑA · [ROL opcional]).
     El rol "admin" (o un usuario que contenga "admin") ve las
     funciones de administración, como el mensaje de cobranza. */
  SHEET_USERS: "Usuarios",

  APP_NAME: "Urbanización Rosas del Este",
  APP_SUBTITLE: "Control de Ingreso",

  /* Prefijo internacional para llamadas/WhatsApp (Bolivia: 591).
     Cambiar si la urbanización está en otro país. */
  COUNTRY_CODE: "591",

  /* Intervalo en minutos para recargar los datos de forma
     automática. Poner 0 para desactivar la recarga. */
  AUTO_REFRESH_MIN: 5,

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
  APP_VERSION: "21",

  /* Imagen del QR de pago que se adjunta a los recordatorios
     (cobranza para morosos y recordatorio para vigentes).
     Guarda tu archivo en esa ruta, dentro de la carpeta de la app. */
  QR_IMAGE: "imágenes/QR pago expensas.jpeg",

  /* ---------------------------------------------------------
     AVISO DE "CANCELADO" (última cuota pagada)
     ---------------------------------------------------------
     La columna CANCELADO NO está en la pestaña de los vecinos
     (PROPIETARIOS): vive en otra pestaña del mismo documento.
     La app la descarga aparte y la muestra literal en la ficha.

     SHEET_CANCELADO: pestaña donde está la columna.
     COL_CANCELADO:  nombre exacto de la columna a mostrar.
     COL_CANCELADO_MZ: columna con el manzano, para emparejar.
     Dejar SHEET_CANCELADO en "" apaga el aviso por completo. */
  SHEET_CANCELADO: "Hoja1",
  COL_CANCELADO: "CANCELADO",
  COL_CANCELADO_MZ: "MAZANO",

  /* La columna CANCELADA trae el mes y el año va en la columna
     de al lado (GESTIÓN). Se juntan solo cuando CANCELADO no
     trae ya un año, para no escribir "Agosto // 25 2025".
     Dejarlo en "" muestra el mes solo, como estaba antes. */
  COL_CANCELADO_ANIO: "GESTIÓN",

  /* ---------------------------------------------------------
     PISCINA (manillas del vecino)
     ---------------------------------------------------------
     La columna PISCINA SÍ está en la pestaña de los vecinos
     (PROPIETARIOS): dice cuántas manillas tiene cada uno
     ("Sin Manillas", "5 Maniilas Rojas", "5 Manillas Verdes").
     La app la reconoce sola y la muestra discreta: una línea al pie
     de la tarjeta y una línea tenue en la ficha. El texto va literal.

     MOSTRAR_PISCINA: false la apaga por completo (como si no
     existiera la columna). */
  MOSTRAR_PISCINA: true
};