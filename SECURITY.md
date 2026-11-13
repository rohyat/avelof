# Security and privacy

This is a public website with a Cloudflare Pages enquiry API and private D1 storage.
Hotel names, prices, business contacts,
and other catalog content are public and cannot be concealed in a browser bundle.
Never put passwords, API secrets, private booking records, or confidential guest
information in the source code or Vite environment variables.

## Browser protections

Production builds include a Content Security Policy that restricts scripts and
connections to the same origin, disables embedded objects and native form
submissions, and permits images only from this origin. Existing Google fonts
remain allowed through their specific stylesheet/font hosts.
Inline scripts, event handlers, inline styles, embedded frames and workers are
blocked. Modal scroll locking uses a CSS class rather than inline styling.
The page also disables referrer sharing. Cross-Origin-Opener-Policy isolates
cross-origin windows, and legacy cross-domain policy files are disabled.

Vite development and preview servers send anti-framing, MIME-sniffing, referrer,
and permissions headers. Preview also sends the production CSP. Development
does not apply the production CSP because Vite hot reload uses injected scripts.

The `public/_headers` file configures these headers on compatible static hosts
such as Netlify and Cloudflare Pages. Other hosts require equivalent configuration
on their server or CDN. Verify deployed response headers; this file is not
automatically supported by every host. CSP frame-ancestors requires an HTTP
response header and cannot be enforced by the built HTML meta tag.
Serve production over HTTPS and configure HTTPS redirects and HSTS on the host
after confirming HTTPS works for the domain and any included subdomains.

## Guest information

Submitting sends enquiry fields to the same-origin `/api/enquiries` endpoint.
The Pages Function validates field names, values, guest counts and date ranges,
caps request bodies at 64 KiB, checks the request origin, and uses parameterized
SQL. D1 stores contact details, itinerary/notes and other form fields. Success is
shown only after a persisted record is confirmed; this never confirms a booking.
Client-provided prices and calculated totals are untrusted estimates and must
not be used as authoritative quotes, invoices or payment amounts.

Customer-facing enquiry IDs are sequential references, not secrets or access
credentials. The owner explicitly chose ID/phone-only lookup to expose a fixed
booking summary: reference, service type, state, masked contacts, known selected
hotel/vehicle/package name and the relevant start/end dates. Anyone knowing an
ID or phone number can see these fields; masking is not anonymity or identity
verification, and travel details may be sensitive. This publication choice must
be reflected in the business privacy notice. The server builds a separate
`bookingDetails` projection, validates dates and matches service names against
the catalog; arbitrary selection text is never echoed into that response.
Guest counts, itinerary, notes, addresses, raw contacts and all other submitted
fields remain excluded from public lookup. Name and phone masking occurs
server-side, not by returning raw data and hiding it in the browser. ID alone
or a phone number alone must never authorize full-record access or changes.
Phone lookup exposes up to 25 related masked summaries and therefore reveals
the selected service/date fields and relationship/status metadata. Do not extend
this response to free text or other customer records without real verification.
The longer UUID is kept internally for idempotent retries. Customers can copy
their short ID or open a booking-ID-only link from the saved confirmation.
Private-code controls and full-detail views have been removed from the customer
website. Older private codes remain bearer credentials for the protected legacy
API; never print them in logs or attach them to public exports. They are derived
with server-side HMAC and stored only as SHA-256 hashes in D1.

Indian phone inputs normalize ten national digits with optional `91`/`+91`
prefixes. Search, new enquiry validation and admin usernames share the same
normalizer. Phone masking uses the national number, never the country code.
Stored historical numbers remain unchanged; lookups match national and +91 forms.

The `/api/enquiry-access` endpoint accepts ID/phone-only masked lookup and verified
ID+code full lookup through same-origin POST. Verified customer responses mask
the dedicated name/phone fields too; free-text fields may still contain personal
information and are never included in the public summary. Admin lists and
booking-status changes require a signed 30-minute session cookie.
Owner sign-in defaults to the ten national digits of the business phone as username plus a private
password. The initial generated code remains supported until replacement.
Chosen passwords use salted PBKDF2-SHA256 at 100,000 iterations. A hidden local
terminal prompt uploads only the hash and never stores the chosen password in
plaintext. Passwords shared in chat must be treated as exposed and replaced.
The public business phone cannot be used as its own password. Never store a password in frontend assets,
URLs or browser storage. Secure/HttpOnly/SameSite=Strict cookies protect HTTPS
admin sessions. Sign out clears the browser cookie; copied or stolen session
cookies remain valid until expiry or credential rotation. Avoid shared devices.
Admin access can change only the booking lifecycle, not customer fields. Status
changes use parameterized SQL with a version check to reject stale overwrites.
New enquiries display Booked (request), not a confirmation. Only an authenticated
owner can mark Confirmed, Running or Completed. Internal `received`/`booked`
values are preserved; their visible labels are Booked (request)/Confirmed. Legacy enquiry
processing status and submitted details are preserved. There are no multi-user
roles or per-user audit trail.
For multiple staff, add an identity provider/MFA and audited individual access.

