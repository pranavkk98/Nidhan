import { useState, useEffect } from 'react'

// Booking emails are sent server-side via Resend (api/send-booking.php) so the
// Resend API key is never exposed in the browser bundle.
const BOOKING_API = '/api/send-booking.php'

// Consultation pricing
export const FEE_TOTAL = 6000   // full consultation fee (₹)
export const FEE_TOKEN = 500    // token paid up front to confirm the slot (₹)
export const FEE_BALANCE = FEE_TOTAL - FEE_TOKEN

async function sendBookingEmail(booking) {
  try {
    const res = await fetch(BOOKING_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        type: 'booking',
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        date: booking.date,
        slot: booking.slot,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!data.ok) console.warn('[NidanGuru] Booking email not confirmed:', data)
    return { ok: !!data.ok, data }
  } catch (err) {
    console.error('[NidanGuru] Booking email failed:', err)
    return { ok: false, reason: err?.message || 'network' }
  }
}

const SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getSlotStatuses(date) {
  const seed = date.getFullYear() * 366 + date.getMonth() * 31 + date.getDate()
  // Deterministically pick 2–3 available slots (~70% booked)
  const numAvailable = 2 + (seed % 2)
  const indices = Array.from({ length: 8 }, (_, i) => i)
    .sort((a, b) => {
      const ha = ((seed * (a + 3) * 1009 + a * 37) % 97 + 97) % 97
      const hb = ((seed * (b + 3) * 1009 + b * 37) % 97 + 97) % 97
      return ha - hb
    })
  const available = new Set(indices.slice(0, numAvailable))
  return SLOTS.map((slot, i) => ({ slot, available: available.has(i) }))
}

