# AVELOF

Premium Kashmir travel frontend built with React, TypeScript, Vite, Tailwind CSS, React Router and Lucide.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`. Run the configured linter with `npm run lint`.

## Image Storage

Catalog images are local files in `public/images/` and are delivered directly by
Cloudflare Pages. D1 stores customer enquiries, not image binaries. No R2 bucket,
image-serving database endpoint or new paid media service is required.

- `hotels/` has one named JPEG per hotel ID, such as `hotel-royal-imsar.jpg`.
- `vehicles/` has named model/reference files, such as `swift-dzire.jpg`, `ertiga.jpg` and `innova-crysta.jpg`. Traveller variants share their reference photo rather than duplicating it.
- `destinations/` contains named Aharbal/Manasbal files and the existing catalog previews as `srinagar-preview.webp`, `gulmarg-preview.webp`, `pahalgam-preview.webp`, `sonamarg-preview.webp` and `doodhpathri-preview.webp`.

The five preview names describe catalog placement, not verified photo locations.
Photography is illustrative; names do not prove a destination, property or
allocated vehicle. Preserve the source/license records in the image folders and
the vehicle/destination credit data when replacing images with approved media.

`src/data/previewPhotos.ts` centralizes preview paths and download sources.
To import missing previews locally, run `npm run sync:images`; use
`npm run sync:images -- --refresh` only to intentionally replace existing previews.
The script validates WebP downloads at 1400px/quality 75 and keeps existing files
by default. On this Windows setup, use `$env:NODE_USE_SYSTEM_CA = '1'` if needed;
never disable HTTPS certificate verification. Rebuild and deploy after changing
images. Filenames are unversioned, so no immutable browser cache is forced.

## Cloudflare Pages and D1 enquiries

### Connected live deployment

The live website is **https://avelof.in**; `www.avelof.in` redirects to the
apex domain. Both custom domains are attached to the `avelof` Pages project.
Production uses `avelof-enquiries`; preview uses the separate
`avelof-enquiries-preview` database. Every enquiry form uses the server-side
`DB` binding in `wrangler.jsonc`.

Cloudflare Workers Builds is connected to this GitHub repository and deploys
commits pushed to `main`. Its build command is `npm run build`; its deploy
command is `npx wrangler pages deploy dist --project-name avelof --branch main`.
Commit and push source changes first, then confirm the Cloudflare build reports
deployment success before checking the live domains.

For a manual operator deployment, sign in with Wrangler and run from the project
root:

```powershell
npm run build
npm run deploy
```

`npm run deploy` deploys the built `dist` assets and the root `functions/`
directory to the existing `avelof` Pages project on the production branch. It
does not build first or apply database migrations automatically. Prefer the
GitHub commit/build flow for normal releases. Apply pending production/preview
migrations before publishing API changes.

If a Cloudflare build log shows `Executing user deploy command: npx wrangler
deploy`, the pipeline is using the Workers deployment command against this Pages
project. Change that pipeline's deploy command to `npm run deploy`, keeping the
build command `npm run build` and repository root directory. The credential used
by that pipeline must have access to the existing Pages project; a Workers-only
deployment token may not. Do not paste credentials into chat or source control.

This pipeline runs under Workers Builds but deploys to Pages with the Pages
command above. Do not replace it with `wrangler deploy --assets=dist`: static-only
Workers assets would omit the Pages Functions handling enquiries, reviews and
admin access. `/admin/panel` and its APIs must stay together.

On this Windows machine, a certificate trust issue required
`$env:NODE_USE_SYSTEM_CA = '1'` in the terminal before Wrangler network commands.
This uses trusted system certificates; do not disable TLS verification.

View live records in **Cloudflare dashboard > D1 > avelof-enquiries > Console**,
or use `npx wrangler d1 execute DB --remote --command "SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 100"`.
`--local` reads only this computer's development database, not the live records.
Historical localhost data is not automatically uploaded to Cloudflare. Changing
a database ID also selects a different local database; historical local files
remain under `.wrangler/`. Never publish those files or migrate customer data
between environments without an explicit business decision.

Enquiries now save through `POST /api/enquiries`, a Cloudflare Pages Function.
WhatsApp is only an optional **Need help?** link. A successful response means
the enquiry was stored, not that availability or a booking was confirmed.

The `enquiries` table stores a unique reference, enquiry type, contact
details, guest counts, status and creation time. `fields_json` preserves all
type-specific dates, hotel/meal choices, vehicle preferences and planner data.
The `details` TEXT column holds the editable custom-trip summary or additional
notes. Planner enquiries prefill this text box with the complete itinerary,
stays, meals, vehicle and estimate details. Quotes and rates are customer-supplied
snapshots, not authoritative prices. No payment information should be collected.

`public_reference` is the short customer-facing ID, for example
`AVELOF_DLX_10001`, `AVELOF_PRM_10002` or `AVELOF_CSTM_10003`. Prefixes are DLX
(Deluxe package), PRM (Premium package), CSTM (custom package), HTL (hotel), CAB
(car) and INQ (general enquiry). One database-wide sequence starts at 10001;
numbers do not reset per prefix or reuse deleted numbers. The
`enquiry_reference_numbers` table allocates these numbers. The original UUID
`reference` remains a private retry key, not the ID displayed to customers.
Retries retain their public ID. Customers can copy the ID from the success popup.
Apply migration `0002_short_enquiry_references.sql` to existing environments;
it also assigns short IDs to existing records without changing their details.

### Booking status and owner dashboard

- Customers use `/my-enquiries` with their booking ID or ten-digit Indian phone number, without a password, SMS or access code. Optional `91` and `+91` prefixes remain accepted. Phone search returns up to 25 recent requests with service type, status, reference, masked contacts, and a fixed `bookingDetails` block: known catalog selection, start/end labels and dates. Hotels show the selected stay and check-in/check-out; cabs show the selected vehicle and start/end; packages show their name and travel dates; customized packages are labelled explicitly. Unknown historical selections show selection pending, and missing dates show Not provided. The owner explicitly chose to make these selected fields visible to anyone knowing the ID or phone number. Notes, itineraries, addresses, guest counts and all other submitted fields are excluded. Phone masking strips the country code. Partial suffixes and non-Indian numbers are rejected.
- The customer page and saved-confirmation popup have no Private submitted details section, private access-code field or private-link copy control. The popup retains the booking-ID copy button and a plain View your bookings link. New forms default to a ten-digit phone number and accept optional country prefixes. Complete records remain available in the protected owner dashboard.
- Booking links carry only the enquiry reference in a fragment, which is cleared before lookup. Older code-bearing links also open only masked summaries in the website; their code is not read or submitted. The legacy ID+code API remains protected for backward compatibility, but the customer website no longer uses it or displays issued codes.
- `/admin/panel` is the separate owner sign-in URL, currently live at `https://avelof.pages.dev/admin/panel`. Reviews are at `/admin/panel/reviews`. The legacy `/my-enquiries/admin` and `/my-enquiries/admin/reviews` paths redirect to these canonical routes. The requested `https://www.avelof.in/admin/panel` requires separately connecting that domain to this deployment; no DNS or domain changes were authorized in this update. No customer-facing navigation links to admin routes; authentication remains mandatory. The default username is the ten national business-phone digits from `src/config.ts`; prefixed forms remain accepted. Existing passwords, sessions, full records and status editing are unchanged.
- `/admin/panel` is the separate owner sign-in URL, live at `https://avelof.in/admin/panel`. Reviews are at `/admin/panel/reviews`. The legacy `/my-enquiries/admin` and `/my-enquiries/admin/reviews` paths redirect to these canonical routes. No customer-facing navigation links to admin routes; authentication remains mandatory. The default username is the ten national business-phone digits from `src/config.ts`; prefixed forms remain accepted. Owner deletion requires confirmation and a current version; deleting an enquiry removes its stored row and cascades its reference-number link. Sequence numbers are never reused.
- Admin sessions use signed HttpOnly, SameSite=Strict cookies, Secure on HTTPS, and expire after 30 minutes. Use Sign out on shared devices. Changing the server-side admin-code hash invalidates existing sessions.
- Expanded admin records include the same Requested booking details summary and the complete accepted submitted fields underneath, including guest counts, meals, vehicle choice, estimates, custom notes and itinerary. `fields_json` is the authoritative saved snapshot; `details` retains the notes text. Public lookup uses a separate strict projection; it never receives the raw full-record field object. Public service names are matched against the catalog so arbitrary text cannot be echoed through selection fields.
- Older enquiries also have a masked status summary. Their full details remain owner-only if no private code was issued. Staff must verify the customer through an established channel before sharing details.

