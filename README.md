# Decembizzy ticketing

The established public event landing page is unchanged. The application uses a React/Vite frontend, Vercel serverless API routes, and MongoDB Atlas for attendee accounts, sessions, orders, receipt files, tickets, reviews, and check-ins.

## Accounts and access

- Attendees register with an email address and password, then can sign in immediately. No inbox confirmation or email delivery is part of authentication.
- Passwords are hashed with Node.js `scrypt`; passwords are never stored in plain text. Opaque random session tokens are stored as HMAC hashes and expire after 30 days.
- The `/admin` page has separate admin sign-in and first-time setup. Creating an admin account requires the private `ADMIN_SECRET` setup key. Create the three organizer accounts, then remove `ADMIN_SECRET` from the deployment environment; existing admin accounts can continue signing in.
- Admin actions check the account's stored `admin` role on the server. An attendee account cannot review payments or check in tickets.
- Email and password recovery is not available yet. Since accounts are not email-verified, users must use a valid email address they control and keep their password safe.

## Data model

Each `orders` document embeds its bounded ticket array, review history, and check-in audit entries so those records can be read and updated atomically. The document includes buyer account ID/email, quantity, the fixed ₦4,000 unit price and total in kobo, status, receipt metadata, and timestamps.

Receipt binaries are stored in MongoDB GridFS in the `receipts` bucket. Admin receipt links are signed and expire after five minutes. The `users` collection stores password hashes and roles; `sessions` stores expiring hashed tokens; `rateLimits` stores HMAC-keyed counters with TTL expiry.

The app creates the following indexes on its first database connection:

- unique order number and ticket code
- buyer account and order creation date
- order status and creation date
- unique user email
- session and rate-limit expiry
- session user ID

Approval atomically updates an order, appends the reviewer audit entry, and issues one unique ticket code per admission. Check-in atomically changes only a valid ticket, preventing a second scan from admitting it again. Ticket arrays are limited to five per order.

## Payment and ticket flow

1. A buyer creates an account or signs in with email and password.
2. They create an order for up to five tickets. The server uses the signed-in account email and enforces the fixed ₦4,000 ticket price.
3. They transfer the exact amount to the event account and upload a JPG, PNG, WebP, or PDF receipt (maximum 3 MB).
4. An organizer reviews the receipt against the bank statement. Approval issues one named digital paper ticket and unique QR/ticket ID per admission. Rejected orders can submit a corrected receipt.
5. At the door, an authorized organizer enters the QR value in the check-in tool; the ticket is marked used once.

The default transfer details are **Fidelity Bank**, account number **6982652382**, account name **Ogbaekwe Chineye Precious**. These can be overridden with the `BANK_NAME`, `BANK_ACCOUNT_NAME`, and `BANK_ACCOUNT_NUMBER` environment variables.

Buyers see order history and approved tickets in **My tickets** on any signed-in device. They can download the digital paper ticket as a PDF. Emailing tickets is not implemented yet.

## Environment and deployment

The local API loads the ignored `.env.origin` file when present. Its existing variable spellings are supported:

- `MONGODB_URL` or `MONGODB_URI` — MongoDB Atlas connection string; `MONGODB_URI` is preferred
- `JWT_SECERT` or `JWT_SECRET` — session-token HMAC key; `JWT_SECRET` is preferred
- `ADMIN_SECERT` or `ADMIN_SECRET` — temporary admin-account setup key; `ADMIN_SECRET` is preferred

For Vercel, add the same settings as server-side environment variables in the project dashboard. `.env.origin` is ignored by Git and is not deployed; never put these values in `VITE_*` variables or commit them. Optional server settings:

- `MONGODB_DB` — database name; defaults to the database in the connection URL, or `decembizzy` if none is specified
- `RATE_LIMIT_SECRET` — separate HMAC key for rate-limit identifiers; defaults to the session-token HMAC key
- `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` — optional transfer detail overrides

In MongoDB Atlas, restrict network access to the environments that need it and create a database user with only the required read/write access. The server reuses one MongoDB client per warm Vercel function instance with a five-connection pool, no idle minimum, and a 30-second idle timeout. Monitor Atlas connections and function concurrency during ticket sales; tune the pool if measurements show queuing or connection pressure.

To launch:

1. Configure the MongoDB and application secrets above in the local `.env.origin` and Vercel environment settings.
2. Deploy and verify attendee sign-up/sign-in, order creation, receipt upload and admin review, named ticket PDF download, and duplicate check-in.
3. Create the three organizer accounts at `/admin` using the private admin setup key. Remove `ADMIN_SECRET` from Vercel after setup and redeploy.

No live orders need migrating from the previous database. Old external-auth accounts are not imported; attendees and organizers must create accounts in the new system.

`npm run build` validates the frontend. `npm run dev` starts Vite with local middleware for the project's API routes. `npm run dev:vercel` is an alternative when the Vercel CLI is available and permitted to create its local cache links.
