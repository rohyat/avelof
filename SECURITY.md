# Security and privacy

This is a public, frontend-only website. Hotel names, prices, business contacts,
and other catalog content are public and cannot be concealed in a browser bundle.
Never put passwords, API secrets, private booking records, or confidential guest
information in the source code or Vite environment variables.

## Browser protections

Production builds include a Content Security Policy that restricts scripts and
connections to the same origin, disables embedded objects and native form
submissions, and allows only the existing Google font and Unsplash image sources.
Inline styling remains allowed for existing UI styles; inline scripts are blocked.
The page also disables referrer sharing.

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

Enquiry fields are held in browser memory, not sent to an application backend.
The guest explicitly opens a WhatsApp link and presses Send to share an enquiry.
Prepared WhatsApp URLs contain the guest's entered information: WhatsApp and
browser history may retain it. Do not claim that this flow never shares data.
No booking or message is delivered by the website itself.

Trip dates and hotel choices are temporarily stored in sessionStorage to restore
the planner. This is not encrypted storage and is accessible to scripts running
on this origin. Do not add contact details or payment information to this storage.
Unsplash and Google receive asset requests, including ordinary network metadata
such as the visitor's IP address, even with referrer sharing disabled. Self-host
approved images and fonts to eliminate those third-party asset requests.

For confidential records or authenticated bookings, use a backend with server-side
authorization, validation, access controls, retention rules, and secure storage.
These browser protections reduce risk; they are not a guarantee against leaks.

## Verification

Run `npm run build` and `npm run lint`. Test the production build with
`npm run preview`, check response headers, check for CSP console violations,
and verify navigation, external images/fonts, and the prepared enquiry flow.