Migration `0004_booking_status.sql` adds the booking lifecycle, a version counter
and update timestamp without replacing the enquiry table or changing its legacy
`status` processing field. The initial visible label is Booked (request), followed
by Confirmed, Running and Completed. The stored values remain `received`,
`booked`, `running`, `completed` for compatibility. Request submission never
confirms availability; only an authorized owner marks Confirmed. Stale writes fail
with 409 rather than silently overwriting a newer change. Customer summaries
refresh every two minutes while the page is visible and also have a refresh
button; there is no realtime push service. ID lookup allows 60 checks per IP per
ten minutes; phone lookup, private-code lookup and owner sign-in each use
separate ten-attempt limits. Migration `0005_phone_lookup.sql` indexes normalized
phone numbers without changing original submitted fields. There is no unrestricted
public listing or unverified full-record lookup.

Credential setup (run locally; credentials must never be pasted into chat):

```powershell
npm run setup:access
$env:NODE_USE_SYSTEM_CA = '1'
npm run setup:access -- --cloudflare
```

The script creates `.avelof-admin.local` containing the private owner code and
`.dev.vars` containing the server access secret and admin-code hash. Both are
git-ignored and are not deployed as static assets. Open the owner-code file only
on your computer, store the code in a password manager, and protect the local
files. Never commit or share them. Re-running setup reuses the same credentials;
it does not silently rotate existing settings. Keep the access secret backed up
so retries can recover the same private customer code. Cloudflare Pages receives
secrets through Wrangler stdin, not command-line arguments or Vite variables.