Older code-bearing fragments are cleared before masked lookup; the customer
page never reads or sends the code. Historical clipboard contents, screenshots,
saved links or browser history may still retain old codes. `.dev.vars` and `.avelof-admin.local`
must remain private and git-ignored; do not expose the project directory through
a file server. Protect and back up the local access settings securely. Older
enquiries without codes expose only the same limited masked summary; their full
details remain admin-only rather than being opened by ID alone.

Database access uses the server-side `DB` binding. There is no unauthenticated
list or full-record read endpoint. Limit Cloudflare dashboard/CLI access to authorized staff with MFA,
keep preview and production databases separate, and never expose records in
frontend assets, source control, logs or public exports. The form's consent
notice covers storage, selected booking names/dates with masked contacts and contact about the enquiry, not marketing consent.
Before launch, publish an appropriate privacy notice and define who handles
data access/deletion requests, plus a retention period under applicable law.
For example, if the business adopts 90 days, schedule an authorized cleanup:

```sql
DELETE FROM enquiries WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days');
```

Retention cleanup is not automatically scheduled by this application. Also
manage exports, local test data and Cloudflare backup retention appropriately.

The endpoint limits five new enquiries per IP per ten-minute time bucket and
has a hidden bot-trap field. Short-lived IP hashes, not raw IP addresses, are
stored for this limit; expired buckets are removed on subsequent submissions.
Phone lookup, private-code lookup and admin sign-in each allow ten attempts per IP per
ten-minute bucket; masked status lookup allows 60 checks per IP per ten-minute
bucket. These application limits are not complete bot protection.
Configure Cloudflare edge rate limiting/bot protection before public launch to
reduce distributed spam and D1 quota exhaustion. JSON responses are non-cacheable.

WhatsApp is optional and opens only when the guest clicks **Need help?**. Help
links contain a generic message, plus the reference after a successful save, not
the full enquiry. WhatsApp and browser history may retain that reference and
normal network metadata. No WhatsApp message is sent automatically.

Trip dates and hotel choices are temporarily stored in sessionStorage to restore
the planner. Restores reject snapshots larger than 32 KiB, more than 31 day plans,
invalid calendar dates, expired snapshots and future timestamps; malformed data
is discarded. This is not encrypted storage and is accessible to scripts running
on this origin. Do not add contact details or payment information to this storage.
All catalog images are served as local static files through Pages rather than
queried from D1 or fetched from Unsplash at runtime. Unsplash source/license links
are retained as attribution, and the local import script contacts those sources
only when explicitly run by the operator. Google still receives font asset
requests and ordinary network metadata such as IP addresses. Self-host approved
fonts to remove those remaining third-party font requests.

For confirmed bookings, payments or multi-user staff tools, add appropriate
authorization, verification and audited access rather than exposing D1 tables.
These browser protections reduce risk; they are not a guarantee against leaks.

## Hotel registrations

Hotel details share the existing server-side D1 binding. Original phone numbers
are normalised to a unique Indian national number; phone/contact names stay
private. Status lookup requires both a hotel ID or phone and a deterministic
HMAC access code scoped separately from customer enquiry codes. It is rate
limited, same-origin and POST-only; responses are private/no-store. Access codes
are shown only on a successful matching submission receipt, never publicly or
in URL/query parameters. The browser does not persist them.

Photos live as private BLOBs in the server-side D1 database. A same-origin image
function checks approval or the signed admin session before reading each photo,
and uses image/jpeg, nosniff and no-store so rejecting a hotel prevents new public
reads. The client strips original metadata by canvas re-encoding; the server
checks JPEG framing, size and bounded dimensions. Treat all submitted text and
images as untrusted: check ownership, guest privacy and property accuracy before
approval. Do not claim independent star certification or photo verification.
The CSP allows blob image URLs only for local photo previews, not remote hosts.

Registration requires publication consent and 1-5 photos, each at most 1 MB and
1920 px in either dimension. Submission and lookup
rate limits, bounded request bodies, strict dropdown schemas and a honeypot
provide basic abuse controls, not a substitute for edge bot protection. Unique
IDs, phone constraints and content hashes handle retries and concurrent inserts.
Admin price/status edits require signed sessions, same-origin requests and
version checks. Notifications contain no private owner details.

