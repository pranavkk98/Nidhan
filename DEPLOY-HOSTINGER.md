# Nidan Guru — Hostinger Deploy

## What changed
- **Email is sent over Hostinger SMTP** from the mailbox `mail@nidanguru.thenidan.com`
  (server-side, via a self-contained SMTP client in `api/send-booking.php` — no Composer/
  PHPMailer needed). The mailbox password lives only on the server, never in the browser bundle.
- Both the **booking calendar** and the **contact form** POST to `/api/send-booking.php`.
  The studio inbox (`mail@nidanguru.thenidan.com`) gets a notification and the visitor gets a confirmation.
- **Pricing:** consultation fee is now shown as **₹6,000**, with a **₹500 token** to confirm
  the slot and the **₹5,500 balance** collected at the session.

## Deploy steps (Hostinger shared hosting)
1. In hPanel → **File Manager**, open `public_html`.
2. Upload **`nidanguru-hostinger.zip`** (in this folder) and **Extract** it there.
   - Make sure these land at the web root: `index.html`, `.htaccess`, `assets/`, `api/send-booking.php`,
     `qr-payment.jpg`, `Logo.png`, the `.mp4` videos, etc.
   - Enable "show hidden files" so `.htaccess` is visible/kept.
3. Confirm PHP is enabled (default on Hostinger) and PHP ≥ 7.4 with cURL (default).
4. Visit the site, make a test booking — `consult@nidanguru.com` should receive the email.

## Notes
- Emails send `from: mail@nidanguru.thenidan.com` over `smtp.hostinger.com:465` (SSL).
  Reply-To on the studio notification is the visitor's address, so replies go straight to them.
- SMTP credentials live in `api/send-booking.php` (`$SMTP_USER` / `$SMTP_PASS`). If you change
  the mailbox password in hPanel, update `$SMTP_PASS` here too.
- This must run on the **same Hostinger account that hosts the `thenidan.com` mailbox** (or any
  host that can reach `smtp.hostinger.com:465`). Hostinger allows outbound SMTP on its own hosting.
- If port 465 is blocked, switch to STARTTLS on 587: set `$SMTP_PORT = 587` and change the
  `fsockopen('ssl://'...)` to `tcp://` plus a `STARTTLS` handshake (ask me and I'll wire it).
- To rebuild after code changes: `npm run build`, then re-zip `dist/` (the `.htaccess`
  and `api/` come from `public/` automatically).
