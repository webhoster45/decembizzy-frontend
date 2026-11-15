import { useEffect, useRef, useState } from "react";
import { clearAuthToken, getAuthToken, saveAuthToken } from "./authClient.js";

const MAX_QUANTITY = 5;
const MAX_RECEIPT_SIZE = 3 * 1024 * 1024;

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function restoreSession(setSession, setAuthReady, setError) {
  const token = getAuthToken();
  if (!token) {
    setAuthReady(true);
    return;
  }
  try {
    const { user } = await api("/auth/session", { accessToken: token });
    setSession({ access_token: token, user });
  } catch (error) {
    clearAuthToken();
    if (error.message !== "Your session has expired. Sign in again.") {
      setError(error.message);
    }
  } finally {
    setAuthReady(true);
  }
}

async function api(path, { method = "GET", body, key, accessToken } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["X-Order-Key"] = key;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "The Decembizzy API is unavailable. Restart the development server from the project folder with `npm run dev`.",
    );
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function money(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

function DigitalTicket({ ticket, order, event }) {
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(ticket.code, {
          width: 180,
          margin: 1,
          errorCorrectionLevel: "M",
        }),
      )
      .then((image) => {
        if (active) setQrImage(image);
      })
      .catch((error) => {
        console.error("Could not render ticket QR code:", error);
      });

    return () => {
      active = false;
    };
  }, [ticket.code]);

  return (
    <article className="digital-ticket">
      <div className="digital-ticket-main">
        <div className="digital-ticket-header">
          <span>PAUL UNIVERSITY · AWKA</span>
          <span>DECEMBIZZY 2026</span>
        </div>
        <div className="digital-ticket-content">
          <span className="digital-ticket-kicker">OFFICIAL ADMISSION</span>
          <h3>{order.buyerName}</h3>
          <span className="digital-ticket-type">GENERAL ADMISSION</span>
          <div className="digital-ticket-details">
            <div className="digital-ticket-date">
              <small>DATE</small>
              <strong>{event.eventDate}</strong>
            </div>
            <div>
              <small>PRICE</small>
            <strong>{money(event.ticketPrice)}</strong>
            </div>
            <div className="digital-ticket-venue">
              <small>VENUE</small>
              <strong>{event.venue}</strong>
            </div>
          </div>
        </div>
        <div className="digital-ticket-footer">
          <span>TICKET ID</span>
          <strong>{ticket.code}</strong>
        </div>
      </div>
      <div className="digital-ticket-stub">
        <span className="ticket-stub-admit">ADMIT ONE</span>
        {qrImage ? (
          <img src={qrImage} alt={`Check-in QR code for ticket ${ticket.code}`} />
        ) : (
          <span className="ticket-qr-loading" aria-label="Preparing QR code" />
        )}
        <span className="ticket-stub-id">{ticket.code}</span>
        <span className="ticket-stub-scan">SCAN AT ENTRY</span>
      </div>
    </article>
  );
}

function statusLabel(status) {
  return {
    awaiting_transfer: "Awaiting receipt",
    pending_review: "Payment under review",
    rejected: "Action needed",
    approved: "Payment approved",
  }[status] || status;
}

