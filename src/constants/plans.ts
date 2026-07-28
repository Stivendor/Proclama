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
export const FOUNDER_PRICE_UNTIL = '2026-09-30';

export const WHATSAPP_NUMBER = '573044762051';
export const TRIAL_DAYS = 30;
