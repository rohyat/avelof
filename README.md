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
Cloudflare Pages. Customer-submitted hotel and driver photos are private JPEG
BLOBs in D1 and are served only through approval-aware Functions endpoints. No
R2 bucket or new paid media service is required.

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

### Free trip chat

Trip Chat is a browser-only guide built from the public package, hotel, vehicle
and destination catalog. It does not call an AI provider, require an AI binding,
send chat messages to a server, or save conversation history. It can share
published service details and route guidance, but cannot check live availability
or confirm bookings. Rates and travel conditions should be confirmed with AVELOF.

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
notes. Planner enquiries save the complete itinerary, stays, meals, vehicle and
estimate details automatically, without asking the customer to re-enter them.
Quotes and rates are customer-supplied
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
- `/admin/panel` is the separate owner sign-in URL, live at `https://avelof.in/admin/panel`. Reviews are at `/admin/panel/reviews`. The legacy `/my-enquiries/admin` and `/my-enquiries/admin/reviews` paths redirect to these canonical routes. No customer-facing navigation links to admin routes; authentication remains mandatory. The default username is the ten national business-phone digits from `src/config.ts`; prefixed forms remain accepted. Owner deletion requires confirmation and a current version; deleting an enquiry removes its stored row and cascades its reference-number link. Sequence numbers are never reused.
- Admin sessions use signed HttpOnly, SameSite=Strict cookies, Secure on HTTPS, and expire after 30 minutes. Use Sign out on shared devices. Changing the server-side admin-code hash invalidates existing sessions. Owner mobile alerts are opt-in per installed device; sign in on the phone and choose Enable on this device. iPhone/iPad requires Add to Home Screen first. Alerts contain only a booking reference or review rating/count, never customer phone numbers. Disable each device from either owner section.
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
button; booking status changes do not use realtime push. ID lookup allows 60 checks per IP per
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

