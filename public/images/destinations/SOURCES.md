# Destination Preview Images

The named WebP files preserve the website's existing Unsplash preview images.
Names indicate their catalog placement, not the verified location of the photo.
These are illustrative images, not verified photographs of the named Kashmir
destinations. Replace them with approved destination photography before launch.

| File | Existing Original Source |
| --- | --- |
| srinagar-preview.webp | https://images.unsplash.com/photo-1501785888041-af3ef285b470 |
| doodhpathri-preview.webp | https://images.unsplash.com/photo-1519681393784-d120267933ba |
| gulmarg-preview.webp | https://images.unsplash.com/photo-1464822759023-fed622ff2c3b |
| sonamarg-preview.webp | https://images.unsplash.com/photo-1517299321609-52687d1bc55a |
| pahalgam-preview.webp | https://images.unsplash.com/photo-1472396961693-142e6e269027 |

Unsplash license: https://unsplash.com/license

The original catalog did not identify photographers for these five images.
Original source URLs are retained rather than inventing author credits. Verify
source metadata and attribution requirements when replacing these assets.
The separate Aharbal and Manasbal image credits remain in the destination data.

Regenerate previews with `npm run sync:images` from the project root. Existing
valid files are kept unless `-- --refresh` is passed. The import requests WebP,
1400px width and quality 75; it does not disable certificate verification.