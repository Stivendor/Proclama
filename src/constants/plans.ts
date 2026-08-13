export const MAX_DEVICES_PREMIUM = 2;

/**
 * Precios en COP, por iglesia (no por persona). Sólo anual: el cobro es manual
 * por transferencia, así que un plan mensual serían 12 cobranzas al año por
 * iglesia. La entrada de bajo compromiso es el mes de prueba, no un plan barato.
 *
 * `founderAnnualCOP` es la promoción de lanzamiento: mitad de precio, congelada
 * de por vida para quien se suscriba antes de FOUNDER_PRICE_UNTIL. No es un plan
 * aparte ni una columna en la base — con este volumen de clientes, "congelado de
 * por vida" es una promesa que se cumple a mano al renovar, no código.
 */
export const PRICING = {
  annualCOP: 199000,
  founderAnnualCOP: 99000,
} as const;

/** Último día con precio fundador (inclusive), en hora de Colombia. */
export const FOUNDER_PRICE_UNTIL = '2026-12-31';

/**
 * Tope del aviso de fin de fase fundadores: a quien le queden más días que esto,
 * no se le muestra.
 *
 * Hace falta un tope porque el grandfathering y una suscripción real dejan la
 * cuenta igual — `plan='paid'` con fecha — y sin él, al cliente que acaba de
 * pagar le saldría el recordatorio de despedida con el texto de la fase
 * fundadores. La gracia son 90 días y el plan que se vende es anual (365), así
 * que 100 los separa de sobra.
 *
 * Es un umbral de días y no una fecha a propósito: una constante con el fin de
 * la gracia habría que ajustarla a mano el día de correr el script, y olvidarla
 * fallaría en silencio — el aviso no le saldría a nadie, sin error ni test rojo.
 */
export const GRACE_NOTICE_MAX_DAYS = 100;

export const WHATSAPP_NUMBER = '573044762051';
export const TRIAL_DAYS = 30;
