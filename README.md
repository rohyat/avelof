# AVELOF

Premium Kashmir travel frontend built with React, TypeScript, Vite, Tailwind CSS, React Router and Lucide.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`. Run the configured linter with `npm run lint`.

The Dark mode switch sits beside the header logo. Light mode is the default;
the chosen theme is stored in the browser and shared across open tabs.

Hotel registration and editing support Centralised heating, Hot & cold AC,
Room heaters and No heating. The selected option is retained in private records
and displayed with the approved hotel details.
Hot & cold AC also has an independent required Yes/No selector on registration
and private editing and can be reviewed by admin. It can coexist with centralised
heating. Cards, details, enquiries and planner room prices show a tick before
Hot & cold AC when available, or a cross when unavailable, without Yes/No text.
An accessible label also states availability. This indicator appears
after the room/meal information. Older records derive Yes only from the legacy
Hot & cold AC heating choice; all other existing records derive No. An explicit
saved choice takes precedence. No migration or destructive record rewrite is needed.

Hotel customer room rates are the submitted/admin-reviewed rates plus 50%,
rounded up to a whole rupee: INR 2,000 becomes INR 3,000. Private partner/admin
rates are not changed. The saved hotel/package discount (initially 23%) applies to that regular room rate:
INR 3,000 becomes INR 2,310. Discounted hotel room rates round to the nearest
whole rupee, with .50 rounding up (INR 1,786.40 becomes INR 1,786). Listings,
enquiries and planner totals use this same rounded nightly rate before multiplying
by rooms and nights. Meal add-ons and package calculations are unchanged.
The regular rate is crossed out
above the discounted rate with the current discount label (no crossed-out rate at 0%). Customer-facing rates use the
rupee symbol. Hotel/package listing cards, the front-page offer heading and
standard hotel/package enquiry forms say All taxes and charges included.
The same statement is saved in enquiry details; no separate GST is added.
Selected meals are added separately without markup or discount.
Deluxe and Premium regular package prices are INR 22,000 and INR 36,000 per person,
discounted to INR 16,940 and INR 27,720. Home/cards, details, banners, enquiries and
planner estimates use discounted prices. In `/admin/panel`, signed-in admins can
change **Hotel & package discount** from 0 to 100%, with up to two decimal places.
The value is saved in D1 through `/api/pricing` and survives reloads/deployments.
Public GET exposes only the percentage/version; PATCH requires same-origin admin
authentication and an optimistic version check. Failed or conflicting saves show
an error rather than confirmation. Packages wait for valid settings; hotel listing
reads fail explicitly if pricing storage is unavailable. Admin saves refresh hotel
rates and package views, and returning visitors refresh on window focus.
Apply migration `0026_restore_pricing_discount.sql` before deploying this restored
control: it initializes the previously retired settings row to 23% once, replacing
its stale historical value. Later edits persist without being reset on deployment.
Legacy tax metadata remains readable but is not used to calculate prices.
Breakfast/dinner labels and selected-meal messages state the coverage: 2 people
per room per day, or 4 in a Family room (twice the meal add-on).
Cabs, their rates and existing 30% offer remain unchanged.
The winter offer banner shows the saved hotel/package percentage alongside the
30% cab offer. The Hotels slide uses Crown Prince's current public photo, regular
and discounted rates, discount percentage and detail link, with explicit loading,
unavailable and retry states rather than a hardcoded rate. Snowflakes vary in size,
depth, opacity, speed and drift against a deep-blue winter background. Small
six-armed flakes gently rotate as they fall, crossing the banner in 4-7 seconds.
Decorative falling snow stays within the banner on desktop/mobile,
does not intercept clicks, and is hidden when reduced motion is requested.

Hotel enquiry estimates update immediately from selected nights, rooms and
meal add-ons. Hotel stay nights through **5 December 2026** use the current
discounted room rate. Nights from **6 December 2026 onward** add 10% to that
room-only rate, rounded to the nearest whole rupee (.50 up). Meals are added
afterward without this increase; cab rates do not change. Standard packages use
the separate arrival-based seasonal rule below.
Check-out is excluded, and stays spanning the change sum each applicable nightly
rate before multiplying by rooms. For example, a room at INR 2,310 is INR 2,541
from 6 December; 5-7 December is INR 4,851 room-only for one room/two nights.
The same nightly calculation is used in the enquiry form and custom trip planner,
including each day's hotel cards and saved itinerary. Local-trip hotel cards use
the selected stay date. Listings retain base rates with a visible seasonal notice.
Hotel enquiry fields are labelled Check-in date and Check-out date. Only the
check-in calendar shows the selected room type's room-only nightly price below
each date; the check-out calendar shows dates without prices. Typed dates still work.
Calendar month navigation, arrow keys, Page Up/Down, selection and Escape are
supported; check-out days before the minimum are disabled and its date is not billed.
Calendar prices exclude optional meals, which are shown separately in the stay
breakdown. Current admin discounts feed both calendar and estimates. Date-sensitive
estimates and the rate breakdown are saved with the enquiry only after D1 receipt;
they are estimates, not availability or booking confirmation. No migration needed.

Fixed-package enquiries ask only for a start date and automatically open its
calendar. The end date is calculated from the package's included nights (sum of
its stays), displayed as read-only text, and saved with the enquiry. Changing
package or start date recalculates both the end date and estimate. Custom trips
and car rentals retain their existing date selection.
When the selected arrival date is 6 December 2026 or later, the entire
package price increases by 10%, rounded to paise. Arrivals
through 5 December keep current rates even when the trip crosses the cutoff.
Listed starting prices remain unchanged; the form explains the rule and saves
the seasonal price and increase with the enquiry. Deluxe's standard 4-night
price becomes INR 18,634; Premium's 5-night price becomes INR 30,492.
Custom trip estimates retain their component pricing, including date-based hotel
rates, without an additional package-wide increase.
Deluxe includes 4 nights and Premium includes 5 nights. Custom planner estimates
remain based on actual selected stays and vehicles rather than prorating a
standard package.

All package (including custom planner) and car enquiry forms include an optional
"Will you be arriving between 6:00 PM and 7:00 AM?" checkbox, unchecked by default.
The explicit Yes/No response is saved with the private enquiry details and request
summary; checking it does not add a charge or confirm availability. No migration
is needed because it uses the existing enquiry JSON.

Driver vehicle numbers temporarily allow non-JK state prefixes as well as JK.
Public driver phone numbers show only the first digit and final two digits
(`9*******10`). Driving licences show only the first two and final two characters
(`JK*********89`); all middle characters are masked server-side. Full credentials
remain available only through private driver lookup and authenticated admin access.
The basic format is two letters, two district digits, one to three series
letters and four final digits (for example `PB01B3302` or `DL01ABC1234`). Spaces and hyphens are
normalised, with the final value stored as `DL01AB-1234`. This applies to both
new registrations, partner edits and admin approval; malformed or incomplete numbers remain invalid.

Public registrations (hotels, drivers, restaurants and shops), enquiries
(including the custom planner and local trips), and reviews display a centred
loading dialog while their save request is pending. Escape cannot dismiss the
loading dialog. A centred acknowledgement appears only after the server confirms
the save; failures keep the form available for retry. Enquiry receipts do not
confirm a booking. Shared feedback lives in `src/components/SubmissionFeedback.tsx`;
registration receipts retain their private reference and access-code details.

Hotel detail pages show the hotel ID, room count, ratings and review link above
the photos. At widths up to 820px, Book Now appears after the hotel details,
below pricing; wider layouts use only the existing sticky booking sidebar.

Hotel registration tiers are Deluxe (2-star), Premium (3-star), Premium Plus
(3-star Plus), Diamond (4-star) and Luxury (5-star). These are AVELOF categories,
not official star certifications or guest review scores. Existing category
values remain valid; existing Luxury records are not automatically reassigned
to Diamond. Owners can edit and resubmit a listing when its tier needs changing.

Hotel registration asks for an exact area below the destination: Gulmarg has
Main Gulmarg/Tangmarg, Pahalgam has Main Pahalgam/Rafting Point, and Srinagar has
Near Dal Lake/Near Airport/Main Srinagar. Other destinations offer their main
area. Every destination also supports Specify location with a required free-text
area (up to 120 characters). Changing destination clears the previous area.
Areas are public and remain separate from the destination used for filtering,
trip routing and hotel IDs. Older records without an area remain supported;
their owners can add one through private editing. Areas are stored in the
existing hotel details JSON, so no database migration is needed.

Planner, booking and local-trip dates use the shared `DateInput` control with a
persistent Lucide calendar icon. The native date picker, validation and ISO
form values are preserved; no third-party calendar service or library is used.
Inputs shrink within their layout on Safari and use 16px text to avoid iPhone
focus zoom. Run `node --test tests/date-inputs.test.mjs` against the local Pages
preview (or `AVELOF_ACTIVITY_TEST_URL`) for iPhone-sized WebKit, Android-sized
Chromium and desktop layout checks. These emulate browsers, not the physical
iOS system picker. WebKit must be installed with `npx playwright install webkit`.

Unused styles from the retired About layout, removed contact form and Travel
Guide footnote have been removed. Keep image attribution/source records and
licences: the current destination and vehicle assets are referenced by the site.
The retired map-pin picker, its styles and Leaflet dependencies are removed.
Previously saved coordinates and public Google Maps links remain supported.
Unused SVG app/favicon icons are removed; the active PNG app, favicon and
Apple touch icons use the owner-supplied Chinar leaf/A logo. The header and
footer reuse the 512px logo icon alongside the AVELOF wordmark. Web-sized PNGs
avoid serving the original image-embedded, 3.8 MB SVG.
Logo URLs are versioned across the website, manifest, Apple touch icon and push
notifications so new requests do not reuse the old cached artwork. Existing
home-screen icons may require removing and re-adding the app after deployment.
Google Search refreshes its own favicon cache after recrawling the homepage;
this can take days to weeks. Request homepage indexing in Google Search Console
to request a recrawl, not to guarantee an immediate icon update.

The footer's Install app button opens browser-specific installation help rather
than navigating back to the homepage when no automatic prompt is available.
Regular visitors register the root service worker without enabling notifications.
Supported Chromium browsers use `beforeinstallprompt` when available; iPhone/iPad
visitors receive Safari Share / Add to Home Screen instructions, including iPads
using desktop user agents. In-app browsers must open the site in a supported
browser. Installation is browser-controlled, not an APK download, and the app
still requires internet access. Run `node --test tests/logo.test.mjs
tests/app-installation.test.mjs` against the Pages preview for branding,
registration, install-event and mobile fallback checks. Physical phone installs
remain a manual check.

Owner alerts are opt-in on each device, independently of app installation.
After reinstalling, open `/admin/panel`, sign in and Enable on this device.
Admin sign-in links in the navigation menu and footer reach that panel within
the installed app, without changing its homepage launch or bypassing sign-in.
Setup waits for the service worker to activate and resaves an existing valid
subscription; changed push keys can be reconnected with Enable. Recheck settings
retries setup errors and refreshes permissions after returning from phone settings.
Blocked Chrome/phone notification permissions must be changed manually;
iPhone/iPad push requires the home-screen app on iOS/iPadOS 16.4 or later.
Send test notification sends a private admin-only test through the server to
that saved device subscription. Success means the push service accepted it,
not proof that the phone displayed it. Missing/expired subscriptions require
enabling again; delivery failures are reported without affecting enquiry saves.
The manifest keeps `start_url: "/"`: ordinary app launches open the homepage,
while tapping an owner alert opens the admin panel. Customer installs never
subscribe to owner alerts. Test with `node --test tests/owner-notifications.test.mjs`
and the push-related cases in `functions/api/enquiries.test.mjs`.

## Admin authenticator verification

Admin sign-in supports password plus a free TOTP authenticator (for example,
Google Authenticator or Microsoft Authenticator), with no SMS/email service.
After a correct password, an enrolled environment asks for a six-digit code.
No admin cookie is issued until both checks pass. Codes change every 30 seconds;
the server accepts one step of clock drift and atomically prevents code reuse
in D1. Login attempts share the existing ten-attempt/ten-minute per-IP limit.
Enabling/replacing the authenticator invalidates old admin sessions without
rotating customer access secrets or changing the app homepage.

Enrollment must happen in a **private interactive terminal**, never in chat:

```bash
npm run setup:admin-authenticator
npm run db:migrate:local
```

The setup command checks your current admin password, generates a private
manual-entry setup key, and requires a valid code from the new authenticator
before saving `ENQUIRY_ADMIN_TOTP_SECRET` in ignored local settings. Use a
time-based account with SHA-1, six digits and a 30-second interval. Enable
automatic time on the phone. Keep a secure offline/password-manager backup of
the setup key; do not share it, OTPs, passwords, screenshots or terminal logs.
Restart the local Pages server after local enrollment/migration.

For production, once the updated code is tested and ready to deploy:

```bash
npm run setup:admin-authenticator -- --cloudflare
npm run build
npm run deploy
```

The Cloudflare option applies pending production D1 migrations, uploads only
the authenticator secret, and saves local settings after verification. It does
not deploy code. Complete deployment and test sign-in on the intended phone.
Until the secret is configured in an environment, existing password-only
sign-in remains available for rollout; simply deploying code does not activate
two-factor authentication. Invalid configured secrets or unavailable replay
storage fail closed. Admin APIs use the same authenticated session checks.

If the phone is lost, restore the backed-up setup key in another authenticator.
If no backup exists, use your trusted local settings, admin password and
Cloudflare account access to intentionally re-enroll:
`npm run setup:admin-authenticator -- --cloudflare --replace`, then redeploy.
There is no public password-only recovery/bypass endpoint. Existing push device
subscriptions remain saved, but you must sign in again to manage them.

Validate using `node --test tests/admin-authenticator.test.mjs` against the
Pages preview and the authenticator cases in `functions/api/enquiries.test.mjs`.
Tests cover RFC 6238 vectors, clock drift, replay/concurrency, rate limits,
session invalidation, setup failures, login retries and password-only rollout.
All current destination and vehicle photos are used.
Styles generated dynamically by booking status are intentionally
retained even when their full class names do not appear in JSX.

## Homepage discovery tiles

About & Contact (`/about`) combines a responsive introduction, linked service
cards, a brand-story panel with three concise icon-led bullet cards instead of
long introductory paragraphs, a concise approach section and direct
contact options (WhatsApp, phone, email and Instagram). There is no enquiry form
on this page; Plan a trip leads to the existing planner. WhatsApp remains an
optional help channel, not the enquiry submission flow.

Tile order: Plan a trip, Packages, Hotels, Cabs, Drivers, Bookings, Places,
Activities, Reviews, Food & Shopping, Travel Guide, Partner, Local Trips.

Local Trips (`/local-trips`) offers sourced trek ideas and picnic/day-trip
requests using destination attractions and vehicle choices from the existing
catalogue. Trek and picnic discovery use swipeable photo cards with position
dots, arrow buttons and keyboard navigation. Carousel dots use compact spacing
and shrink on narrow phones so all positions and both arrow controls stay on
one row. Trek descriptions and highlights are visible directly, without
expandable details or external reading links.
Trek photos show the named route where available, otherwise its starting region.
Each card links to the enquiry flow with that trek or picnic place selected.
Discovery starts directly below the Kashmir hero with two combined tiles:
Picnics & day trips followed by Treks. Picnic/day trip is the default enquiry
type. Headings, swipe instructions and three category-specific planning points
sit above each bordered photo-carousel tile. Large heading icons are omitted;
bullet points retain decorative icons. There are no duplicate introductory tiles.
The three steps are trip type
and contact details (name, phone, pickup, drop, group size and date), one trek
or picnic destination with requested sights, then a preferred vehicle.
Picnic travellers can request a one-night stay on the first step. This adds a
Hotels step after Places, using only public AVELOF listings at the chosen
destination. Check-in uses the preferred date and checkout is the next day.
Listed rates are not date-specific availability or a group quote; rooms,
meals, capacity and the final price need confirmation. A traveller may choose
a hotel preference or ask AVELOF to help find a stay. Loading failures show an
explicit retry action; destinations with no listings are identified as such.
Changing destinations clears the hotel preference. Disabling the overnight
choice or choosing a trek excludes hotel details from the enquiry.
Destination and vehicle cards reuse the main planner's styling; Back preserves
entered details and choices. Changing the picnic destination clears its
previous attraction choices. The form has no additional free-text field.
Campfires are requests only, subject to permission and safety.
The enquiry section displays a launch warning: Local Trips is launching soon
and confirmed bookings are not being accepted yet. Enquiry submissions remain
open for registering interest.
Requests use the existing server-side enquiry storage, return a receipt only
after a successful save, and never confirm availability, price or a booking.
Routes, permissions, guides, transport and local taxi rules need checking.
Trip and vehicle choices are maintained in `src/data/`; no local-trip admin
catalogue is implemented yet.

The Travel Guide offers optional WhatsApp help using the business phone in
`src/config.ts`. The site-wide floating help link is an accessible, icon-only
WhatsApp button on all screen sizes. Enquiry submission remains separate.
The guide ends with a button linking to destination discovery, without the
former general-planning guidance footnote.

Package detail pages use a journey overview with route chips, stay cards and
transport information, illustrated day-by-day itinerary cards, experience icons,
and distinct inclusion/exclusion panels. Package terms, itinerary text and prices
remain sourced from `src/data/catalog.ts`. Book Now sits at the end of the package
details, after the FAQs, only in the single-column layout (820px and below)
where the price card moves above the details. Wider screens keep only the sticky
price-card booking action. Four introductory highlights show duration, hotels with breakfast and dinner,
private vehicle with local driver, and sightseeing. Practical notes use icon
cards, and the FAQs use keyboard-accessible expandable cards.
The highlights align in an equal-sized two-column grid on mobile and tablet
(up to 1060px), keeping the flexible desktop row unchanged.
`node --test tests/package-details.test.mjs` verifies both published package
layouts, content, responsive sizing and booking selections against port 8791
(or `AVELOF_HOTEL_TEST_URL`).

Places (`/destinations`) is a destination guide, not a second enquiry form.
Every destination uses the same layout: overview, travel/time/season facts,
five main attraction highlights, activities and experiences, access guidance
and a **Customise your trip** link to the main planner. Links from an existing
trip return to that planner without automatically changing selected places.
Activity entries reuse `src/data/activities.ts`, including seasonal and operator
checks; destinations without catalogue activities say so rather than inventing
paid experiences. Search includes aliases, attractions and listed activities.
Search suggestions appear after two letters and tolerate common spelling
mistakes. Choosing an attraction (for example Chandanwari or Drung Waterfall)
opens its parent destination, without creating a separate destination. Keyboard
arrows/Enter and touch selection are supported. Up to eight chosen suggestions
are saved as catalogue IDs in browser-local storage, shown when an empty search
is focused, and removable with **Clear history**. Searches are not sent to a
third-party provider. Storage errors show a notice without blocking search.
Places and Activities share the same autocomplete component and spelling
matching. Activity suggestions include the destination/category, appear after
two letters (for example `Shi` suggests the Dal Lake shikara ride), and have
their own eight-item local history. Selecting an activity resets destination
and category filters to show that experience, even if a previous filter
excluded it. Private booking-ID lookup remains exact and is not saved locally.
The introductory travel notice and distance filter are omitted; approximate
Srinagar distances and one-way times remain on each destination card.
Run `node --test tests/destinations.test.mjs` against the built local preview on
port 8791 (or set `AVELOF_HOTEL_TEST_URL`) to check consistent highlights,
responsive layouts, search, shared activities and planner-return links.

The homepage has 12 shortcuts, including Activities (`/activities`),
Food & Shopping (`/food-and-shopping`) and Travel Guide (`/travel-guide`).
Activities provides destination/category/search filters and incremental results.
The catalogue in `src/data/activities.ts` focuses on paid experiences in Srinagar,
Gulmarg, Sonamarg and Pahalgam, not general sightseeing walks. Gulmarg has one
combined ATV/motorbike request; Pahalgam lists zip-lining rather than ATV rides.
Dal Lake boat options beyond shikaras and zip-line sites require operator and
local-permission verification. Tourism source references are retained in the catalogue data; they describe general experiences,
not live opening status. ATV/motorbike and other unverified operator enquiries
are explicitly marked for local verification. Seasonal access, snow, tickets,
permits and safety arrangements must be confirmed. No prices or live inventory
are invented. Cabs is unchanged.

Both Plan a trip entry points use Date, Places, Vehicle, Activities, Hotels and
Contact details steps. The separate Activities step follows Vehicle and is
optional, limited to selected destinations. Skipping paid experiences does not
remove planned sightseeing; travellers can ask to add activities later, subject
to availability. Removing a destination removes its
activity requests. Selections survive destination/hotel detail returns, appear
before contact submission, and are saved as `selectedActivities` with the enquiry.
Activity costs are not part of vehicle/stay estimates. These are preferences for
follow-up, never confirmed bookings. Private activity text is not added to public
reference-only booking summaries.

The Vehicle step offers unchecked optional union-cab requests for selected
Pahalgam and Gulmarg destinations. Pahalgam guidance covers Aru Valley, Betaab
Valley and Chandanwari; Gulmarg explains that union cabs may be required in bad
weather, subject to road conditions and local rules. These requests survive
detail-page returns, clear when their destination is removed, appear before
submission and persist as `unionCabRequests` for the private admin enquiry.
Union-cab charges are separate from the estimate and require confirmation.
Saved planner version 3 maps older vehicle/hotel steps to the six-step flow.

Food & Shopping is discovery-only: there is no ordering, checkout or payment.
Restaurant/shop owners can register at `/register-business`, also linked from
Partners. Public business information and photos require explicit publication
consent. Owner contact name, phone and email stay private. Registration confirms
receipt only after storage succeeds; nothing is advertised automatically.
The existing admin session protects `/admin/panel/businesses`, where AVELOF can
edit, approve, hide or delete submissions. The public directory shows approved
records only and supports business-type and destination filters.
Businesses can add up to 20 product/dish names (100 characters each), displayed
as item chips on approved listings, with dish icons for restaurants and shopping
icons for shops. The former About your business field is
removed from registration; existing descriptions remain readable and editable
in the admin panel. Address guidance asks for a nearby attraction or landmark.
Business registrations require 1-5 shop, restaurant or product photos (JPEG,
PNG or WebP, up to 5 MB original each); invalid counts are rejected with feedback.
Every photo is compressed and validated, saved transactionally in D1, private
until approval, visible in the approved gallery and deleted with its listing.
Apply `0023_business_photo_gallery.sql` before deploying these gallery changes;
it preserves existing single-photo listings. Only the local migration has been
applied during development.

Restaurant/shop owners can check and edit details at `/business-status`, linked
from Partners and the registration receipt. Use the business ID (or registered
phone) and private status access code: the first four alphanumeric characters of
the business name, uppercased, plus the final four phone digits, matching hotel
and driver access. If multiple businesses share a phone and code, use the ID.
Credentials travel only in POST bodies, never URLs or browser storage. Public
listings do not expose owner contacts or access codes; pending photos remain
private. The edit form privately previews existing photos. Remove individual photos
with X or add new ones, keeping 1-5 photos in total. Removals apply only on a successful
save. Edits preserve legacy descriptions and hide the listing pending fresh approval.
Name/phone changes can change the access code shown on the saved receipt.
Version checks prevent stale edits, and unchanged retries recover saved updates
without duplicating photo bytes. No additional database migration is needed
beyond the gallery migration above.

The mobile navigation closes on outside taps or Escape without blocking page
scrolling; its toggle exposes expanded state to assistive technology.

Hotel, driver and business registration/edit forms show stars on required fields
and inline feedback on leaving a field, updating as it is corrected. Optional
fields remain unstarred. Driver registration accepts `JK13J7748`,
`JK 13 J 7748` and `JK13J-7748`, formatting them as `JK13J-7748` on blur and
server-side. Complete registration-number validation remains; a typed dash
is not required. `node --test tests/registration-validation.test.mjs` verifies
required markers, feedback, correction and formatting in the local preview.

Apply the pending business migrations (`0020_business_registrations.sql` and
`0021_business_registration_integrity.sql`) using the normal D1 migration
workflow before deploying this feature. Local migration uses
`npm run db:migrate:local`; production migration is a separate release action.
No production migration or deployment is performed by local verification.

New feature checks: `npm run test:activities-ui` and
`npm run test:businesses-ui` exercise the activity catalogue/planner and business
registration/directory/moderation UI respectively. They use isolated browser
requests; backend registration tests run through `npm test`.

Travel Guide provides general preparation advice from `src/data/travelGuide.ts`,
not live weather or road updates. Guide headings have topic-specific icons, with
bulleted tips and matching icons on the right. Tips include respecting local
customs and avoiding alcohol in public, with private consumption only where the
hotel and local rules permit. Activity headings and planner
choices share experience icons. The public activities page does not display a
sources accordion; availability and operator-verification notices remain visible.

The custom trip planner offers a branded PDF download at the final review step,
before contact details are submitted. Deluxe and Premium package pages provide
ready-to-download itinerary PDFs generated from the current package catalog.
PDFs include the AVELOF brand promises, a day-by-day plan, all ten supplied
Kashmir photos, inclusions and exclusions, linked contact details on each page,
and a final thank-you page. Photos are also used in relevant package and
destination galleries; stay imagery is labeled illustrative, not property-verified.
The PDF explains that a custom plan is a guide rather than a final confirmed trip,
and AVELOF will help refine and arrange the itinerary. Unused, paid union cabs
may be eligible for a refund arranged by AVELOF, subject to local operator terms.

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
public highlight points. Each room type starts at zero; increase the quantities
for offered rooms and leave unavailable types at zero. At least one room is
required. The total room count is calculated from the selected quantities. Hotel
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
Existing photos appear in the private edit form with individual X controls. Keep
untouched photos, remove unwanted ones and add new uploads (1-5 total for hotels,
exactly one portrait for drivers). Nothing is removed from storage until the edit
is saved successfully. Cancel or failed saves leave stored photos unchanged.
Private previews use `POST /api/partner-photos` with kind, registration UUID,
access code and version in the JSON body; responses are no-store and pending photos
remain inaccessible through public image URLs. Edits send retained photo indexes
alongside new uploads; older API clients that omit indexes keep the previous
keep-all/replace-all behaviour. Version checks
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
The five planner steps are Date, Places, Vehicle, Hotels and Contact details.
Completed steps are clickable for direct editing; current/future steps cannot
skip validation, and navigation is disabled while saving or after receipt.
Only dates and guest counts appear first; destination selection is a separate
second step. Back navigation preserves selections, and hotel-detail return restores
the current step, including plans saved with the previous four-step layout.
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
offered type (Standard, Deluxe, Premium, Family and Suite). Submitted and
admin-reviewed room rates remain unchanged in private records. The public hotel
API adds 50% to each room rate and rounds up to the next whole rupee, including
legacy rates. This applies to existing and new hotels, listings, enquiries and
planner estimates, then applies the saved hotel/package discount. Breakfast and dinner add-ons are not increased or discounted.
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

## Existing map pins

Map pin selectors are not offered on hotel or business registration, editing, or
admin forms. Existing coordinates remain unchanged during edits, and approved
listings with saved coordinates can still offer **View on Google Maps**. No Google
Maps Platform API or paid map service is used.

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