Generate and upload VAPID keys for owner mobile push using the local setup
command; keys are stored in ignored `.dev.vars` and uploaded as Pages secrets:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npm run setup:push-notifications -- --cloudflare
```

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

## Hotel Registration

`/register-hotel` accepts one property per normalised Indian phone number, with
1-5 required photos, a curated location dropdown, AVELOF category (Deluxe: 2-star,
Premium: 3-star, Luxury: 4-5-star), heating, amenities, check-in/out times, room
counts for Standard, Deluxe, Premium, Family and Suite types, and selectable
public highlight points. Each room type starts at one; set unoffered types to
zero. The total room count is calculated from the selected quantities. Hotel
descriptions are generated from the chosen category and location.
These categories are not official star certifications.

New registrations quote INR per room per night for two adults, room only.
The room-only price defaults to INR 2,000. Breakfast and dinner are optional add-ons for both adults, initially INR 500
each and editable with plus/minus buttons or direct numeric entry. Taxes are
stated separately. The same D1 binding as enquiries stores hotel details; R2 stores
private JPEG photos. The browser resizes JPEG/PNG/WebP uploads (up to 5 MB each)
to 1920 px and at most 1 MB per photo, removing original metadata. JPEG encoding
starts at 92% quality, reducing only as needed to fit the size limit. At most
5 MB of photo data is stored per hotel. The server enforces
JPEG format, dimensions, count and a bounded multipart body.

Only a successful database write returns a hotel ID and private access code.
Unchanged retries reuse the ID and do not duplicate rows or alerts.
`/hotel-status` requires that code plus the hotel ID or registered phone; codes
are sent in a POST body and are never stored in URLs or browser storage.
Phone numbers and contact names are not exposed in public hotel responses.

Hotels and drivers can edit their own registrations after private status lookup
with their registration ID (or phone) and access code. The authenticated lookup
returns editable details, including private contact/licence fields and a version;
public responses still exclude those private fields. Credentials remain in request
bodies and page memory, never URLs or browser storage.

Choose Edit hotel details or Edit registration, update the prefilled form, renew
publication consent and Save changes for approval. Hotel updates use
`POST /api/hotel-update`; driver updates use multipart `POST /api/drivers` with an
`auth` part. Saving forces pending status and immediately hides the listing and its
photos from public access until the owner reviews and approves it again. It keeps
registration IDs and linked reviews, and queues the existing owner alert.
Existing photos are retained unless replacements are supplied (a hotel selection
replaces the full set; a driver replacement replaces the portrait). Version checks
prevent overwriting newer moderation or partner changes. Updated name/phone details
can change the access code; save the code shown in the successful receipt.
No database migration is needed. Older hotel room labels and meal pricing remain
editable without inventing per-room rates.

`/admin/panel/hotels` uses the existing signed owner session. Review photos and
rights, edit the rate, approve, reject or return to pending, and add an owner
note. Version checks prevent overwriting another edit. Only approved rows and
their photos appear publicly. Approved registrations populate the hotel catalog,
detail pages, enquiry selector and planner; there are no built-in sample stays.
New registered rates expose optional meals in hotel cards, details, enquiries
and the planner, with no invented discount comparison. Older registrations
retain their original fixed meal plan.
New submissions queue the existing generic owner push notification once; enable
owner notifications in the dashboard and configure VAPID as described below.

Before deployment, enable R2 and create the private buckets and D1 table:

```powershell
npx wrangler r2 bucket create avelof-hotel-photos
npx wrangler r2 bucket create avelof-hotel-photos-preview
npm run db:migrate:local
npm run db:migrate
npx wrangler d1 migrations apply DB --remote --env preview
```

`wrangler.jsonc` binds production and preview buckets separately as
`HOTEL_PHOTOS`. Do not enable public bucket access. `ENQUIRY_ACCESS_SECRET` and
the existing admin secrets must be configured in both environments. Local
Wrangler development uses local R2 storage. Run `npm test` for API coverage and
`npm run test:hotels-ui` against a local server on port 8792 (or set
`AVELOF_HOTEL_TEST_URL`). Tests use synthetic data and never submit to production.
The Vite-only `npm run dev` server does not run Pages Functions and cannot save
partner registrations. Use `npm run build` followed by `npm run dev:cloudflare`
and open the Wrangler Pages preview URL to test registration locally.

Failed uploads are cleaned up without deleting database-referenced images.
D1 and R2 are not one transaction: crashes can leave unreferenced objects.
Audit object keys against `photo_keys_json` before deleting orphaned uploads.
Rejected properties and photos remain private until administratively removed;
include these records in retention/deletion procedures. A lost access code
requires contacting AVELOF; do not expose lookup by phone alone.

## Partner portal and drivers

The built-in illustrative hotel catalog has been removed. Hotel listings,
detail pages, enquiry selectors and planner hotel options use approved
registrations only. An empty approved feed shows an explicit empty state;
the planner can still request a recommended stay. No sample hotel rates or
discount offers are used. Existing D1 registrations, photos, reviews and enquiry
records are unchanged. Tour-package itineraries are separate from hotel listings
and retain their existing content.

Hotel listing cards use a compact, content-sized portrait layout,
with a photo, rating, two highlights, three amenities and the minimum room
rate. Full descriptions, hotel IDs and all features remain on the detail page.
Hotel detail pricing shows the lowest-priced room name and starting rate without
selection controls. Clicking Book Now opens the enquiry form for room and meal
selection. Cards can grow when text needs additional space.
Hotel tiles keep Explore Now above Book Now on all screen sizes. The detail
page places the hotel ID, room count and guest ratings directly below the photos,
before the stay description. Pricing uses the room name and INR amount without
"From"; detail pricing panels offer Book Now without an email action.
Small room-type labels on hotel tiles show available categories without extra prices.
Hotel tiles give more space to photography, overlay the location on the photo,
and omit the visible photo-source caption to keep the details section compact.
Hotel price filters use the minimum room rate, with INR 1,000 bands from
1,500–2,500 through 9,500–10,500 and a final Above 10,500 option.
Shared boundaries belong to the higher band (2,500 starts the second band);
10,500 is included in the final bounded band. Any price also includes stays below
1,500. Unknown or old price-filter URLs fall back to Any price.
Approved registered hotels remain selectable in customised trips only; they do not
replace curated package stays or change published package prices. The custom planner
shows a combined vehicle and selected-stay estimate, updated for each night's room
and meals. Adults and children aged 5 years and above are entered alongside dates
in the first step; entered children count toward room capacity and vehicle seats.
The guest fields explain that children below 5 years are complimentary. The planner suggests
the smallest suitable vehicle (lowest daily rate when capacities match), allows
larger choices, and blocks vehicles that do not fit. Groups beyond a single listed
vehicle's capacity must contact AVELOF for a multiple-vehicle quote.
Room quantities default to the guest total divided by four for Family rooms or
two for other types, rounded up. Customers can increase/decrease quantities with
steppers but cannot go below this minimum. Room-type or guest-count changes reset
quantities to the appropriate minimum. Selected room quantities and per-room meal
charges are multiplied into nightly/stay totals in both hotel enquiries and planners.
Unselected nights and extras are explicitly excluded. The estimate accompanies the
enquiry for owner review and is not a final quote or booking confirmation.
The planner shows dates/places, vehicle and hotels as separate steps with Back/Next
navigation that retains selections. Hotel cards rotate their submitted photos and
completed steps show ticks, with Back directly below the step indicator.
Srinagar-based day trips require the previous night's stay in Srinagar; the planner
does not offer Gulmarg or Pahalgam overnights immediately before these excursions.
Gulmarg-to-Pahalgam transfers remain available. Wider hotel cards
only expand room and meal controls for the selected stay. Planner tiles keep the
hotel category but omit amenities and highlights; View hotel shows the full details.
The final planner step is inline, not a popup, and asks only for name and phone.
It preserves the previously selected adults/children and all itinerary details,
with success shown inline only after D1 confirms persistence. Hotel enquiries store
`roomCount`, `hotelNightlyTotal` and `hotelStayEstimate` alongside the per-room rate;
planner itineraries include room quantities and all-room nightly totals for each stay.
The API still accepts legacy total-only `numberOfPeople` planner enquiries.

Admin review moderation separates Guest reviews (without a linked partner),
Driver reviews and Hotel reviews. Driver and hotel sections offer dropdowns for
all registered partners, including pending and rejected registrations. Category,
partner and status filters apply before pagination and are retained after
publishing, hiding, returning to pending or deleting a review.

New hotel registrations collect a room count and a room-only INR rate for each
offered type (Standard, Deluxe, Premium, Family and Suite). The registration and
private edit pricing section explains that entered room prices are shown directly
to customers once approved. AVELOF deducts 10% commission from that price rather
than adding it on top, and the hotel receives 90%, with a boxed table of INR 2,000,
INR 3,000 and INR 5,000 examples showing the customer price, hotel share and commission. This is
informational guidance; it does not change stored rates or customer estimates.
A zero count excludes
that type. Family room-only rates cover four people; other room rates cover two.
Breakfast and dinner are entered as shared base add-ons for two people. For a
selected Family room, each optional meal costs 1.5 times its base charge, rounded
to the nearest paise, and covers all four people. This rule is applied consistently
to listings, enquiries and planner estimates; the Family room-only rate is not
multiplied. Existing legacy meal-inclusive rates stay unchanged when no structured
room type is available.
Structured `roomRates` are stored in the existing private details JSON; no database
migration is needed. The API validates unique types, positive rates and counts,
matching totals and a listing price equal to the lowest available room rate.
Owners review each room rate separately; hotel cards show only the minimum,
while detail pages list all available room types without individual price labels.
Facilities and highlights use matching prominent icon cards, followed by room types.
The enquiry rate selector defaults to the lowest-priced room and shows the chosen room's
price separately; dropdown options contain room names only. Enquiry forms
and selected planner stays let customers choose a room type and calculate its
rate plus meals. The enquiry stores `roomType` and the selected `nightlyRate`;
planner itineraries include both. These are enquiry estimates, not availability
or booking confirmations. Older registrations without room
rates retain their existing pricing; no individual rates are invented for them.
Amenities and highlights use labelled icons on registration and public listings.

Hotel and driver registration share a responsive partner layout with a review
guide, privacy guidance and numbered form sections. All fields remain on one page;
the redesign does not change validation, approval or submission requirements.
Room-count and rate steppers use full-width, equal-height controls with labels
above them. Room counts use equal-width columns on desktop and a single column
on mobile; increment and decrement buttons retain 44 px touch targets.
Room labels have a fixed 12 px gap above the control, with 24 px between room
fields; this spacing is independent of the room-only and meal price controls.

Hotel and driver photo fields show a file-image icon and a visible file chooser.
Hotel selections use only the first five files, with an on-screen notice when
extras are ignored; drivers still require exactly one portrait. Photo preparation
runs at most two images concurrently, preserves selection order and strips
metadata. JPEG encoding starts at 0.85 quality and targets 350 KB per photo,
retaining up to 1920 px with the existing 1 MB hard limit. Smaller uploads reduce
transfer time without bypassing server validation or database confirmation.
Both registration forms show a dismissible success dialog with the registration
ID and private status code only after confirmed storage. The receipt remains
available on the page after dismissal; registration still awaits owner approval.

The footer's `/partners` link separates hotel and driver onboarding from
customer navigation. Check Bookings and the existing menu remain unchanged.
Registration is public but rate-limited and approval-only; it is not an
invitation-only portal.

`/register-driver` collects a driver's full legal name, age (18+), Indian phone
number, licence number and vehicle registration number. Only the name, masked
phone number, one driver portrait, vehicle selected from the current rental
catalog, base location, passenger seats and vehicle registration are public
after consent and owner approval. Phone and driving-licence numbers are masked;
age and full contact details remain private. Driver prices are not collected,
stored, returned by the API or required for approval. Vehicle model photos, taxes, luggage, trip types,
descriptions and fare-condition fields are not collected. The portrait uses the
same image resizing limits and private `HOTEL_PHOTOS` R2 binding, under a
separate `drivers/` prefix. Migration
`0012_driver_registrations.sql` creates the D1 table; apply it in production and
preview before deployment. No extra photo bucket is required.

A successful save returns a unique driver ID and private access code.
`/driver-status` requires the ID or phone plus that code. Owners review private
records and portraits at `/admin/panel/drivers`, correct vehicle registration
and approve/reject without entering a price. Apply
`0019_remove_driver_prices.sql` to production and preview D1 databases before
deploying this version. It removes the old price columns (including placeholder
INR 1 rates) and prices embedded in legacy driver details, preserving driver
registrations, IDs, statuses, portraits and linked reviews. Hotel and catalog
vehicle pricing is unchanged; registered-driver detail pages show price on enquiry.
Licence, eligibility, permits, insurance and portrait ownership need manual
review; the form does not automatically verify them. Approved names and
portraits appear in `/drivers`; the existing generic vehicle photos are used for
vehicle listings. Approved vehicles also appear in car rentals, detail pages,
enquiry selectors and the trip planner. Owner push notifications use the
existing notification setup. Run `npm run test:partners-ui` against the same
local preview server as hotel UI tests.

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
cookie and version checks. Review consent permits publishing the display name,
rating, review and optional booking ID. Published cards show the full stored
booking ID directly below the name, including existing imported reviews; cards
without an ID omit that line. Remove reviews containing private contact or payment details.

The public feed and average rating include only published database reviews.
Published cards are labelled Guest review, not independently verified stays.
The owner confirmed the ten existing entries are genuine guest reviews and
approved their import and publication. They now use the same D1 feed as other
published reviews; the separate preview display is removed. Negative and mixed
reviews use the same validation rules.

### Owner-Approved Existing Reviews

`ownerProvidedGuestReviews` and `ownerGuestReviewMonths` in `src/data/catalog.ts`
are the approved import source, not a second frontend review feed. Original
names, ratings, titles, texts, package labels and booking references are
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
--check-client` verifies that source references are not bundled in built assets;
booking IDs are served at runtime only for published reviews.

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
advance one at a time every two seconds and loop. Offer-style dots select a position.
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