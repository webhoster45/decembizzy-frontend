export function getPublicBankDetails() {
  const bankName = process.env.BANK_NAME?.trim() || "Fidelity Bank";
  const accountName =
    process.env.BANK_ACCOUNT_NAME?.trim() || "Ogbaekwe Chineye Precious";
  const accountNumber =
    process.env.BANK_ACCOUNT_NUMBER?.replace(/\s/g, "") || "6982652382";
  const configured =
    bankName.length > 1 &&
    accountName.length > 1 &&
    /^\d{10}$/.test(accountNumber);

  return configured
    ? { configured: true, bankName, accountName, accountNumber }
    : { configured: false, bankName: "", accountName: "", accountNumber: "" };
}
