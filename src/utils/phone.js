// Kenyan mobile: 07XXXXXXXX / +2547XXXXXXXX / 2547XXXXXXXX -> 2547XXXXXXXX
export function normalizePhone(input) {
  if (typeof input !== "string") return null;
  let digits = input.replace(/[\s\-()]/g, "");

  if (digits.startsWith("+")) digits = digits.slice(1);

  if (/^0[17]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }

  if (/^254[17]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

// Pretty display: 254712345678 -> 0712 345 678
export function formatPhoneDisplay(phone) {
  const match = /^254(\d{3})(\d{3})(\d{3})$/.exec(phone || "");
  if (!match) return phone;
  return `0${match[1]} ${match[2]} ${match[3]}`;
}
