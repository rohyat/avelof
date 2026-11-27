# AVELOF Unused Assets & Code Analysis Report
**Date:** 2026-11-27  
**Build Size:** 16.81 MB (dist folder)

---

## 📊 FINDINGS SUMMARY

### ✅ All Dependencies Are Used
- ✓ **jspdf** - Used in itinerary PDF generation (2 files)
- ✓ **qrcode-generator** - Used in itinerary builder
- ✓ **lucide-react** - Extensively used (58+ matches) across components
- ✓ **react-router-dom** - Core routing throughout app
- ✓ **zod** - Schema validation in 20+ service files
- ✓ **@block65/webcrypto-web-push** - Used in push notifications (functions)
- ✓ **tailwindcss** - Core styling framework
- ✓ **vite** - Build tool
- ✓ **wrangler** - Cloudflare Pages deployment

**Result:** No unused npm packages detected ✓

---

## 🖼️ UNUSED/UNREFERENCED ASSETS

### ⚠️ CRITICAL: Unused Images (3.31 MB total)

| File | Size | Location | Referenced? | Status |
|------|------|----------|-------------|--------|
| **local-referral-promo.png** | 3.31 MB | `/public/images/` | ❌ NO | **DELETE** |
| urbania-branded.png | 0.97 MB | `/public/images/vehicles/` | ❌ NO | **DELETE** |
| urbania-decal.png | 0.96 MB | `/public/images/vehicles/` | ❌ NO | **DELETE** |
| urbania.png | 0.96 MB | `/public/images/vehicles/` | ❌ NO | **DELETE** |
| aharbal.jpg | 0.39 MB | `/public/images/destinations/` | ❌ NO | **DELETE** |

**Unused assets total: ~6.59 MB** (39% of dist folder!)

### ✓ USED (Verified Referenced)
All other images in the dist folder are actively referenced in:
- `src/data/catalog.ts` - Destination listings
- `src/data/kashmirPhotoGallery.ts` - Photo gallery carousel
- `src/data/ladakhPhotos.ts` - Ladakh destination images
- `src/data/ladakhJourneys.ts` - Journey album photos
- `src/data/vehiclePhotos.ts` - Vehicle catalog (urbania-owner-branded.png ✓)
- `src/data/previewPhotos.ts` - Homepage preview images

---

## 🧩 COMPONENTS ANALYSIS

### All Components: USED ✓
Every single component in `/src/components/` is properly imported and used:
- 55 Total components
- 55 Used
- 0 Unused

**Examples of properly referenced components:**
- `HolidayDestinations` - Imported in LadakhPage, Pages
- `OwnerPushNotifications` - Used in registration pages
- `PartnerReviewPreview` - Used in DriversPage
- `SearchAutocomplete` - Integrated in DestinationsPage
- `CallAssistance` - Widespread usage (8+ pages)

**Linting Status:** ✓ No issues detected (`npm run lint` passed)

---

## 📁 DATA FILES ANALYSIS

### All Data Files: USED ✓

| File | Purpose | References | Status |
|------|---------|-----------|--------|
| activities.ts | Activity catalog | 20+ | ✓ USED |
| brandPromises.ts | Trust points | 5+ | ✓ USED |
| businessRegistration.ts | Form schema | 3+ | ✓ USED |
| catalog.ts | Main destination catalog | 23+ | ✓ USED |
| destinationOptions.ts | Search filters | 4+ | ✓ USED |
| driverRegistration.ts | Driver form schema | 2+ | ✓ USED |
| handicrafts.ts | Business type | 4+ | ✓ USED |
| hotelRegistration.ts | Hotel form schema | 15+ | ✓ USED |
| itineraryBuilder.ts | PDF builder schema | 11+ | ✓ USED |
| itineraryRoutes.ts | Journey routing | 2+ | ✓ USED |
| itineraryTerms.ts | Legal terms | 6+ | ✓ USED |
| kashmirPhotoGallery.ts | Photo gallery | 32+ | ✓ USED |
| ladakh.ts | Ladakh routing | 18+ | ✓ USED |
| ladakhBikePhotos.ts | Bike journey images | 4+ | ✓ USED |
| ladakhJourneys.ts | Journey details | 25+ | ✓ USED |
| ladakhPhotos.ts | Ladakh gallery | 10+ | ✓ USED |
| ladakhPlaces.ts | Destination details | 7+ | ✓ USED |
| localTrips.ts | Local tour catalog | 1+ | ✓ USED |
| offers.ts | Promo data | 16+ | ✓ USED |
| previewPhotos.ts | Homepage images | 5+ | ✓ USED |
| regions.ts | Regional data | 20+ | ✓ USED |
| travelGuide.ts | Travel tips | 2+ | ✓ USED |
| unionCabs.ts | Taxi info | 10+ | ✓ USED |
| vehiclePhotos.ts | Vehicle catalog | 1+ | ✓ USED |

