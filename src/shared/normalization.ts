export function normalizeIranianPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
    .replace(/\D/g, "");

  if (digits.startsWith("0098")) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("98")) {
    digits = "0" + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    digits = "0" + digits;
  }
  return digits;
}

export function normalizeDigits(str: string): string {
  if (!str) return "";
  return str
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
}
