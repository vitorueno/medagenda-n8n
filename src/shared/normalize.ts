const DOCTOR_TITLE_PREFIX = /^(dr|dra|doutor|doutora)\.?\s+/i;

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeName(value: string): string {
  return normalizeText(value).replace(DOCTOR_TITLE_PREFIX, '');
}