export default function BookingCalendar({ isOpen, onClose }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [step, setStep] = useState('calendar')
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const slotStatuses = selectedDate ? getSlotStatuses(selectedDate) : []

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDateClick = (day) => {
    const date = new Date(viewYear, viewMonth, day)
    date.setHours(0, 0, 0, 0)
    if (date < today || date.getDay() === 0 || date.getDay() === 6) return
    setSelectedDate(date)
    setSelectedSlot(null)
    setStep('slots')
  }

  const formatDate = (d) => d ? d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }) : ''

  const handleReset = () => {
    setSelectedDate(null)
    setSelectedSlot(null)
    setStep('calendar')
    setForm({ name: '', email: '', phone: '' })
  }

  return (
    <div className="bcal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bcal-modal" role="dialog" aria-modal="true">
        <button className="bcal-close" onClick={onClose} aria-label="Close">✕</button>

        {step === 'calendar' && (
          <div className="bcal-step">
            <p className="section-label" style={{ textAlign: 'center', marginBottom: '0.1rem' }}>✦ Book a Session</p>
            <h2 className="bcal-title">Choose a Date</h2>
            <div className="bcal-meta-row">
              <span>🕘 9 AM – 5 PM</span>
              <span>⏱ 1 Hour / Session</span>
              <span>💰 ₹{FEE_TOTAL.toLocaleString('en-IN')} Fee · ₹{FEE_TOKEN} Token</span>
            </div>

            <div className="bcal-month-nav">
              <button onClick={prevMonth} className="bcal-nav-btn">‹</button>
              <span className="bcal-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="bcal-nav-btn">›</button>
            </div>

            <div className="bcal-grid">
              {DAY_LABELS.map(d => (
                <div key={d} className="bcal-day-header">{d}</div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const date = new Date(viewYear, viewMonth, day)
                date.setHours(0, 0, 0, 0)
                const isPast = date < today
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const disabled = isPast || isWeekend
                return (
                  <button
                    key={day}
                    className={`bcal-day-cell${disabled ? ' bcal-day--disabled' : ' bcal-day--available'}`}
                    onClick={() => !disabled && handleDateClick(day)}
                    disabled={disabled}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <div className="bcal-emergency">
              <span className="bcal-emergency-icon">⚠</span>
              <div>
                <strong>Emergency?</strong> Contact our administration directly —{' '}
                <a href="tel:+916399105666">+91 6399 105 666</a> or{' '}
                <a href="mailto:consult@nidanguru.com">consult@nidanguru.com</a>
              </div>
            </div>
          </div>
        )}

        {step === 'slots' && (
          <div className="bcal-step">
            <button className="bcal-back" onClick={() => setStep('calendar')}>← Back</button>
            <p className="section-label" style={{ textAlign: 'center', marginBottom: '0.1rem' }}>✦ Pick a Time</p>
            <h2 className="bcal-title">Available Slots</h2>
            <p className="bcal-date-pill">{formatDate(selectedDate)}</p>

            <div className="bcal-slots-grid">
              {slotStatuses.map(({ slot, available }) => (
                <button
                  key={slot}
                  className={`bcal-slot${!available ? ' bcal-slot--booked' : selectedSlot === slot ? ' bcal-slot--selected' : ''}`}
                  onClick={() => available && setSelectedSlot(slot)}
                  disabled={!available}
                >
                  <span className="bcal-slot-time">{slot}</span>
                  <span className="bcal-slot-tag">{available ? 'Open' : 'Booked'}</span>
                </button>
              ))}
            </div>

            <button
              className="btn-primary bcal-proceed-btn"
              onClick={() => setStep('form')}
              disabled={!selectedSlot}
            >
              Continue →
            </button>

            <div className="bcal-emergency">
              <span className="bcal-emergency-icon">⚠</span>
              <div><strong>Emergency?</strong> Call <a href="tel:+916399105666">+91 6399 105 666</a></div>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="bcal-step">
            <button className="bcal-back" onClick={() => setStep('slots')}>← Back</button>
            <p className="section-label" style={{ textAlign: 'center', marginBottom: '0.1rem' }}>✦ Your Details</p>
            <h2 className="bcal-title">Almost There</h2>
            <p className="bcal-date-pill">{formatDate(selectedDate)} · {selectedSlot}</p>

            <form className="bcal-form" onSubmit={e => { e.preventDefault(); setStep('payment') }}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  required
                  placeholder="Your full name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  required
                  type="tel"
                  placeholder="+91 00000 00000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary bcal-proceed-btn">
                Proceed to Payment →
              </button>
            </form>
          </div>
        )}

        {step === 'payment' && (
          <div className="bcal-step">
            <p className="section-label" style={{ textAlign: 'center', marginBottom: '0.1rem' }}>✦ Token Payment</p>
            <h2 className="bcal-title">Pay ₹{FEE_TOKEN} to Confirm</h2>
            <p className="bcal-date-pill">{formatDate(selectedDate)} · {selectedSlot}</p>

            <div className="bcal-payment-card">
              <div className="bcal-amount-display">
                <span className="bcal-currency">₹</span>
                <span className="bcal-amount-num">{FEE_TOKEN}</span>
                <span className="bcal-amount-label">Token Fee</span>
              </div>
              <p className="bcal-fee-note" style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted, #777)', margin: '-0.25rem 0 0.5rem' }}>
                Total consultation fee <strong>₹{FEE_TOTAL.toLocaleString('en-IN')}</strong> — pay the
                <strong> ₹{FEE_TOKEN}</strong> token now to confirm your slot. Balance of
                <strong> ₹{FEE_BALANCE.toLocaleString('en-IN')}</strong> is collected at the session.
              </p>
              <div className="bcal-upi-section">
                <p className="bcal-upi-note">Scan the QR with any UPI app to pay</p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '0.75rem 0 1rem',
                  }}
                >
                  <img
                    src="/qr-payment.jpg"
                    alt={`UPI Payment QR — ₹${FEE_TOKEN} to shwetasingh7418@oksbi`}
                    style={{
                      width: '100%',
                      maxWidth: '260px',
                      height: 'auto',
                      borderRadius: '14px',
                      background: '#fff',
                      padding: '10px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                  />
                </div>
                <div className="bcal-upi-id">
                  <span className="bcal-upi-label">UPI ID</span>
                  <span className="bcal-upi-value">shwetasingh7418@oksbi</span>
                </div>
                <p className="bcal-upi-sub">Google Pay · PhonePe · Paytm · BHIM</p>
              </div>
            </div>

            <button
              className="btn-primary bcal-proceed-btn"
              disabled={confirming}
              onClick={async () => {
                if (confirming) return
                setConfirming(true)
                if (typeof gtag === 'function') gtag('event', 'booking_confirmed', {})
                await sendBookingEmail({
                  name: form.name,
                  email: form.email,
                  phone: form.phone,
                  date: formatDate(selectedDate),
                  slot: selectedSlot,
                })
                setConfirming(false)
                setStep('success')
              }}
            >
              {confirming ? 'Confirming…' : "I've Paid — Confirm Booking"}
            </button>

            <div className="bcal-emergency">
              <span className="bcal-emergency-icon">⚠</span>
              <div>
                <strong>Emergency?</strong> Call admin —{' '}
                <a href="tel:+916399105666">+91 6399 105 666</a>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="bcal-step bcal-step--success">
            <div className="bcal-success-check">✓</div>
            <h2 className="bcal-title">Booking Confirmed!</h2>
            <p className="bcal-subtitle">{form.name}, your session has been reserved.</p>

            <div className="bcal-summary-box">
              <div className="bcal-summary-row">
                <span>Date</span>
                <strong>{formatDate(selectedDate)}</strong>
              </div>
              <div className="bcal-summary-row">
                <span>Time</span>
                <strong>{selectedSlot}</strong>
              </div>
              <div className="bcal-summary-row">
                <span>Consultation Fee</span>
                <strong>₹{FEE_TOTAL.toLocaleString('en-IN')}</strong>
              </div>
              <div className="bcal-summary-row">
                <span>Token Paid</span>
                <strong>₹{FEE_TOKEN}</strong>
              </div>
              <div className="bcal-summary-row">
                <span>Balance at Session</span>
                <strong>₹{FEE_BALANCE.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <p className="bcal-confirm-note">
              A confirmation will be sent to <strong>{form.email}</strong>.{' '}
              Our team will reach out within 2 hours.
            </p>

            <div className="bcal-success-btns">
              <button className="btn-primary" style={{ width: '100%', cursor: 'pointer', fontFamily: 'var(--sans)' }} onClick={onClose}>
                Done
              </button>
              <button className="bcal-back" onClick={handleReset}>Book Another Session</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