Apply migration `0003_enquiry_access.sql` in production and preview before
deploying. Restart local Pages development after creating `.dev.vars`. Verify
real owner authorization without printing credentials or customer details with:

```powershell
npm run setup:access -- --verify http://localhost:8792
npm run setup:access -- --verify https://avelof.pages.dev
```

Add `--verify-status` to either verification command to create a synthetic test
enquiry and check phone search and Confirmed -> Running -> Completed readback.
The command prints the synthetic ID for cleanup, never credentials or real
customer details. Delete only that test record afterward; do not reset numbering.

To replace the original admin code with a chosen password, use a local interactive
terminal. Never put passwords in chat or command arguments. Choose a new
14-to-128-character password or passphrase, not one previously shared:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npm run setup:admin-password -- --cloudflare
```

The command asks for the password twice with hidden input. It uploads only a
salted PBKDF2-SHA256 hash through stdin, preserves the customer access secret,
updates the ignored local hash, redeploys, and verifies live sign-in without
printing the password. It does not store the chosen password in plaintext.
The old code and old sessions stop working once the new hash is deployed.
After choosing a password, `setup:access` reuses that hash rather than overwriting
it. Its legacy-code `--verify` mode is disabled; the hidden password command or
direct owner sign-in verifies a chosen password. Restart local Pages development
to load changed local settings. Without `--cloudflare`, only local settings change.

The read API rate-limits customer lookups and owner sign-in separately. There is
no SMS service, customer account system, customer-field editing or automatic enquiry
notification. The owner dashboard does not display private customer access codes.

### One-time production setup

1. Use Node.js 24 or newer. Run `npm install` and sign in locally using `npx wrangler login`.
2. Run `npx wrangler d1 create avelof-enquiries` and `npx wrangler d1 create avelof-enquiries-preview`.
3. If recreating or moving this deployment, set the two `database_id` values in `wrangler.jsonc` to the returned IDs. Set `name` to your Pages project name. Database IDs are not credentials; never add API tokens to the repository or Vite environment variables.
4. Run `npm run db:migrate` for production and `npx wrangler d1 migrations apply DB --remote --env preview` for preview. These commands create the tables in the respective databases.
5. Build with `npm run build` and deploy with `npx wrangler pages deploy dist --project-name avelof --branch main --commit-dirty=true`. The root `functions` directory must be deployed alongside the build; uploading only `dist` in the dashboard does not deploy this API. A separately created Git-integrated Pages project can instead use build command `npm run build`, output directory `dist`, and the repository root as its root directory.
6. Submit a test enquiry on preview. Check its reference in the preview D1 console, then test production. The application cannot store enquiries until the D1 binding and migrations are configured.

To inspect enquiries, open **Cloudflare dashboard > Workers & Pages > D1 >
avelof-enquiries > Console** (dashboard labels may vary), or use:

```sql
SELECT public_reference, created_at, kind, full_name, phone_number, booking_status, booking_status_updated_at, details, fields_json
FROM enquiries ORDER BY created_at DESC LIMIT 100;
```

Keep Cloudflare access limited to authorized business staff with MFA. Customer
full-record reads require a private code; admin reads and status updates require a signed session. Establish a
retention period and remove old customer records and exports; see `SECURITY.md`.
The website does not send email or notify staff automatically. Check D1 regularly.

### Local database testing

```bash
npm run build
npm run db:migrate:local
npm run dev:cloudflare
```

Open `http://localhost:8791`. This uses a local D1 database under `.wrangler/`,
not your live database. `npm run dev` alone runs the UI only and cannot save
enquiries. After frontend changes, rebuild and restart the Cloudflare dev server.
Run `npm test` for endpoint/SQLite regression tests and `npm run lint` for lint.

