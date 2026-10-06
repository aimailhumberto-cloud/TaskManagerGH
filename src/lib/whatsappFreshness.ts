export const freshEvidence = (value: string | null, now = Date.now()) => !!value && now - Date.parse(value) >= -5000 && now - Date.parse(value) <= 120000;
