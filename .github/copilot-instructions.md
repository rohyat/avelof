# AVELOF frontend conventions

- Use React, TypeScript, Vite, Tailwind CSS, React Router and Lucide icons.
- Keep business contact details in `src/config.ts`, catalog content in `src/data/`, and request formatting in `src/services/`.
- Enquiries are saved through the Cloudflare Pages Function to D1. Confirm receipt only after a successful database response; never imply that a booking is confirmed. WhatsApp is an optional help link, not the submission flow. Keep database access server-side and customer records private.
- Keep sample review content explicitly marked as preview-only; do not present it as verified feedback.
- Validate changes with `npm run build` and `npm run lint`.