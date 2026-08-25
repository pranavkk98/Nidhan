<?php
/**
 * Nidan Guru — booking / consultation email endpoint (Hostinger SMTP)
 * -------------------------------------------------------------------
 * Runs server-side on Hostinger. The React app POSTs booking JSON here and
 * this script sends the email through the Hostinger mailbox over SMTP.
 * The mailbox password is NEVER exposed to the browser.
 *
 * Self-contained: uses a raw SMTP client (fsockopen) — no Composer / PHPMailer
 * needed. Just upload and it works on Hostinger shared hosting.
 */

// ---- Config -----------------------------------------------------------------
$SMTP_HOST = 'smtp.hostinger.com';
$SMTP_PORT = 465;                              // implicit SSL
$SMTP_USER = 'mail@nidanguru.thenidan.com';
$SMTP_PASS = 'thenidan123$';                   // Hostinger mailbox password

$FROM_EMAIL = 'mail@nidanguru.thenidan.com';
$FROM_NAME  = 'Nidan Guru';
$NOTIFY_TO  = 'mail@nidanguru.thenidan.com';   // studio inbox for new bookings

$FEE_TOTAL   = 6000;   // full consultation fee (₹)
$FEE_TOKEN   = 500;    // token paid up front to confirm (₹)
$FEE_BALANCE = $FEE_TOTAL - $FEE_TOKEN;

// ---- CORS / method ----------------------------------------------------------
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
  exit;
}

// ---- Parse input ------------------------------------------------------------
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

