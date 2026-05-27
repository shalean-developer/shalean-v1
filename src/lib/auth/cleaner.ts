const cleanerEmailDomain = "shalean.co.za";

export function cleanCleanerPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0027")) {
    return `27${digits.slice(4)}`;
  }

  return digits;
}

export function validateCleanerPhone(phone: string) {
  const digits = cleanCleanerPhone(phone);

  if (!digits) {
    throw new Error("Phone number is required.");
  }

  if (!/^0\d{9}$/.test(digits) && !/^27\d{9}$/.test(digits)) {
    throw new Error("Enter a valid South African phone number.");
  }

  return digits;
}

export function cleanerEmailFromPhone(phone: string) {
  return `${validateCleanerPhone(phone)}@${cleanerEmailDomain}`;
}
