import { getPublicBankDetails } from "../config.js";
import { requireMethod, sendJson } from "../http.js";

export default function handler(request, response) {
  if (!requireMethod(request, response, "GET")) return;

  const bank = getPublicBankDetails();
  return sendJson(response, 200, {
    eventDate: "Friday, December 11, 2026",
    venue: "Nwaka Building, Paul University, Awka",
    ticketPrice: 4000,
    canAcceptTransfers: bank.configured,
    bankDetails: bank.configured
      ? {
          bankName: bank.bankName,
          accountName: bank.accountName,
          accountNumber: bank.accountNumber,
        }
      : null,
  });
}
