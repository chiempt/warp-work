/**
 * Marks for the sources Warp actually ingests from — context doc §4.
 *
 * Only the connectors with a documented API appear here. Zalo personal, Facebook
 * personal messages, and Instagram personal have no marks because they have no adapter,
 * and a logo on a login screen is the fastest way to imply a capability that will never
 * ship.
 *
 * Manual entry is drawn as a glyph rather than a logo: it is a path into Warp, not a
 * vendor, and it is the one source every context is guaranteed to have.
 */

export function GmailMark() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Gmail" className="size-full">
      <path
        fill="#EA4335"
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
      />
    </svg>
  )
}

export function CalendarMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Google Calendar"
      className="size-full"
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="3"
        fill="#fff"
        stroke="#4285F4"
        strokeWidth="2.5"
      />
      <text
        x="12"
        y="17.4"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#4285F4"
      >
        31
      </text>
    </svg>
  )
}

/** Google Drive — the official three-plane mark. */
export function DriveMark() {
  return (
    <svg
      viewBox="0 0 87.3 78"
      role="img"
      aria-label="Google Drive"
      className="size-full"
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  )
}

/** Zalo Official Account. Business accounts only — the personal app has no API. */
export function ZaloOaMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Zalo Official Account"
      className="size-full"
    >
      <rect width="24" height="24" rx="6" fill="#0068FF" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#fff"
      >
        Zalo
      </text>
    </svg>
  )
}

/** Facebook Page inbox — Messenger conversations addressed to a Page. */
export function MessengerMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Facebook Page inbox"
      className="size-full"
    >
      <radialGradient
        id="warp-messenger-gradient"
        cx="11.087"
        cy="7.022"
        r="47.612"
        gradientTransform="matrix(1 0 0 -1 0 50)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#1292ff" />
        <stop offset=".351" stopColor="#6559ff" />
        <stop offset=".754" stopColor="#df47aa" />
        <stop offset=".946" stopColor="#ff6257" />
      </radialGradient>
      <path
        fill="url(#warp-messenger-gradient)"
        d="M44,23.5C44,34.27,35.05,43,24,43c-1.651,0-3.25-0.194-4.784-0.564c-0.465-0.112-0.951-0.069-1.379,0.145L13.46,44.77C12.33,45.335,11,44.513,11,43.249v-4.025c0-0.575-0.257-1.111-0.681-1.499C6.425,34.165,4,29.11,4,23.5C4,12.73,12.95,4,24,4S44,12.73,44,23.5z"
      />
      <path
        fill="#fff"
        d="M34.394,18.501l-5.7,4.22c-0.61,0.46-1.44,0.46-2.04,0.01L22.68,19.74c-1.68-1.25-4.06-0.82-5.19,0.94l-1.21,1.89l-4.11,6.68c-0.6,0.94,0.55,2.01,1.44,1.34l5.7-4.22c0.61-0.46,1.44-0.46,2.04-0.01l3.974,2.991c1.68,1.25,4.06,0.82,5.19-0.94l1.21-1.89l4.11-6.68C36.434,18.901,35.284,17.831,34.394,18.501z"
      />
    </svg>
  )
}
