# KadaServe Codebase Documentation

## FOLDER/FILE STRUCTURE OF THIS CODEBASE

```
kadaserve/
├── backend/
│   ├── docs/
│   │   ├── API_DOCUMENTATION.md
│   │   ├── DEMONSTRATION_CHECKLIST.md
│   │   ├── DEMONSTRATION_GUIDE.md
│   │   ├── DOCUMENTATION.md
│   │   ├── FINAL_DEFENSE_REVIEW.md
│   │   └── GROUP_DEFENSE_GUIDE.md
│   ├── seed/
│   │   ├── admin-orders-view.sql
│   │   ├── analytics-daily.sql
│   │   ├── analytics-hourly.sql
│   │   ├── analytics-items.sql
│   │   ├── analytics-weekly.sql
│   │   ├── customer-addresses.sql
│   │   ├── customer-preferences.sql
│   │   ├── delivery-location.sql
│   │   ├── final-menu-items.sql
│   │   ├── order-status-expired.sql
│   │   ├── paymongo-payments.sql
│   │   ├── peak-hour-windows.sql
│   │   ├── rewards.sql
│   │   └── store-settings.sql
│   └── src/
│       ├── README.md
│       ├── app/
│       │   └── api/
│       │       ├── analytics/
│       │       ├── feedback/
│       │       └── orders/
│       └── lib/
│           ├── algorithms/
│           │   ├── preference-scoring.ts
│           │   └── top-n-recommendation.ts
│           ├── services/
│           │   ├── analytics.service.ts
│           │   ├── feedback.service.ts
│           │   └── order.service.ts
│           └── supabase/
│               ├── client.ts
│               └── server.ts
│       └── types/
│           └── database.types.ts
│
├── frontend/
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── sw.js
│   │   └── images/
│   │       ├── logo/
│   │       └── promotions/
│   └── src/
│       ├── app/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── admin/
│       │   ├── api/
│       │   ├── auth/
│       │   ├── customer/
│       │   ├── forgot-password/
│       │   ├── login/
│       │   ├── privacy/
│       │   ├── reset-password/
│       │   ├── signup/
│       │   ├── staff/
│       │   └── terms/
│       ├── components/
│       │   ├── pwa-register.tsx
│       │   └── ui/
│       ├── features/
│       │   ├── admin/
│       │   ├── customer/
│       │   ├── landing/
│       │   └── staff/
│       ├── lib/
│       │   ├── admin-order-totals.ts
│       │   ├── analytics-ranking.ts
│       │   ├── delivery-fee.ts
│       │   ├── email.ts
│       │   ├── recommendations.ts
│       │   ├── store-status.ts
│       │   ├── utils.ts
│       │   ├── orders/
│       │   └── supabase/
│       ├── types/
│       │   ├── cart.ts
│       │   ├── feedback.ts
│       │   ├── menu.ts
│       │   └── orders.ts
│       └── proxy.ts
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── next-env.d.ts
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tsconfig.json
│   ├── README.md
│   └── codex.md
│
├── git/
├── DEMAND_INTELLIGENCE_REDESIGN.md
├── PEAK_HOURS_REDESIGN.md
├── PROJECT_PROGRESS.md
├── README.md
└── skills-lock.json
```

---

## TECH STACK

### Frontend
- **Framework**: Next.js (React 18+)
- **Language**: TypeScript
- **Styling**: CSS (globals.css) + PostCSS
- **Package Manager**: npm
- **PWA**: Service Worker (sw.js) + Web Manifest
- **UI Components**: Custom components with React
- **Features**: 
  - Server & Client Components
  - API Routes
  - Authentication Flow (Login, Signup, Forgot Password, Reset Password)
  - Multi-role support (Customer, Staff, Admin)

### Backend
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **API Routes**: Next.js API Routes (backend/src/app/api/)
- **Services**:
  - Analytics Service
  - Feedback Service
  - Order Service
- **Algorithms**:
  - Preference Scoring
  - Top-N Recommendation Engine
- **Database Client**: Supabase Client & Server SDKs

### Database & Utilities
- **ORM/Client**: Supabase
- **Database Seeding**: SQL scripts for initialization
- **Payment Gateway**: PayMongo integration
- **Authentication**: OAuth/Session-based via Supabase

### Development & Tooling
- **Linting**: ESLint
- **CSS Processing**: PostCSS
- **Build Tool**: Next.js built-in
- **Type Checking**: TypeScript

---

## DESIGN TOKENS

### Color Palette

#### Dark Theme (Primary)
```
--bg-primary:      #090c13    // Main background
--bg-card:         #111520    // Card/surface background
--border:          #1c2336    // Border color
```

#### Semantic Colors
```
--accent-primary:  #22c55e    // Green - Primary actions, success
--accent-warning:  #fb923c    // Orange - Warnings, attention
--accent-danger:   #f87171    // Red - Danger, errors, critical
--accent-highlight: #facc15   // Yellow - Stars, highlights
```

#### Text Colors
```
--text-primary:    #f1f5f9    // Main text
--text-muted:      #94a3b8    // Secondary text
--text-dim:        #4b5675    // Tertiary/placeholder text
```

### Typography
```
Font Family (Primary):   DM Sans
Font Family (Monospace): DM Mono
Font Weights:            400, 500, 600, 700
Line Height:             1.6 (default)
```

### Spacing & Sizing
```
Border Radius:
  - Cards:    12–14px
  - Elements: 8px
  - Buttons:  8px
  - Pills:    20px (rounded)

Padding/Margins (Multiples of 4px or 8px):
  - Page content: 32px
  - Cards: 24px
  - Elements: 16px, 12px, 8px
```

### Transitions & Animations
```
--transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)

Keyframe Animations:
  - fadeUp: 0.6s ease-out (staggered for multiple elements)
  - Hover effects: 0.3s transitions
```

### UI Components Reference

#### Rating Indicators
```
≥ 4.0  → Green (#22c55e)     [Excellent]
3.0–3.9 → Orange (#fb923c)   [Good]
< 3.0  → Red (#f87171)       [Needs Review]
```

#### Icons
- **Source**: Tabler Icons (CDN)
- **Sizing**: 
  - Sidebar icons: 20px
  - Inline icons: 14–18px
  - Large hero icons: Variable

#### Responsive Breakpoints
```
Desktop:   > 1024px
Tablet:    768px – 1024px
Mobile:    < 768px
```

### Shadows & Depth
```
Subtle elevation: 0 2px 8px rgba(0, 0, 0, 0.2)
Focus states: 0 0 0 3px rgba(34, 197, 94, 0.1)
```

---

## Notes

- **Dark Theme Only**: All designs use dark mode as primary theme
- **Accessibility**: All interactive elements have clear hover/focus states
- **Responsive**: Layouts adapt from mobile (52px sidebar) to desktop
- **Font Import**: Google Fonts for DM Sans & DM Mono
- **Icon Library**: Tabler Icons via CDN for consistent iconography
- **CSS Variables**: Root-level CSS custom properties for easy theming