D1 registration and photo writes use separate statements. Failed requests remove
only unreferenced photos; if a registration result is uncertain, preserve photos
rather than risk deleting saved data. Monitor logged cleanup failures and
periodically reconcile D1 photo keys against registration references. Rejection removes public access but does
not delete private data; include hotel contact details and photos in retention
procedures. No automatic retention cleanup or phone OTP service is included.

## Reviews

Review submissions are untrusted user-generated content. Anyone may submit and,
after explicit publication consent and a successful D1 write, a review is
published immediately. A booking ID or prior booking confirmation is not
required. Public responses select display name, booking ID, rating, title/text,
experience category and review/publication date. Full stored booking IDs are
displayed below names on published reviews, including existing imported entries.
The form's publication consent explicitly includes an optional booking ID.
Payload hashes, consent storage and customer enquiry records are never returned
in public review responses. Publication or displaying a booking ID is not identity or stay
verification. Warn submitters not to include contacts, addresses or payment
information. Review text is rendered as React text, never raw HTML.

The shared admin session protects review lists and version-checked PATCH/DELETE
writes. Same-origin checks, strict schema/consent validation, 12 KiB request
limits, a bot trap and three new submissions/IP/ten minutes provide basic abuse
controls. Retries with unchanged content use the same UUID. The owner can hide
or permanently delete reviews in the admin panel; deletion removes the D1 row.
These controls do not replace edge bot protection. Negative ratings are accepted.

The owner confirmed the ten existing entries are authentic guest reviews and
approved publication. Imported rows record owner-provided provenance and stable
source keys. This is an owner attestation, not independent stay verification or
evidence of direct guest-form consent. Confirm rights before future imports.
Public responses omit provenance keys but include booking references; imports
do not override later moderation decisions. Original months supplied by the
owner are stored as YYYY-MM, without invented days. True import/publication
timestamps remain separate and unchanged. Cards say Guest review, never verified
guest stays. Future sample content must remain preview-only and outside ratings.
Hidden reviews still contain personal information in D1 until permanently
deleted by the owner; include optional booking references and exports in the
business retention/deletion policy. There is no automatic review-retention
cleanup or email notification.

## Owner Mobile Push

Web Push is opt-in per owner device and requires an authenticated owner session
to register or remove a subscription. D1 stores the push-service endpoint and
encryption keys as private subscription records; expired subscriptions are
removed after the push service returns 404 or 410. VAPID private keys stay in
Cloudflare Pages secrets and the ignored local `.dev.vars` file. Never commit or
log them.

Only a newly inserted booking or review queues an alert. Retries do not create
duplicate push events. Payloads contain a booking reference or review rating,
event count/type and an internal owner-dashboard path; they never contain names,
phone numbers, booking details or review text. Push delivery is best-effort and
runs after the D1 write, so push-service failure does not invalidate a saved
booking or review. Owners can disable each device from either dashboard section.

## Trip Chat

Trip Chat builds replies in the visitor’s browser using only the public catalog
of packages, hotels, vehicles and destinations. It does not call an AI provider
or API, access D1, or save conversation history. Questions remain in page memory
until the page is closed. No AI binding or provider account is required, and no
AI usage charges are generated. Responses are catalog guidance, not live
availability, weather, road status, or a booking confirmation. The UI warns
visitors not to enter personal, payment or booking information.

## Driver registrations

Driver records and private portrait BLOBs use server-side D1.
After explicit consent and approval, the driver's full legal name, masked phone,
portrait and reviewed vehicle listing are public. Age, full phone, licence and
vehicle registration stay owner-only. A driver-scoped HMAC code plus ID or phone
is required for private POST status lookup. Admin reads/updates and pending
portrait access require the existing owner session; public portrait responses
are no-store. Unique phones, bounded single-image uploads, rate limits,
idempotent saves and versioned moderation follow hotel registration protections.
Neither identity nor licence validity is automatically verified. Confirm
identity, portrait ownership and consent before publication. Include driver
records and their D1 photos in the same retention and orphan-photo audit
procedures as hotels.

## Verification

Run `npm run build`, `npm run lint`, and `npm test`. For
the complete enquiry flow, apply local migrations and use `npm run dev:cloudflare`;
Vite preview alone has no enquiry API. Check response headers, CSP console
violations, successful saves, error/retry behavior, optional WhatsApp help and
mobile layout.