function clean($v) { return trim(htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8')); }

$type    = clean($data['type'] ?? 'booking');     // "booking" | "enquiry"
$name    = clean($data['name'] ?? '');
$email   = clean($data['email'] ?? '');
$phone   = clean($data['phone'] ?? '');
$date    = clean($data['date'] ?? '');
$slot    = clean($data['slot'] ?? '');
$service = clean($data['service'] ?? '');
$message = clean($data['message'] ?? '');

if ($name === '' && $email === '' && $phone === '') {
  http_response_code(422);
  echo json_encode(['ok' => false, 'error' => 'missing_fields']);
  exit;
}

// ---- Minimal SMTP client ----------------------------------------------------
/**
 * Sends one HTML email over SMTP (implicit SSL). Returns true on success,
 * or a string error message on failure.
 */
function smtp_send($host, $port, $user, $pass, $fromEmail, $fromName, $to, $replyTo, $subject, $html) {
  $fp = @fsockopen('ssl://' . $host, $port, $errno, $errstr, 20);
  if (!$fp) return "connect failed: $errstr ($errno)";
  stream_set_timeout($fp, 20);

  $read = function () use ($fp) {
    $data = '';
    while ($line = fgets($fp, 515)) {
      $data .= $line;
      if (isset($line[3]) && $line[3] === ' ') break; // last line of reply
    }
    return $data;
  };
  $cmd = function ($c) use ($fp, $read) {
    if ($c !== null) fwrite($fp, $c . "\r\n");
    return $read();
  };
  $code = function ($r) { return (int) substr(trim($r), 0, 3); };

  $expect = function ($resp, $ok) use ($code) {
    return in_array($code($resp), (array) $ok, true);
  };

  $r = $read();                                   if (!$expect($r, 220)) { fclose($fp); return "greeting: $r"; }
  $r = $cmd('EHLO nidanguru.thenidan.com');        if (!$expect($r, 250)) { fclose($fp); return "ehlo: $r"; }
  $r = $cmd('AUTH LOGIN');                          if (!$expect($r, 334)) { fclose($fp); return "auth: $r"; }
  $r = $cmd(base64_encode($user));                 if (!$expect($r, 334)) { fclose($fp); return "user: $r"; }
  $r = $cmd(base64_encode($pass));                 if (!$expect($r, 235)) { fclose($fp); return "pass rejected"; }
  $r = $cmd('MAIL FROM:<' . $fromEmail . '>');     if (!$expect($r, 250)) { fclose($fp); return "mailfrom: $r"; }
  $r = $cmd('RCPT TO:<' . $to . '>');              if (!$expect($r, [250, 251])) { fclose($fp); return "rcpt: $r"; }
  $r = $cmd('DATA');                               if (!$expect($r, 354)) { fclose($fp); return "data: $r"; }

  $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
  $encFrom    = '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>';
  $headers  = "From: $encFrom\r\n";
  $headers .= "To: <$to>\r\n";
  if ($replyTo) $headers .= "Reply-To: <$replyTo>\r\n";
  $headers .= "Subject: $encSubject\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
  $headers .= "Content-Transfer-Encoding: base64\r\n";
  $headers .= "Date: " . date('r') . "\r\n";

  $body = chunk_split(base64_encode($html));
  // dot-stuffing safety: ensure no lone "." line
  fwrite($fp, $headers . "\r\n" . $body . "\r\n.\r\n");
  $r = $read();                                    if (!$expect($r, 250)) { fclose($fp); return "send: $r"; }

  $cmd('QUIT');
  fclose($fp);
  return true;
}

$isBooking = ($type === 'booking');
$fmt = function ($n) { return '₹' . number_format($n); };

// ---- Studio notification ----------------------------------------------------
$subject = $isBooking
  ? "New Booking — {$name} · {$date} {$slot}"
  : "New Consultation Enquiry — {$name}";

$rows = '';
$add  = function ($label, $val) use (&$rows) {
  if ($val === '') return;
  $rows .= "<tr><td style=\"padding:6px 14px;color:#8a6a2a;font-weight:600;white-space:nowrap\">{$label}</td>"
         . "<td style=\"padding:6px 14px;color:#222\">{$val}</td></tr>";
};
$add('Name', $name);
$add('Email', $email);
$add('Phone', $phone);
$add('Service', $service);
$add('Date', $date);
$add('Time', $slot);
$add('Message', $message);
if ($isBooking) {
  $add('Consultation Fee', $fmt($FEE_TOTAL));
  $add('Token Paid', $fmt($FEE_TOKEN) . ' (client marked as paid via UPI)');
  $add('Balance Due', $fmt($FEE_BALANCE) . ' (collect at session)');
}

$adminHtml =
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto">'
  . '<h2 style="color:#1a1a1a;border-bottom:2px solid #d4af37;padding-bottom:8px">'
  . ($isBooking ? 'New Session Booking' : 'New Consultation Enquiry') . '</h2>'
  . '<table style="border-collapse:collapse;width:100%;font-size:14px">' . $rows . '</table>'
  . ($isBooking
      ? '<p style="font-size:13px;color:#666;margin-top:18px">Please verify the UPI transaction (shwetasingh7418@oksbi) and confirm the slot with the client.</p>'
      : '<p style="font-size:13px;color:#666;margin-top:18px">Reach out within 24 hours to confirm the appointment.</p>')
  . '</div>';

$result = smtp_send($SMTP_HOST, $SMTP_PORT, $SMTP_USER, $SMTP_PASS,
                    $FROM_EMAIL, $FROM_NAME, $NOTIFY_TO, $email ?: null, $subject, $adminHtml);

if ($result !== true) {
  http_response_code(502);
  echo json_encode(['ok' => false, 'error' => 'send_failed', 'detail' => $result]);
  exit;
}

// ---- Visitor confirmation (best-effort) -------------------------------------
if ($email !== '') {
  $clientHtml =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#222">'
    . '<h2 style="color:#1a1a1a">Namaste ' . $name . ' 🙏</h2>'
    . ($isBooking
        ? '<p>Your session has been reserved. Here are your details:</p>'
          . '<table style="border-collapse:collapse;font-size:14px;margin:10px 0">'
          . '<tr><td style="padding:6px 14px;color:#8a6a2a;font-weight:600">Date</td><td style="padding:6px 14px">' . $date . '</td></tr>'
          . '<tr><td style="padding:6px 14px;color:#8a6a2a;font-weight:600">Time</td><td style="padding:6px 14px">' . $slot . '</td></tr>'
          . '<tr><td style="padding:6px 14px;color:#8a6a2a;font-weight:600">Consultation Fee</td><td style="padding:6px 14px">' . $fmt($FEE_TOTAL) . '</td></tr>'
          . '<tr><td style="padding:6px 14px;color:#8a6a2a;font-weight:600">Token Paid</td><td style="padding:6px 14px">' . $fmt($FEE_TOKEN) . '</td></tr>'
          . '<tr><td style="padding:6px 14px;color:#8a6a2a;font-weight:600">Balance at Session</td><td style="padding:6px 14px">' . $fmt($FEE_BALANCE) . '</td></tr>'
          . '</table>'
          . '<p>Our team will reach out shortly to finalise everything.</p>'
        : '<p>Thank you for reaching out. We have received your enquiry and our team will contact you within 24 hours to confirm your appointment.</p>')
    . '<p style="margin-top:18px;color:#666;font-size:13px">— Nidan Guru<br>+91 6399 105 666 · mail@nidanguru.thenidan.com</p>'
    . '</div>';

  smtp_send($SMTP_HOST, $SMTP_PORT, $SMTP_USER, $SMTP_PASS,
            $FROM_EMAIL, $FROM_NAME, $email, $NOTIFY_TO,
            $isBooking ? 'Your Nidan Guru session is reserved' : 'We received your Nidan Guru enquiry',
            $clientHtml);
}

echo json_encode(['ok' => true]);