The endpoint limits submissions to five new enquiries per IP per ten-minute
bucket, rejects cross-origin requests, validates fields and caps request size.
Use Cloudflare edge rate limiting/bot protections as well before public launch:
application limits alone cannot prevent distributed spam or quota exhaustion.
See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) for
current free limits; Pages Functions also consume Workers usage allowances.

## Frontend architecture

## Database Reviews

Anyone can submit a review at `/reviews`; no booking ID or prior booking
confirmation is required. `POST /api/reviews` saves display name, experience
category, 1-5 rating, optional title, review text and publication consent to D1.
After consent and a successful save, a guest review is published immediately and
the public feed refreshes. Failed attempts retain the form; unchanged retries
reuse the submission UUID rather than creating duplicate reviews. Publication
does not verify a guest's identity or stay.

Sign in at `/admin/panel`, then open the Reviews section, or visit
`/admin/panel/reviews` with an active owner session. The owner can hide or restore
reviews and permanently delete them. Changes require the existing signed admin
cookie and version checks. Review consent permits publishing the display name and
review, not the optional booking ID. Remove reviews containing private details.

The public feed and average rating include only published database reviews.
Published cards are labelled Guest review, not independently verified stays.
The owner confirmed the ten existing entries are genuine guest reviews and
approved their import and publication. They now use the same D1 feed as other
published reviews; the separate preview display is removed. Negative and mixed
reviews use the same validation rules.

### Owner-Approved Existing Reviews

`ownerProvidedGuestReviews` and `ownerGuestReviewMonths` in `src/data/catalog.ts`
are the approved import source, not a second frontend review feed. Original
names, ratings, titles, texts, package labels and private booking references are
preserved. Migration `0007_review_sources.sql` adds owner-provided provenance
and stable unique source keys. This records the owner's attestation and approval,
not independent stay verification or evidence of a direct guest-form submission.

The owner supplied these original review months in source order: first two
January 2025, next four March 2025, next two June 2025, last two December 2025.
Migration `0008_review_months.sql` stores `review_month` as `YYYY-MM`, separately
from true import/publication timestamps. Cards display Reviewed January 2025,
etc., with no invented day. New reviews without an original month display their
publication date. Public review order is newest month first.

After applying migrations, prepare and import only with owner approval:

```powershell
npm run import:reviews -- --owner-approved
npx wrangler d1 execute DB --local --file .wrangler/tmp/owner-guest-reviews.sql --yes
npx wrangler d1 execute DB --remote --file .wrangler/tmp/owner-guest-reviews.sql --yes
npx wrangler d1 execute DB --remote --env preview --file .wrangler/tmp/owner-guest-reviews.sql --yes
```

The generated SQL is private/git-ignored and contains booking references. Stable
UUID/source keys prevent duplicate rows. Reruns do not edit or republish existing
rows, including reviews later hidden through moderation. Remove temporary SQL
after importing. Establish publication rights before approving more source
reviews. If consent is withdrawn, hide/remove the database row and remove it
from the approved source before importing again. `npm run import:reviews --
--check-client` verifies that private source references are not in built assets.

Apply migrations `0006_reviews.sql` through `0009_review_deletion_tombstones.sql`
in local, production and preview databases before deployment. Migration 0009
records source-key tombstones when an owner-provided review is deleted, so a
future import cannot restore it. The API caps bodies at 12 KiB, uses strict field/consent
validation, same-origin writes, a bot trap and a separate limit of three new
reviews/IP/ten minutes. Configure Cloudflare edge protection for distributed spam.
Both public and private lists paginate at 25 items and are non-cacheable.

Operator verification uses only synthetic data and never prints credentials:

```powershell
npm run setup:access -- --verify-reviews http://localhost:8792
npm run setup:access -- --verify-reviews https://avelof.pages.dev
```

