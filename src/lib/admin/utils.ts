import { cleanerEmailFromPhone as authCleanerEmailFromPhone, validateCleanerPhone } from "@/lib/auth/cleaner";

export function normalizeAdminCleanerPhone(phone: string) {
  return validateCleanerPhone(phone);
}

export function cleanerEmailFromPhone(phone: string) {
  return authCleanerEmailFromPhone(phone);
}

export function normalizeAdminPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").trim();
}

export function validatePhone(phone: string, label = "Phone") {
  const value = normalizeAdminPhone(phone);
  if (!/\d/.test(value)) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

export function validateEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("A valid email address is required.");
  }

  return value;
}

export function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

export function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

export function csvList(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function boolValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "true";
}

export function intValue(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function weekdayFromDate(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return [day === 0 ? 7 : day];
}

export function weekdayList(formData: FormData, key: string) {
  return Array.from(
    new Set(
      formData
        .getAll(key)
        .map((value) => Number(String(value)))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7),
    ),
  ).sort((a, b) => a - b);
}
