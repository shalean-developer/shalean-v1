const cleanerEmailDomain = "shalean.co.za";

export function cleanCleanerPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0027")) {
    return `27${digits.slice(4)}`;
  }

  return digits;
}

/** South African mobiles: always store/login as 0XXXXXXXXX (not 27XXXXXXXXX). */
export function canonicalizeCleanerPhoneDigits(digits: string) {
  if (digits.startsWith("27") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

export function validateCleanerPhone(phone: string) {
  const digits = canonicalizeCleanerPhoneDigits(cleanCleanerPhone(phone));

  if (!digits) {
    throw new Error("Phone number is required.");
  }

  if (!/^0\d{9}$/.test(digits)) {
    throw new Error("Enter a valid South African phone number.");
  }

  return digits;
}

export function cleanerEmailFromPhone(phone: string) {
  return `${validateCleanerPhone(phone)}@${cleanerEmailDomain}`;
}

/** Auth emails to try at login (canonical first, then legacy international form). */
export function cleanerLoginEmailsFromPhone(phone: string) {
  const canonical = validateCleanerPhone(phone);
  const emails = [cleanerEmailFromPhone(canonical)];
  const legacyInternational = `27${canonical.slice(1)}@${cleanerEmailDomain}`;

  if (!emails.includes(legacyInternational)) {
    emails.push(legacyInternational);
  }

  return emails;
}