This verifies Published -> Hidden using a local operator-signed session, so it
also works after a chosen password is configured. It does not
change or read that password. Use `--review-id <printed-test-id>` to retry the
same synthetic test after an interruption. Remove only the printed test UUID
after verification. Published synthetic content is explicitly marked as a test.

### Small-Screen Review Cards

At 900px and below, guest review cards use a horizontal scroll-snap carousel
with the existing responsive card widths, padding and typography. Reviews
advance one at a time every second and loop. Offer-style dots select a position.
Touch, dot selection or keyboard interaction stops autoplay; there is no
pause/play button. Mouse hover pauses temporarily, hidden tabs do not advance,
and reduced-motion preferences disable autoplay.
Desktop reviews keep their existing grid. The Write a review invitation appears
above Guest reviews and still links to the submission form below.

Run `npm run test:reviews-ui` against the local app (default localhost:8792),
or set `AVELOF_REVIEW_TEST_URL` to another local UI server. The focused Node/
Playwright checks use the installed Edge browser on Windows and mock the review
feed, so no database records or credentials are changed. They cover card sizing,
tablet CTA alignment, invitation order, autoplay timing, manual stop, touch,
keyboard and reduced motion.
Screenshots are saved under the ignored `.wrangler/tmp/review-carousel-checks/`.

## Destination guide and visit planner

The `/destinations` page contains searchable place guides and a visit wishlist form. Search includes attraction names and alternative spellings. The driving-time filter uses the upper end of each approximate one-way time range. Homepage destination links open the guide with that place searched.

Edit the `destinations` array in `src/data/catalog.ts` to add or update places. Each entry has a stable `id`, `name`, search `aliases`, `distance`, `travelTime`, `maxDriveHours` (the upper one-way estimate for filtering), `suggestedVisit`, `season`, `accessNote`, and an `attractions` array of names and descriptions. `image`, `detail`, and `count` also appear in existing homepage sections. Keep the first four entries as Srinagar, Gulmarg, Pahalgam and Sonamarg for the current homepage layout.

Distances are draft planning estimates from central Srinagar, not live navigation or inter-destination distances. Verify distances, times, attractions, seasonal access and permission rules with local operators before publishing. Nearby excursions, sightseeing and return travel are not included. Images remain illustrative preview photography.

The supplied spellings USMRG, Peer Ki Gai and Herbal Waterfall are provisionally interpreted as Yusmarg, Peer Ki Gali and Aharbal Waterfall. Confirm these intended locations with the business owner. Their supplied spellings remain searchable aliases.

Guests can select places independently of search filters, enter travel dates and trip length, and submit a custom-package enquiry. Selected destinations and Srinagar distance/time estimates are saved with the enquiry. The selection is an in-page wishlist, not an optimized itinerary, confirmed booking or saved account plan.

## Modules

- `src/data/catalog.ts` contains the editable preview package, car, hotel, destination and review data.
- `src/types.ts` defines the catalog and request models.
- `src/services/bookingService.ts` formats enquiry details and submits to the same-origin API.
- `src/services/enquirySchema.ts` validates enquiry fields server-side.
- `functions/api/enquiries.ts` stores enquiries in D1; `migrations/` owns the schema.
- `src/config.ts` centralizes AVELOF contact details.
- `src/pages/Pages.tsx` contains routed page experiences; shared navigation and booking UI live in `src/components/`.

The shared enquiry form collects name, phone, package preference, adult/child counts, travel group, car preference and optional instructions, plus the relevant stay or travel dates. Catalog enquiry buttons preserve the selected package, car or hotel. An Enquire Now button is available on every route. No payment flow is provided.

Submitting validates the form and saves it to D1. Failed or timed-out requests retain the entered fields for retry; retries with unchanged details reuse the same unique reference to avoid duplicates. A saved confirmation appears only after the backend confirms storage.

Email notifications are not included. The owner dashboard provides authenticated full-record access and booking-status updates. Customer ID/phone lookup returns only limited masked summaries; the customer website has no private-code or full-detail controls. Provider credentials remain server-side. The database is accessed through a server-side binding, never directly from the browser.

Catalog photography remains illustrative. Owner-approved guest reviews and published website submissions are displayed from D1 without an independently verified claim. Any future sample content must remain preview-only and outside live ratings. Images are served locally through Pages with source/license records retained; replace illustrative photography with approved images before presenting it as actual destinations, hotels or allocated vehicles.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
#   a v e l o f 
 
 