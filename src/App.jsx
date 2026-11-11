import { useEffect, useRef, useState } from "react";

const TICKET_PRICE = 4000;
const MAX_TICKETS = 5;

function Icon({ name, size = 18, strokeWidth = 1.7 }) {
  const paths = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    map: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    minus: <path d="M5 12h14" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    ticket: <><path d="M2 9a3 3 0 0 0 0 6v3h20v-3a3 3 0 0 1 0-6V6H2v3Z" /><path d="M13 6v2m0 4v2m0 4v2" /></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h3" /></>,
    bank: <><path d="m3 10 9-7 9 7M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18M2 10h20" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Brand({ inverse = false }) {
  return (
    <a className={`brand${inverse ? " brand-inverse" : ""}`} href="#" aria-label="Decembizzy home">
      <span className="brand-mark">D<span>.</span></span>
      <span className="brand-wordmark">DECEMBIZZY<span>PAUL UNIVERSITY · AWKA</span></span>
    </a>
  );
}

function TicketDialog({ open, onClose }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState("details");
  const [quantity, setQuantity] = useState(1);
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentState, setPaymentState] = useState("idle");
  const [reference, setReference] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setStep("details");
      setQuantity(1);
      setBuyer({ name: "", email: "" });
      setPaymentMethod("card");
      setPaymentState("idle");
      setReference("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (paymentState !== "processing") return undefined;

    const timer = window.setTimeout(() => {
      setReference(`DBZ-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
      setPaymentState("success");
      setStep("ticket");
    }, 850);

    return () => window.clearTimeout(timer);
  }, [paymentState]);

  function closeDialog() {
    onClose();
  }

  function handleDetailsSubmit(event) {
    event.preventDefault();
    setStep("payment");
    setPaymentState("idle");
  }

  function simulatePayment(result) {
    if (result === "success") {
      setPaymentState("processing");
      return;
    }

    setPaymentState("declined");
  }

  function changeQuantity(amount) {
    setQuantity((current) => Math.min(MAX_TICKETS, Math.max(1, current + amount)));
  }

  const total = quantity * TICKET_PRICE;

  return (
    <dialog
      ref={dialogRef}
      className="checkout-dialog"
      aria-labelledby="dialog-title"
      onCancel={closeDialog}
      onClick={(event) => {
        if (event.target === dialogRef.current) closeDialog();
      }}
    >
      <div className="dialog-topline">
        <span className="gateway-brand"><span className="gateway-mark">S</span> SEERBIT <span className="gateway-demo-tag">DEMO</span></span>
        <button className="icon-button" type="button" aria-label="Close checkout" onClick={closeDialog}>
          <Icon name="close" />
        </button>
      </div>

      {step === "details" && (
        <section className="checkout-content">
          <div className="dialog-step">01 <span>YOUR TICKET</span></div>
          <h2 id="dialog-title">Let’s get you in.</h2>
          <p className="dialog-subtitle">A night worth showing up for. Tell us where to send your demo invitation.</p>

          <div className="order-summary">
            <div className="summary-icon"><Icon name="ticket" /></div>
            <div className="summary-name"><strong>Decembizzy entry</strong><span>General admission · Paul University, Awka</span></div>
            <strong className="summary-unit">{formatNaira(TICKET_PRICE)}</strong>
          </div>

          <form onSubmit={handleDetailsSubmit}>
            <label className="input-label" htmlFor="buyer-name">Full name</label>
            <input
              id="buyer-name"
              className="text-input"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={buyer.name}
              onChange={(event) => setBuyer({ ...buyer, name: event.target.value })}
              maxLength={80}
              required
            />
            <label className="input-label" htmlFor="buyer-email">Email address</label>
            <input
              id="buyer-email"
              className="text-input"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={buyer.email}
              onChange={(event) => setBuyer({ ...buyer, email: event.target.value })}
              maxLength={120}
              required
            />

            <div className="quantity-picker">
              <span><strong>Tickets</strong><small>₦4,000 each · one ticket type</small></span>
              <div className="quantity-controls">
                <button type="button" aria-label="Remove one ticket" disabled={quantity <= 1} onClick={() => changeQuantity(-1)}><Icon name="minus" size={15} /></button>
                <output aria-live="polite">{quantity}</output>
                <button type="button" aria-label="Add one ticket" disabled={quantity >= MAX_TICKETS} onClick={() => changeQuantity(1)}><Icon name="plus" size={15} /></button>
              </div>
            </div>

            <div className="order-total"><span>Total</span><strong>{formatNaira(total)}</strong></div>
            <button className="primary-button dialog-action" type="submit">Continue to payment <Icon name="arrow" size={16} /></button>
          </form>

          <div className="privacy-note"><Icon name="lock" size={14} /> Demo details stay in this browser session. Nothing is sent or saved.</div>
        </section>
      )}

      {step === "payment" && (
        <section className="checkout-content">
          <div className="dialog-step">02 <span>PAYMENT PREVIEW</span></div>
          <h2 id="dialog-title">Checkout, reimagined.</h2>
          <p className="dialog-subtitle">A preview of how a SeerBit hand-off could fit into the ticket flow. Choose a method to explore the demo.</p>

          <div className="gateway-total">
            <span>Paying <strong>{buyer.name}</strong></span>
            <strong>{formatNaira(total)}</strong>
          </div>

          <div className="method-tabs" role="group" aria-label="Demo payment method">
            <button type="button" className={paymentMethod === "card" ? "method-tab selected" : "method-tab"} aria-pressed={paymentMethod === "card"} onClick={() => { setPaymentMethod("card"); setPaymentState("idle"); }}>
              <Icon name="card" size={18} /> Card
            </button>
            <button type="button" className={paymentMethod === "transfer" ? "method-tab selected" : "method-tab"} aria-pressed={paymentMethod === "transfer"} onClick={() => { setPaymentMethod("transfer"); setPaymentState("idle"); }}>
              <Icon name="bank" size={18} /> Transfer
            </button>
          </div>

          <div className="payment-preview">
            {paymentMethod === "card" ? (
              <>
                <div className="preview-card-top"><span>DEMO CARD</span><Icon name="card" size={19} /></div>
                <div className="preview-card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</div>
                <div className="preview-card-bottom"><span>TEST MODE ONLY</span><span>NO CARD DETAILS</span></div>
              </>
            ) : (
              <div className="transfer-preview">
                <span className="transfer-icon"><Icon name="bank" size={20} /></span>
                <span><strong>Bank transfer demo</strong><small>A real bank account or transfer is not created.</small></span>
              </div>
            )}
          </div>

          <div className="test-warning"><Icon name="shield" size={16} /><span><strong>SeerBit simulation — not connected to SeerBit.</strong> No charge, bank transfer, or real transaction occurs.</span></div>

          {paymentState === "declined" && <p className="payment-error" role="alert">Demo result: payment declined. No money was taken. You can try the success simulation.</p>}
          {paymentState === "processing" && <p className="payment-progress" role="status">Simulating payment response…</p>}

          <button className="primary-button dialog-action" type="button" disabled={paymentState === "processing"} onClick={() => simulatePayment("success")}>
            {paymentState === "processing" ? "Simulating…" : `Simulate ${paymentMethod === "card" ? "card" : "transfer"} success`}
            {paymentState !== "processing" && <Icon name="arrow" size={16} />}
          </button>
          <button className="text-button" type="button" disabled={paymentState === "processing"} onClick={() => simulatePayment("declined")}>Simulate a declined payment</button>
          <button className="back-button" type="button" onClick={() => { setStep("details"); setPaymentState("idle"); }}>← Back to ticket details</button>
        </section>
      )}

      {step === "ticket" && (
        <section className="checkout-content pass-content">
          <div className="demo-success"><span><Icon name="check" size={22} /></span><div><strong>Demo flow complete</strong><small>No real payment was made.</small></div></div>
          <div className="demo-pass">
            <div className="pass-header"><span>PAUL UNIVERSITY · AWKA</span><Icon name="sparkle" size={19} /></div>
            <p className="pass-kicker">YOUR DEMO INVITATION</p>
            <h2 id="dialog-title">{buyer.name}</h2>
            <div className="pass-event">DECEMBIZZY <span>·</span> GENERAL ENTRY</div>
            <div className="pass-rule" />
            <div className="pass-info">
              <div><small>DATE</small><strong>To be announced</strong></div>
              <div><small>VENUE</small><strong>Paul University, Awka</strong></div>
              <div><small>QUANTITY</small><strong>{quantity} {quantity === 1 ? "ticket" : "tickets"}</strong></div>
              <div><small>DEMO TOTAL</small><strong>{formatNaira(total)}</strong></div>
            </div>
            <div className="pass-reference">DEMO REFERENCE <strong>{reference}</strong></div>
          </div>
          <div className="invalid-pass-warning"><strong>NOT VALID FOR ENTRY</strong><span>This is a presentation demo only, not a paid ticket. There’s no payment record or scannable entry code.</span></div>
          <div className="pass-actions">
            <button className="primary-button" type="button" onClick={() => window.print()}>Print demo pass</button>
            <button className="primary-button pass-done-button" type="button" onClick={closeDialog}>Done <Icon name="check" size={17} /></button>
          </div>
          <button className="back-button" type="button" onClick={() => { setStep("details"); setPaymentState("idle"); }}>Start another demo</button>
        </section>
      )}

      <div className="dialog-footer"><Icon name="lock" size={13} /><span>DEMONSTRATION ONLY · NOT A LIVE SEERBIT CHECKOUT</span></div>
    </dialog>
  );
}

function formatNaira(amount) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default function App() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <>
      <div className="announcement">
        <span className="announcement-pulse" />
        <span>PAUL UNIVERSITY AWKA</span>
        <span className="announcement-divider">✳</span>
        <span>THE END-OF-YEAR CELEBRATION</span>
      </div>

      <header className="site-header page-wrap">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#about">The night</a>
          <a href="#ticket">Ticket</a>
          <button type="button" className="nav-cta" onClick={() => setCheckoutOpen(true)}>Get your ticket <Icon name="arrow" size={14} /></button>
        </nav>
        <button type="button" className="mobile-cta" onClick={() => setCheckoutOpen(true)}>Tickets <Icon name="arrow" size={14} /></button>
      </header>

      <main>
        <section className="hero page-wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-eyebrow"><span className="eyebrow-line" /> Faculty of Law × SRC present</div>
            <h1 id="hero-title">One night.<br /><span>All of us.</span></h1>
            <p className="hero-description">The music, the moments, the faces that made the year. Decembizzy is our reason to dress up, show up, and close it out together.</p>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => setCheckoutOpen(true)}>Get your ticket <Icon name="arrow" size={16} /></button>
              <a className="scroll-link" href="#about">Get to know the night <span>↓</span></a>
            </div>
            <div className="hero-social-proof"><span className="audience-mark"><Icon name="sparkle" size={13} /></span><span>Open to everyone in Paul University.</span></div>
          </div>

          <div className="hero-art" aria-label="Decembizzy event artwork" role="img">
            <div className="art-glow" />
            <div className="art-orbit art-orbit-one" />
            <div className="art-orbit art-orbit-two" />
            <span className="art-star star-one">✳</span>
            <span className="art-star star-two">✳</span>
            <div className="art-note art-note-top">AWKA<br />NIGERIA</div>
            <div className="art-title"><span>THE YEAR-END</span><strong>DECEM<br /><i>BIZZY</i></strong><small>PAUL UNIVERSITY · AWKA</small></div>
            <div className="art-sticker"><Icon name="sparkle" size={17} /><span>GOOD<br />ENERGY<br />ONLY</span></div>
            <div className="art-note art-note-bottom">COME AS<br />YOU ARE</div>
            <div className="art-wave" />
          </div>

          <div className="hero-index"><span>01</span><i /> MADE FOR THIS MOMENT</div>
        </section>

        <section className="event-facts page-wrap" aria-label="Event information">
          <div className="fact">
            <span className="fact-icon"><Icon name="calendar" size={17} /></span>
            <span><small>THE DATE</small><strong>Details coming soon</strong></span>
          </div>
          <div className="fact">
            <span className="fact-icon"><Icon name="map" size={17} /></span>
            <span><small>THE PLACE</small><strong>Paul University, Awka</strong></span>
          </div>
          <div className="fact fact-last">
            <span className="fact-icon"><Icon name="sparkle" size={17} /></span>
            <span><small>DRESS CODE</small><strong>Jersey</strong></span>
          </div>
          <p className="facts-aside">The year isn’t over<br />until we say it is.</p>
        </section>

        <section id="ticket" className="ticket-section">
          <div className="ticket-layout page-wrap">
            <div className="ticket-intro">
              <div className="section-index">02 <span>YOUR INVITATION</span></div>
              <h2>Just one thing<br />between us<br />and the <em>dance floor.</em></h2>
              <p>One ticket. One price. All the Decembizzy you can handle.</p>
              <div className="ticket-availability"><span className="availability-dot" /> One simple ticket · no tiers, no surprises</div>
            </div>
            <article className="ticket-card">
              <div className="ticket-card-head"><span>GENERAL ADMISSION</span><span className="ticket-card-spark"><Icon name="sparkle" size={20} /></span></div>
              <div className="ticket-card-content">
                <div className="ticket-name">Your way in.</div>
                <div className="ticket-inclusions"><span><Icon name="check" size={15} /> Entry to Decembizzy</span><span><Icon name="check" size={15} /> One unforgettable night</span><span><Icon name="check" size={15} /> A place with your people</span></div>
              </div>
              <div className="ticket-price-block"><div><strong>₦4,000</strong><span>ONE TICKET · ONE FEE</span></div><button type="button" className="ticket-buy" onClick={() => setCheckoutOpen(true)}>Get ticket <Icon name="arrow" size={16} /></button></div>
              <div className="ticket-card-foot"><span>PAUL UNIVERSITY · AWKA</span><span>Presented by Faculty of Law<br />in collaboration with SRC</span></div>
            </article>
          </div>
          <div className="ticket-marquee" aria-hidden="true"><span>SEE YOU THERE</span><i>✳</i><span>SEE YOU THERE</span><i>✳</i><span>SEE YOU THERE</span><i>✳</i><span>SEE YOU THERE</span></div>
        </section>

        <section id="about" className="about-section page-wrap">
          <div className="about-label"><span className="section-index">03</span><span>THE PEOPLE BEHIND THE PARTY</span></div>
          <div className="about-body"><h2>Made by us.<br /><em>For all of us.</em></h2><p>Open to everyone in Paul University, Decembizzy is a chance for our whole university community to take a breath, raise a glass, and make one more memory together.</p></div>
          <div className="presenter-card"><div className="presenter-monogram">PU<span>✳</span></div><div><small>PRESENTED BY</small><strong>Faculty of Law</strong><span className="presenter-collaboration"><strong>in collaboration with<br />Students’ Representative Council</strong></span></div></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-wrap footer-content">
          <Brand inverse />
          <p>Presented by the Faculty of Law in collaboration with the Students’ Representative Council.</p>
          <span>PAUL UNIVERSITY · AWKA</span>
        </div>
        <div className="footer-bottom page-wrap"><span>DECEMBIZZY · A NIGHT TO REMEMBER</span><a href="#">Back to top ↑</a><span>DATE & DETAILS TO BE ANNOUNCED</span></div>
      </footer>

      <TicketDialog open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
  );
}
