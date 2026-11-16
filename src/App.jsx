import { useEffect, useState } from "react";
import { AdminDashboard, BuyerDashboard, OrderDialog, OrderLookupButton } from "./Ticketing.jsx";
import { clearAuthToken, getAuthToken } from "./authClient.js";
import "./ticketing.css";

const FALLBACK_EVENT = {
  eventDate: "Friday, December 11, 2026",
  venue: "Nwaka Building, Paul University, Awka",
  ticketPrice: 4000,
  canAcceptTransfers: false,
  bankDetails: null,
};

function Icon({ children }) {
  return <span aria-hidden="true">{children}</span>;
}

function Brand({ inverse = false }) {
  return (
    <a className={`brand${inverse ? " brand-inverse" : ""}`} href="/" aria-label="Decembizzy home">
      <span className="brand-mark">D<span>.</span></span>
      <span className="brand-wordmark">DECEMBIZZY<span>PAUL UNIVERSITY · AWKA</span></span>
    </a>
  );
}

export default function App() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState("details");
  const [event, setEvent] = useState(FALLBACK_EVENT);
  const [customer, setCustomer] = useState(null);
  const [adminUser, setAdminUser] = useState(false);
  const [authChecking, setAuthChecking] = useState(!!getAuthToken());
  const [selectedOrderNumber, setSelectedOrderNumber] = useState("");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  useEffect(() => {
    if (window.location.pathname === "/admin") return;
    let active = true;
    fetch("/api/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load event configuration.");
        return response.json();
      })
      .then((configuration) => {
        if (active) setEvent({ ...FALLBACK_EVENT, ...configuration });
      })
      .catch((error) => {
        console.error("Could not load event configuration:", error);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const token = getAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    let active = true;
    fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Session expired.");
      if (active && result.user?.role === "customer") setCustomer(result.user);
      if (active && result.user?.role === "admin") setAdminUser(true);
    }).catch(() => {
      clearAuthToken();
    }).finally(() => {
      if (active) setAuthChecking(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("checkout") === "1") {
      setCheckoutMode(query.get("account") === "1" ? "account" : "details");
      setCheckoutOpen(true);
    }
  }, []);

  if (window.location.pathname.startsWith("/admin")) return <AdminDashboard />;

  function openCheckout(mode = "details") {
    setCheckoutMode(mode);
    setSelectedOrderNumber("");
    setCheckoutOpen(true);
  }

  function handleAuthenticated(user) {
    if (user?.role === "customer") setCustomer(user);
    if (user?.role === "admin") setAdminUser(true);
    setCheckoutOpen(false);
  }

  async function signOut() {
    const token = getAuthToken();
    try {
      if (token) await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } finally {
      clearAuthToken();
      setCustomer(null);
    }
  }

  function viewOrder(orderNumber) {
    setSelectedOrderNumber(orderNumber);
    setCheckoutMode("account");
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    setDashboardRefreshKey((key) => key + 1);
  }

  if (authChecking) return <main className="buyer-dashboard page-wrap"><p className="admin-empty" role="status">Loading your Decembizzy account…</p></main>;

  if (adminUser) return <AdminDashboard />;

  if (customer) {
    return <>
      <BuyerDashboard user={customer} event={event} refreshKey={dashboardRefreshKey} onSignOut={signOut} onNewTicket={() => openCheckout("details")} onViewOrder={viewOrder} />
      <OrderDialog open={checkoutOpen} initialMode={checkoutMode} initialOrderNumber={selectedOrderNumber} onClose={closeCheckout} onAuthenticated={handleAuthenticated} event={event} />
    </>;
  }

  return (
    <>
      <div id="top" className="announcement">
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
          <button type="button" className="nav-cta" onClick={() => openCheckout()}>Get your ticket <Icon>↗</Icon></button>
        </nav>
        <button type="button" className="mobile-cta" onClick={() => openCheckout()}>Tickets <Icon>↗</Icon></button>
      </header>

      <main>
        <section className="hero page-wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-eyebrow"><span className="eyebrow-line" /> Faculty of Law × SRC present</div>
            <h1 id="hero-title">One night.<br /><span>All of us.</span></h1>
            <p className="hero-description">The music, the moments, the faces that made the year. Decembizzy is our reason to dress up, show up, and close it out together.</p>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => openCheckout()}>Get your ticket <Icon>↗</Icon></button>
              <a className="scroll-link" href="#about">Get to know the night <span>↓</span></a>
            </div>
            <div className="hero-social-proof"><span className="audience-mark">✳</span><span>Open to everyone in Paul University.</span></div>
          </div>

          <div className="hero-art" aria-label="Decembizzy event artwork" role="img">
            <div className="art-glow" />
            <div className="art-orbit art-orbit-one" />
            <div className="art-orbit art-orbit-two" />
            <span className="art-star star-one">✳</span>
            <span className="art-star star-two">✳</span>
            <div className="art-note art-note-top">AWKA<br />NIGERIA</div>
            <div className="art-title"><span>THE YEAR-END</span><strong>DECEM<br /><i>BIZZY</i></strong><small>PAUL UNIVERSITY · AWKA</small></div>
            <div className="art-sticker"><span>✳</span><span>GOOD<br />ENERGY<br />ONLY</span></div>
            <div className="art-note art-note-bottom">COME AS<br />YOU ARE</div>
            <div className="art-wave" />
          </div>

          <div className="hero-index"><span>01</span><i /> MADE FOR THIS MOMENT</div>
        </section>

        <section className="event-facts page-wrap" aria-label="Event information">
          <div className="fact"><span className="fact-icon">◷</span><span><small>THE DATE</small><strong>{event.eventDate}</strong></span></div>
          <div className="fact"><span className="fact-icon">⌖</span><span><small>THE PLACE</small><strong>{event.venue}</strong></span></div>
          <div className="fact fact-last"><span className="fact-icon">✳</span><span><small>DRESS CODE</small><strong>Jersey</strong></span></div>
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
              <div className="ticket-card-head"><span>GENERAL ADMISSION</span><span className="ticket-card-spark">✳</span></div>
              <div className="ticket-card-content">
                <div className="ticket-name">Your way in.</div>
                <div className="ticket-inclusions"><span>✓ &nbsp;Entry to Decembizzy</span><span>✓ &nbsp;One unforgettable night</span><span>✓ &nbsp;A place with your people</span></div>
              </div>
              <div className="ticket-price-block"><div><strong>{`₦${Number(event.ticketPrice).toLocaleString("en-NG")}`}</strong><span>ONE TICKET · ONE FEE</span></div><button type="button" className="ticket-buy" onClick={() => openCheckout()}>Get ticket <Icon>↗</Icon></button></div>
              <div className="ticket-card-foot"><span>PAUL UNIVERSITY · AWKA</span><span>Presented by Faculty of Law<br />in collaboration with SRC</span></div>
            </article>
          </div>
          <div className="ticket-marquee" aria-hidden="true"><span>SEE YOU THERE</span><i>✳</i><span>SEE YOU THERE</span><i>✳</i><span>SEE YOU THERE</span><i>✳</i><span>SEE YOU THERE</span></div>
        </section>

        <section id="about" className="about-section page-wrap">
          <div className="about-label"><span className="section-index">03</span><span>THE PEOPLE BEHIND THE PARTY</span></div>
          <div className="about-body"><h2>Made by us.<br /><em>For all of us.</em></h2><p>Decembizzy is a chance for the Paul University community to take a breath, raise a glass, and make one more memory together. Admission is open to Paul University students and guests.</p></div>
          <div className="presenter-card"><div className="presenter-monogram">PU<span>✳</span></div><div><small>PRESENTED BY</small><strong>Faculty of Law</strong><span className="presenter-collaboration"><strong>in collaboration with<br />Students’ Representative Council</strong></span></div></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-wrap footer-content"><Brand inverse /><p>Presented by the Faculty of Law in collaboration with the Students’ Representative Council.</p><span>PAUL UNIVERSITY · AWKA</span></div>
        <div className="footer-bottom page-wrap"><span>DECEMBIZZY · A NIGHT TO REMEMBER</span><a href="#top">Back to top ↑</a><span>{event.eventDate.toUpperCase()} · NWAKA BUILDING</span></div>
      </footer>

      <OrderLookupButton hasToken={!!getAuthToken()} onClick={() => openCheckout("account")} />
      <OrderDialog open={checkoutOpen} initialMode={checkoutMode} onClose={closeCheckout} onAuthenticated={handleAuthenticated} event={event} />
    </>
  );
}
