const DOCTOR_TITLE_PREFIX = /^(dr|dra|doutor|doutora)\.?\s+/i;

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(DOCTOR_TITLE_PREFIX, '')
    .replace(/\s+/g, ' ');
}
