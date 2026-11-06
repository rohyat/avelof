# AVELOF frontend conventions

- Use React, TypeScript, Vite, Tailwind CSS, React Router and Lucide icons.
- Keep business contact details in `src/config.ts`, catalog content in `src/data/`, and request formatting in `src/services/`.
- Keep all current booking and enquiry behavior frontend-only. Never imply that a request was delivered or a booking confirmed.
- Keep sample review content explicitly marked as preview-only; do not present it as verified feedback.
- Validate changes with `npm run build` and `npm run lint`.