**Result:** All 24 data files are actively used ✓

---

## 📊 BUILD SIZE ANALYSIS

### Top 10 Largest Files in `/dist/`

| File | Size | Type | Necessary? |
|------|------|------|-----------|
| index-Cq33yXwU.js | 0.92 MB | App bundle | ✓ Core |
| jspdf.es.min-xAUHACwe.js | 0.38 MB | PDF library | ✓ Used |
| local-referral-promo.png | 3.31 MB | Image | ❌ UNUSED |
| urbania-owner-branded.png | 1.17 MB | Image | ✓ Used |
| urbania-branded.png | 0.97 MB | Image | ❌ UNUSED |
| pahalgam-preview.webp | 0.85 MB | Image | ✓ Used |
| srinagar-preview.webp | 0.43 MB | Image | ✓ Used |
| urbania-decal.png | 0.96 MB | Image | ❌ UNUSED |
| urbania.png | 0.96 MB | Image | ❌ UNUSED |
| aharbal.jpg | 0.39 MB | Image | ❌ UNUSED |

---

## 🎯 OPTIMIZATION OPPORTUNITIES

### HIGH PRIORITY (Implement Immediately)

#### 1. **Delete Unused Images** (Save 6.59 MB)
```bash
rm public/images/local-referral-promo.png
rm public/images/vehicles/urbania-branded.png
rm public/images/vehicles/urbania-decal.png
rm public/images/vehicles/urbania.png
rm public/images/destinations/aharbal.jpg
```
**Expected reduction:** 39% smaller dist folder

#### 2. **Code Splitting for jspdf** (Optional)
Currently loaded eagerly (0.38 MB). Consider dynamic import for PDF features:
- Used only in `ItineraryBuilderPage` and `PaymentsPage`
- Could reduce main bundle by ~300KB

---

## ✓ CODE QUALITY

- **Linting:** PASS ✓ (`npm run lint` returns no errors)
- **TypeScript:** PASS ✓ Builds successfully
- **Circular Dependencies:** None detected
- **Dead Code:** None detected (oxlint verified)
- **Unused Exports:** None detected

---

## 📋 RECOMMENDATIONS

### Immediate Actions
1. ✅ **Delete unused images** (6.59 MB saving)
   - local-referral-promo.png
   - urbania-branded.png, urbania-decal.png, urbania.png
   - aharbal.jpg

2. ⏳ **Monitor jspdf usage** - Consider lazy loading if PDF feature is optional

### Keep As-Is
- ✓ All 24 data files
- ✓ All 55 components
- ✓ All npm dependencies
- ✓ All referenced images

---

## 📌 NOTES

- The project follows best practices for asset organization
- All code is properly imported and referenced
- No dead code paths detected by linter
- CSS (Tailwind) is tree-shaken; all styles used
- Build is optimized with gzip compression
- Assets with `.webp` format are well-optimized

**Current waste:** ~6.59 MB of unused images  
**Potential reduction:** 39% (from 16.81 MB to ~10 MB dist)