export function OrderDialog({ open, initialMode = "details", onClose, event }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState("login");
  const [quantity, setQuantity] = useState(1);
  const [buyer, setBuyer] = useState({ name: "" });
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    restoreSession(
      (nextSession) => { if (active) setSession(nextSession); },
      () => { if (active) setAuthReady(true); },
      (nextError) => { if (active) setError(nextError); },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStep(authReady && session
        ? initialMode === "account" ? "account" : "details"
        : "login");
      setError("");
      setMessage("");
      setAuthMode("login");
      dialog.showModal();
    }
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !authReady || !session) return;
    if (step === "login") {
      setStep(initialMode === "account" ? "account" : "details");
    }
  }, [authReady, initialMode, open, session, step]);

  useEffect(() => {
    if (open && authReady && !session && ["account", "details"].includes(step)) {
      setStep("login");
    }
  }, [authReady, open, session, step]);

  useEffect(() => {
    if (!open || step !== "account" || !session) return undefined;
    let active = true;
    setWorking(true);
    setError("");
    api("/orders", { accessToken: session.access_token })
      .then(({ orders: loadedOrders }) => {
        if (active) setOrders(loadedOrders);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setWorking(false);
      });

    return () => { active = false; };
  }, [open, session, step]);

  const ticketPrice = Number(event.ticketPrice) || 0;
  const quantityTotal = quantity * ticketPrice;

  async function authenticateBuyer(eventSubmit) {
    eventSubmit.preventDefault();
    setError("");
    setMessage("");
    setWorking(true);
    try {
      const email = authEmail.trim().toLowerCase();
      if (authMode === "signup") {
        const { session: newSession } = await api("/auth/signup", {
          method: "POST",
          body: { email, password: authPassword },
        });
        saveAuthToken(newSession.access_token);
        setSession(newSession);
        setStep(initialMode === "account" ? "account" : "details");
      } else {
        const { session: newSession } = await api("/auth/login", {
          method: "POST",
          body: { email, password: authPassword },
        });
        saveAuthToken(newSession.access_token);
        setSession(newSession);
        setStep(initialMode === "account" ? "account" : "details");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  function openOrder(selectedOrder) {
    setOrder(selectedOrder);
    setBuyer((current) => ({ ...current }));
    setMessage("");
    setError("");
    setStep(selectedOrder.status === "approved" ? "ticket" : "transfer");
  }

  async function createOrder(eventSubmit) {
    eventSubmit.preventDefault();
    setError("");
    if (!event.canAcceptTransfers || !event.bankDetails) {
      setError("Ticket orders are temporarily unavailable. Please try again when the official transfer details are ready.");
      return;
    }
    setWorking(true);
    try {
      const { order: createdOrder } = await api("/orders", {
        method: "POST",
        accessToken: session.access_token,
        body: { ...buyer, quantity },
      });
      setOrder({ ...createdOrder, buyerName: buyer.name });
      setStep("transfer");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  async function reloadOrder() {
    if (!order || !session) return;
    setError("");
    setWorking(true);
    try {
      const { order: refreshed } = await api(`/orders/${encodeURIComponent(order.orderNumber)}`, {
        accessToken: session.access_token,
      });
      setOrder(refreshed);
      if (refreshed.status === "approved") setStep("ticket");
      else if (refreshed.status === "pending_review") setMessage("Still under review. You can return to this order from My tickets.");
      else if (refreshed.status === "rejected") setMessage("Your receipt needs attention. Please upload a corrected receipt.");
      else setMessage("The order is still awaiting a receipt.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  async function submitReceipt(eventSubmit) {
    eventSubmit.preventDefault();
    setError("");
    setMessage("");
    if (!receipt) return setError("Choose your transfer receipt first.");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(receipt.type)) {
      return setError("Upload a JPG, PNG, WebP image, or PDF.");
    }
    if (!receipt.size || receipt.size > MAX_RECEIPT_SIZE) {
      return setError("Receipt files must be no larger than 3 MB.");
    }

    setWorking(true);
    try {
      const { order: submitted } = await api("/orders/receipt-upload", {
        method: "POST",
        accessToken: session.access_token,
        body: {
          orderNumber: order.orderNumber,
          mimeType: receipt.type,
          fileSize: receipt.size,
          fileData: await fileToBase64(receipt),
        },
      });
      setOrder({ ...order, ...submitted });
      setOrders((current) => current.map((item) =>
        item.orderNumber === order.orderNumber ? { ...item, ...submitted } : item,
      ));
      setReceipt(null);
      const fileInput = document.querySelector("#receipt-file");
      if (fileInput) fileInput.value = "";
      setMessage("Receipt submitted. Your ticket will be available here after an admin confirms the transfer.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  async function downloadTickets() {
    if (!order?.tickets?.length) return;
    setWorking(true);
    setError("");
    try {
      const [{ default: QRCode }, { jsPDF }] = await Promise.all([
        import("qrcode"),
        import("jspdf"),
      ]);
      const codes = order.tickets.map((ticket) => ticket.code);
      const qr = await Promise.all(codes.map((code) => QRCode.toDataURL(code, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: "M",
      })));
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      order.tickets.forEach((ticket, index) => {
        if (index > 0) pdf.addPage();

        const margin = 7;
        const ticketWidth = pageWidth - margin * 2;
        const ticketHeight = pageHeight - margin * 2;
        const stubX = pageWidth - 57;
        const contentX = margin + 8;

        pdf.setFillColor(236, 234, 224);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setFillColor(255, 254, 248);
        pdf.roundedRect(margin, margin, ticketWidth, ticketHeight, 3, 3, "F");
        pdf.setFillColor(19, 31, 25);
        pdf.roundedRect(margin, margin, ticketWidth, 31, 3, 3, "F");
        pdf.rect(margin, margin + 25, ticketWidth, 6, "F");
        pdf.setFillColor(233, 239, 218);
        pdf.rect(stubX, margin + 31, pageWidth - margin - stubX, ticketHeight - 31, "F");

        pdf.setTextColor(249, 247, 239);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("PAUL UNIVERSITY · AWKA", contentX, margin + 11);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text("FACULTY OF LAW  ×  SRC", contentX, margin + 19);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(17);
        pdf.text("DECEMBIZZY", stubX - 7, margin + 19, { align: "right" });
        pdf.setFontSize(7);
        pdf.text("OFFICIAL ADMISSION", contentX, margin + 40);

        pdf.setTextColor(20, 37, 26);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        const buyerName = pdf.splitTextToSize(order.buyerName, stubX - contentX - 8);
        pdf.text(buyerName, contentX, margin + 52);
        const nameBottom = margin + 52 + (buyerName.length - 1) * 7;
        pdf.setFontSize(8);
        pdf.text("GENERAL ADMISSION", contentX, nameBottom + 8);

        pdf.setDrawColor(212, 214, 200);
        const detailsTop = Math.max(margin + 80, nameBottom + 19);
        pdf.line(contentX, detailsTop - 5, stubX - 6, detailsTop - 5);
        pdf.setFontSize(7);
        pdf.setTextColor(117, 128, 111);
        pdf.text("DATE", contentX, detailsTop);
        pdf.text("PRICE · PAID", contentX + 69, detailsTop);
        pdf.text("VENUE", contentX, detailsTop + 16);
        pdf.text("TICKET ID", contentX + 69, detailsTop + 16);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(20, 37, 26);
        pdf.setFontSize(9);
        pdf.text(event.eventDate, contentX, detailsTop + 5);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text(money(event.ticketPrice), contentX + 69, detailsTop + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(
          pdf.splitTextToSize(event.venue, 61),
          contentX,
          detailsTop + 21,
        );
        pdf.setFont("courier", "normal");
        pdf.setFontSize(5.5);
        pdf.text(
          pdf.splitTextToSize(ticket.code, 45),
          contentX + 69,
          detailsTop + 21,
        );

        pdf.setDrawColor(137, 148, 122);
        pdf.setLineWidth(0.35);
        for (let y = margin + 34; y < pageHeight - margin - 2; y += 3) {
          pdf.line(stubX, y, stubX, y + 1.4);
        }
        pdf.setTextColor(42, 59, 39);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text("ADMIT ONE", (stubX + pageWidth - margin) / 2, margin + 42, { align: "center" });
        const qrSize = 36;
        const qrX = (stubX + pageWidth - margin - qrSize) / 2;
        const qrY = margin + 47;
        pdf.addImage(qr[index], "PNG", qrX, qrY, qrSize, qrSize);
        pdf.setFont("courier", "bold");
        pdf.setFontSize(5.5);
        pdf.text(
          pdf.splitTextToSize(ticket.code, 48),
          (stubX + pageWidth - margin) / 2,
          qrY + qrSize + 4,
          { align: "center" },
        );
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.text("SCAN AT ENTRY", (stubX + pageWidth - margin) / 2, pageHeight - margin - 3, {
          align: "center",
        });

        pdf.setTextColor(117, 128, 111);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.text("ONE NIGHT · ALL OF US", contentX, pageHeight - margin - 4);
        pdf.text(`${index + 1} OF ${order.tickets.length}`, stubX - 7, pageHeight - margin - 4, {
          align: "right",
        });
      });

      pdf.save(`${order.orderNumber}-tickets.pdf`);
    } catch (downloadError) {
      setError(`Could not create ticket download: ${downloadError.message}`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <dialog
      className="checkout-dialog"
      ref={dialogRef}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="dialog-topline">
        <span className="gateway-brand"><span className="gateway-mark">D</span> DECEMBIZZY <span className="gateway-demo-tag">BANK TRANSFER</span></span>
        <button className="icon-button" type="button" aria-label="Close checkout" onClick={onClose}>×</button>
      </div>

      {step === "login" && (
        <section className="checkout-content">
          <div className="dialog-step">YOUR ACCOUNT</div>
          <h2 id="dialog-title">Your ticket, your account.</h2>
          <p className="dialog-subtitle">
            {authMode === "signup"
              ? "Create an account with your email and a password. You can sign in straight away."
              : "Sign in with the email and password for your Decembizzy account."}
          </p>
          <div className="auth-mode-switch" aria-label="Account action">
            <button
              className={authMode === "login" ? "selected" : ""}
              type="button"
              onClick={() => {
                setAuthMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={authMode === "signup" ? "selected" : ""}
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form onSubmit={authenticateBuyer}>
            <label className="input-label" htmlFor="buyer-login-email">Email address</label>
            <input
              id="buyer-login-email"
              className="text-input"
              type="email"
              autoComplete="email"
              required
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
            />
            <label className="input-label" htmlFor="buyer-login-password">Password</label>
            <input
              id="buyer-login-password"
              className="text-input"
              type="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              minLength={authMode === "signup" ? 8 : undefined}
              required
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />
            <button className="primary-button dialog-action" type="submit" disabled={working || !authEmail.trim() || !authPassword}>
              {working
                ? authMode === "signup" ? "Creating account…" : "Signing in…"
                : authMode === "signup" ? "Create account →" : "Sign in →"}
            </button>
          </form>
          {authMode === "signup" && (
            <p className="privacy-note">Use at least 8 characters. You can sign in as soon as your account is created; no email confirmation is required.</p>
          )}
          <p className="privacy-note">Your account keeps your orders and approved tickets together. Tickets are available here to download; email delivery may be added later.</p>
        </section>
      )}

      {step === "account" && (
        <section className="checkout-content">
          <div className="dialog-step">YOUR DECEMBIZZY ACCOUNT</div>
          <h2 id="dialog-title">My tickets.</h2>
          <p className="dialog-subtitle">
            Signed in as {session?.user.email}. View your order status or open an approved ticket.
          </p>
          <button className="primary-button dialog-action" type="button" onClick={() => {
            setOrder(null);
            setBuyer({ name: "" });
            setQuantity(1);
            setStep("details");
          }}>
            Get a ticket →
          </button>
          {working && <p className="admin-empty">Loading your orders…</p>}
          {!working && orders.length === 0 && (
            <p className="admin-empty">No orders yet. Your Decembizzy tickets will appear here.</p>
          )}
          <div className="account-orders">
            {orders.map((accountOrder) => (
              <button
                className="account-order"
                key={accountOrder.id}
                type="button"
                onClick={() => openOrder(accountOrder)}
              >
                <span>
                  <strong>{accountOrder.orderNumber}</strong>
                  <small>{accountOrder.quantity} {accountOrder.quantity === 1 ? "ticket" : "tickets"} · {money(accountOrder.amount)}</small>
                </span>
                <span className={`status-pill status-${accountOrder.status}`}>{statusLabel(accountOrder.status)}</span>
              </button>
            ))}
          </div>
          <button
            className="back-button"
            type="button"
            disabled={working}
            onClick={async () => {
              try {
                await api("/auth/logout", {
                  method: "POST",
                  accessToken: session.access_token,
                });
              } catch (signOutError) {
                setError(signOutError.message);
                return;
              }
              clearAuthToken();
              setSession(null);
              setStep("login");
            }}
          >
            Sign out
          </button>
        </section>
      )}

      {step === "details" && (
        <section className="checkout-content">
          <div className="dialog-step">01 <span>YOUR TICKET</span></div>
          <h2 id="dialog-title">Let’s get you in.</h2>
          <p className="dialog-subtitle">Create your order, transfer the total, then upload your receipt for verification. Orders are for up to five admissions; every ticket uses the buyer’s name.</p>
          <div className="order-summary"><span className="summary-icon">□</span><span className="summary-name"><strong>Decembizzy · General admission</strong><small>{event.eventDate}</small></span><strong>{money(ticketPrice)}</strong></div>
          <form onSubmit={createOrder}>
            <label className="input-label" htmlFor="buyer-name">Full name</label>
            <input id="buyer-name" className="text-input" autoComplete="name" minLength={2} maxLength={80} required value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} />
            <label className="input-label" htmlFor="buyer-email">Account email</label>
            <input id="buyer-email" className="text-input" type="email" value={session?.user.email || ""} readOnly />
            <div className="quantity-picker"><span><strong>Tickets</strong><small>{money(ticketPrice)} each · up to five per order</small></span><div className="quantity-controls"><button type="button" aria-label="Remove one ticket" disabled={quantity <= 1} onClick={() => setQuantity((current) => current - 1)}>−</button><output>{quantity}</output><button type="button" aria-label="Add one ticket" disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity((current) => current + 1)}>+</button></div></div>
            <div className="order-total"><span>Total</span><strong>{money(quantityTotal)}</strong></div>
            <button className="primary-button dialog-action" type="submit" disabled={working || !event.canAcceptTransfers}>{working ? "Creating order…" : event.canAcceptTransfers ? "Create transfer order →" : "Ticket sales opening soon"}</button>
          </form>
          {!event.canAcceptTransfers && <div className="event-setup-warning">Orders are disabled until the organizers add the official bank details. No placeholder account will be shown.</div>}
          <div className="privacy-note">Your orders and tickets are saved to your Decembizzy account.</div>
        </section>
      )}

      {step === "transfer" && order && (
        <section className="checkout-content">
          <div className="dialog-step">02 <span>BANK TRANSFER</span></div>
          <h2 id="dialog-title">Your transfer details.</h2>
          <p className="dialog-subtitle">Transfer the exact amount, then upload your receipt. An admin will verify it against the bank statement.</p>
          <div className="transfer-order-banner"><span><small>YOUR ORDER</small><strong>{order.orderNumber}</strong></span><span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span></div>
          {event.bankDetails && (
            <div className="bank-details">
              <div><small>BANK</small><strong>{event.bankDetails.bankName}</strong></div>
              <div><small>ACCOUNT NAME</small><strong>{event.bankDetails.accountName}</strong></div>
              <div><small>ACCOUNT NUMBER</small><strong>{event.bankDetails.accountNumber}</strong></div>
              <div className="bank-amount"><span>Transfer exactly</span><strong>{money(order.amount)}</strong></div>
              <small>Use the order number above as your transfer narration.</small>
            </div>
          )}
          {!event.bankDetails && <div className="event-setup-warning">The official bank details have not been configured. Do not send money to placeholders. Contact the organizers for the approved account.</div>}
          <div className="buyer-details-preview"><span>ORDER FOR</span><strong>{order.buyerName}</strong><span>{order.quantity} {order.quantity === 1 ? "ticket" : "tickets"} · {money(order.amount)}</span></div>
          {order.status === "approved" ? (
            <div className="approved-tickets"><strong>Transfer approved — your ticket is ready.</strong><button className="primary-button dialog-action" type="button" disabled={working} onClick={downloadTickets}>{working ? "Preparing…" : "Download my ticket ↓"}</button></div>
          ) : order.status === "pending_review" ? (
            <div className="review-status"><strong>Payment under review</strong><p>Your receipt is in the review queue. You can return to this order any time from My tickets.</p><button className="secondary-button" type="button" disabled={working} onClick={reloadOrder}>{working ? "Checking…" : "Refresh order status"}</button></div>
          ) : (
            <>
              {order.status === "rejected" && <div className="payment-error" role="alert">{message || "A reviewer requested a corrected receipt. Please upload the updated proof."}</div>}
              <form className="receipt-form" onSubmit={submitReceipt}>
                <label className="input-label" htmlFor="receipt-file">Upload bank transfer receipt</label>
                <input id="receipt-file" className="file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(event) => { setReceipt(event.target.files?.[0] || null); setError(""); }} />
                <small className="file-help">{receipt ? `${receipt.name} · ${(receipt.size / (1024 * 1024)).toFixed(2)} MB` : "JPG, PNG, WebP or PDF · maximum 3 MB. Choose a smaller file if it exceeds the limit."}</small>
                <button className="primary-button dialog-action" type="submit" disabled={working || !event.bankDetails}>{working ? "Uploading…" : "Submit receipt for review"}</button>
              </form>
              <p className="receipt-disclaimer">Uploading proof does not confirm payment or issue a valid ticket. Wait for admin approval.</p>
            </>
          )}
          {message && order.status !== "pending_review" && <p className="form-notice" role="status">{message}</p>}
          <button className="secondary-button save-link-button" type="button" onClick={() => setStep("account")}>Back to My tickets</button>
          <button className="back-button" type="button" disabled={working} onClick={reloadOrder}>Check latest order status</button>
        </section>
      )}

      {step === "ticket" && order && (
        <section className="checkout-content">
          <div className="dialog-step">PAYMENT APPROVED</div><h2 id="dialog-title">You’re on the list.</h2>
          <p className="dialog-subtitle">Your payment was approved. Download and keep the ticket safe for the event.</p>
          <div className="digital-ticket-list">
            {(order.tickets || []).map((ticket) => (
              <DigitalTicket key={ticket.code} ticket={ticket} order={order} event={event} />
            ))}
          </div>
          <button className="primary-button dialog-action" type="button" disabled={working || !order.tickets?.length} onClick={downloadTickets}>{working ? "Preparing ticket…" : "Download paper tickets · PDF"}</button>
          <p className="receipt-disclaimer">Each ticket shows the attendee, paid price and unique ticket ID. The QR code is for quick entry validation.</p>
          <button className="secondary-button save-link-button" type="button" onClick={() => setStep("account")}>Back to My tickets</button>
          <button className="back-button" type="button" onClick={onClose}>Done</button>
        </section>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-footer">DIRECT BANK TRANSFER · TICKET ISSUED AFTER MANUAL APPROVAL</div>
    </dialog>
  );
}

export function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    pendingReview: 0,
    approvedOrders: 0,
    ticketsIssued: 0,
    checkedIn: 0,
  });
  const [filter, setFilter] = useState("pending_review");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSetupSecret, setAdminSetupSecret] = useState("");
  const [adminMode, setAdminMode] = useState("login");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState({});
  const [decisionNotes, setDecisionNotes] = useState({});
  const [checkInCode, setCheckInCode] = useState("");
  const [checkInResult, setCheckInResult] = useState("");

  useEffect(() => {
    let active = true;
    restoreSession(
      (nextSession) => { if (active) setSession(nextSession); },
      () => { if (active) setAuthReady(true); },
      (nextError) => { if (active) setError(nextError); },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session?.user.role !== "admin") return;
    let active = true;
    setOrdersLoading(true);
    setError("");
    api(`/admin/orders?status=${encodeURIComponent(filter)}`, {
      accessToken: session.access_token,
    }).then(({ orders: loadedOrders, summary: loadedSummary }) => {
      if (active) {
        setOrders(loadedOrders);
        setSummary(loadedSummary);
      }
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setOrdersLoading(false);
    });
    return () => { active = false; };
  }, [filter, session]);

  async function authenticateAdmin(event) {
    event.preventDefault();
    setAuthBusy(true);
    setError("");
    try {
      const { session: newSession } = await api(
        adminMode === "signup" ? "/auth/admin-signup" : "/auth/login",
        {
          method: "POST",
          body: {
            email: adminEmail.trim().toLowerCase(),
            password: adminPassword,
            ...(adminMode === "signup"
              ? { setupSecret: adminSetupSecret }
              : { role: "admin" }),
          },
        },
      );
      if (newSession.user.role !== "admin") {
        await api("/auth/logout", {
          method: "POST",
          accessToken: newSession.access_token,
        });
        throw new Error("This account is not an authorized reviewer.");
      }
      saveAuthToken(newSession.access_token);
      setSession(newSession);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOutAdmin() {
    try {
      if (session?.access_token) {
        await api("/auth/logout", {
          method: "POST",
          accessToken: session.access_token,
        });
      }
      clearAuthToken();
      setSession(null);
      setOrders([]);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function reviewOrder(order, decision) {
    setReviewBusy(true);
    setError("");
    setNote("");
    try {
      await api("/admin/review", {
        method: "POST",
        accessToken: session.access_token,
        body: {
          orderId: order.id,
          decision,
          note: decisionNotes[order.id] || "",
          paymentVerified: verified[order.id] === true,
        },
      });
      setNote(`${order.orderNumber} ${decision}.`);
      const { orders: loadedOrders, summary: loadedSummary } = await api(`/admin/orders?status=${encodeURIComponent(filter)}`, {
        accessToken: session.access_token,
      });
      setOrders(loadedOrders);
      setSummary(loadedSummary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReviewBusy(false);
    }
  }

  async function checkIn(event) {
    event.preventDefault();
    setCheckInBusy(true);
    setError("");
    setCheckInResult("");
    try {
      const { result } = await api("/admin/check-in", {
        method: "POST",
        accessToken: session.access_token,
        body: { code: checkInCode },
      });
      setCheckInResult({ status: result.status, text: `${result.buyer_name} · ${result.order_number}` });
      setCheckInCode("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCheckInBusy(false);
    }
  }

  if (!authReady) return <AdminShell><p className="admin-empty">Checking admin session…</p></AdminShell>;

  if (!session || session.user.role !== "admin") {
    return (
      <AdminShell>
        <form className="admin-login checkout-content" onSubmit={authenticateAdmin}>
          <div className="dialog-step">DECEMBIZZY · ORGANIZER</div>
          <h2>{adminMode === "signup" ? "Set up admin access." : "Welcome back."}</h2>
          <p className="dialog-subtitle">
            {adminMode === "signup"
              ? "Create an organizer account with the private admin setup key."
              : "Sign in with your organizer email and password."}
          </p>
          <label className="input-label" htmlFor="admin-email">Email address</label>
          <input id="admin-email" className="text-input" type="email" autoComplete="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          <label className="input-label" htmlFor="admin-password">Password</label>
          <input id="admin-password" className="text-input" type="password" autoComplete={adminMode === "signup" ? "new-password" : "current-password"} minLength="8" maxLength="128" required value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
          {adminMode === "signup" && (
            <>
              <label className="input-label" htmlFor="admin-setup-secret">Admin setup key</label>
              <input id="admin-setup-secret" className="text-input" type="password" autoComplete="off" required value={adminSetupSecret} onChange={(event) => setAdminSetupSecret(event.target.value)} />
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button dialog-action" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : adminMode === "signup" ? "Create admin account →" : "Sign in →"}</button>
          <button className="back-button" type="button" onClick={() => { setAdminMode(adminMode === "signup" ? "login" : "signup"); setError(""); }}>
            {adminMode === "signup" ? "Back to admin sign in" : "First-time admin setup"}
          </button>
        </form>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <section className="admin-dashboard">
        <header className="admin-header"><div><div className="dialog-step">PAUL UNIVERSITY · AWKA</div><h1>Transfer review.</h1><p>Signed in as {session.user.email}</p></div><button className="secondary-button" type="button" onClick={signOutAdmin}>Sign out</button></header>
        <div className="admin-stats" aria-label="Event overview">
          <div><small>ORDERS</small><strong>{summary.totalOrders}</strong></div>
          <div><small>NEEDS REVIEW</small><strong>{summary.pendingReview}</strong></div>
          <div><small>APPROVED</small><strong>{summary.approvedOrders}</strong></div>
          <div><small>TICKETS ISSUED</small><strong>{summary.ticketsIssued}</strong></div>
          <div><small>CHECKED IN</small><strong>{summary.checkedIn}</strong></div>
        </div>
        <nav className="admin-filters" aria-label="Filter orders">{["pending_review", "awaiting_transfer", "rejected", "approved", "all"].map((item) => { const count = item === "pending_review" ? summary.pendingReview : item === "approved" ? summary.approvedOrders : item === "all" ? summary.totalOrders : null; return <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : statusLabel(item)}{count !== null ? ` (${count})` : ""}</button>; })}</nav>
        {error && <p className="form-error" role="alert">{error}</p>}{note && <p className="form-notice" role="status">{note}</p>}
        <div className="check-in-panel"><form onSubmit={checkIn}><label className="input-label" htmlFor="check-in-code">Check in ticket by QR code value</label><div className="check-in-input"><input id="check-in-code" className="text-input" autoComplete="off" autoCapitalize="characters" placeholder="Scan or enter ticket ID" value={checkInCode} onChange={(event) => setCheckInCode(event.target.value.trim())} required /><button className="primary-button" disabled={checkInBusy}>{checkInBusy ? "Checking…" : "Check in"}</button></div></form>{checkInResult && <p className={`check-in-result ${checkInResult.status === "checked_in" ? "success" : "used"}`} role="status"><strong>{checkInResult.status === "checked_in" ? "ENTRY APPROVED" : "ALREADY CHECKED IN"}</strong><span>{checkInResult.text}</span></p>}</div>
        {ordersLoading && <p className="admin-empty" role="status">Loading orders…</p>}
        {!ordersLoading && orders.length === 0 && <p className="admin-empty">No orders in this view.</p>}
        <div className="admin-orders">{orders.map((order) => <article className="admin-order" key={order.id}>
          <div className="admin-order-top"><div><strong>{order.orderNumber}</strong><span>{new Date(order.createdAt).toLocaleString()}</span></div><span className={`status-pill status-${order.status}`}>{statusLabel(order.status)}</span></div>
          <div className="admin-order-buyer"><strong>{order.buyerName}</strong><span>{order.buyerEmail}</span><span>{order.quantity} × {money(order.amount / order.quantity)} · <b>{money(order.amount)}</b></span></div>
          {order.receiptUrl && (
            <div className="receipt-links">
              <a className="receipt-link" href={order.receiptUrl} target="_blank" rel="noreferrer">View receipt ↗</a>
              <a className="receipt-link receipt-link-download" href={order.receiptDownloadUrl} download>Download receipt ↓</a>
            </div>
          )}
          {order.receiptUploadedAt && <p className="receipt-time">Uploaded {new Date(order.receiptUploadedAt).toLocaleString()}</p>}
          {order.status === "pending_review" && <div className="admin-review-controls">
            <label className="admin-confirm"><input type="checkbox" checked={verified[order.id] || false} onChange={(event) => setVerified({ ...verified, [order.id]: event.target.checked })} /><span>I matched this transfer against the official bank statement.</span></label>
            <label className="input-label" htmlFor={`review-note-${order.id}`}>Reviewer note</label><textarea id={`review-note-${order.id}`} className="text-input" rows="2" maxLength="500" placeholder="Required when rejecting" value={decisionNotes[order.id] || ""} onChange={(event) => setDecisionNotes({ ...decisionNotes, [order.id]: event.target.value })} />
            <div className="review-actions"><button className="primary-button" type="button" disabled={reviewBusy || !verified[order.id]} onClick={() => reviewOrder(order, "approved")}>{reviewBusy ? "Saving…" : "Approve & issue tickets"}</button><button className="secondary-button reject-button" type="button" disabled={reviewBusy || (decisionNotes[order.id] || "").trim().length < 3} onClick={() => reviewOrder(order, "rejected")}>Reject</button></div>
          </div>}
          {order.reviews?.length > 0 && <div className="review-history"><strong>Review audit</strong>{order.reviews.map((review) => <span key={`${review.reviewerEmail}-${review.createdAt}`}>{review.decision} by {review.reviewerEmail} · {new Date(review.createdAt).toLocaleString()}{review.note ? ` · ${review.note}` : ""}</span>)}</div>}
          {order.tickets?.length > 0 && <div className="issued-code-list"><strong>Issued tickets</strong>{order.tickets.map((ticket) => <span key={ticket.code}>{ticket.code} · {ticket.status}</span>)}</div>}
        </article>)}</div>
      </section>
    </AdminShell>
  );
}

function AdminShell({ children }) {
  return <main className="admin-page"><a className="admin-brand" href="/">DECEMBIZZY <span>·</span> REVIEWER CONSOLE</a>{children}</main>;
}

export function OrderLookupButton({ onClick, hasToken }) {
  return <button type="button" className="order-lookup-button" onClick={onClick}>{hasToken ? "My tickets →" : "My tickets · sign in"}</button>;
}
