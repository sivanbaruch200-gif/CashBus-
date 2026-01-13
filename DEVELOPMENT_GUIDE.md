# CashBus - Development Guide

## Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Git (optional, for version control)

### Installation Steps

1. **Install Dependencies**
```bash
npm install
```

2. **Run Development Server**
```bash
npm run dev
```

3. **Open Browser**
Navigate to [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
CashBus-Project/
├── app/
│   ├── page.tsx              # Main Dashboard page
│   ├── layout.tsx            # Root layout with RTL config
│   └── globals.css           # Global styles & Tailwind
│
├── components/
│   ├── MyAccountWidget.tsx   # Financial summary widget
│   ├── PanicButton.tsx       # Incident reporting button
│   └── StatusLight.tsx       # GPS verification indicator
│
├── plans/
│   └── phase-1-setup.md      # Phase 1 technical details
│
├── CLAUDE.md                 # Project memory & context
├── MASTER_PLAN.md            # High-level roadmap
├── README.md                 # Project overview
│
├── package.json              # Dependencies
├── tailwind.config.js        # Tailwind customization
├── tsconfig.json             # TypeScript config
└── next.config.js            # Next.js config (i18n, RTL)
```

---

## Key Components

### 1. MyAccountWidget
**Location:** [components/MyAccountWidget.tsx](components/MyAccountWidget.tsx)

**Purpose:** Display user's financial summary

**Props:**
- `receivedAmount: number` - Total compensation received
- `potentialAmount: number` - Pending compensation amount

**Features:**
- Gradient orange background
- Wallet icon with savings visualization
- Progress bar showing received vs potential
- Animated transitions
- Hebrew number formatting

**Usage:**
```tsx
<MyAccountWidget
  receivedAmount={1250}
  potentialAmount={3400}
/>
```

---

### 2. PanicButton
**Location:** [components/PanicButton.tsx](components/PanicButton.tsx)

**Purpose:** Allow users to report incidents in real-time

**Props:**
- `onPress: () => void` - Callback when button is pressed

**Features:**
- Large circular design (264px)
- Pulse animation ring
- Disabled state after press (3 seconds)
- Visual feedback (scale animation)
- Hebrew instruction text

**States:**
- Idle: "האוטובוס לא הגיע / לא עצר"
- Pressed: "מתעד..."

**Usage:**
```tsx
<PanicButton onPress={() => handleIncidentReport()} />
```

---

### 3. StatusLight
**Location:** [components/StatusLight.tsx](components/StatusLight.tsx)

**Purpose:** Show GPS verification status

**Props:**
- `status?: 'checking' | 'verified' | 'failed' | 'idle'`

**Visual States:**

| Status    | Color  | Icon       | Text                |
|-----------|--------|------------|---------------------|
| idle      | Gray   | Satellite  | ממתין לאימות GPS     |
| checking  | Yellow | Loader     | מאמת מיקום GPS...   |
| verified  | Green  | CheckCircle| מיקום מאומת ✓       |
| failed    | Red    | XCircle    | אימות נכשל          |

**Usage:**
```tsx
<StatusLight status="verified" />
```

---

## Styling System

### Color Palette

```javascript
// Primary Colors
primary-orange: #FF8C00  // Main CTA color
primary-navy: #1E3A8A    // Trust/secondary color
primary-white: #FFFFFF   // Background

// Status Colors
status-pending: #FCD34D   // Yellow
status-approved: #10B981  // Green
status-rejected: #EF4444  // Red
status-legal: #6366F1     // Blue
status-verified: #10B981  // Green
```

### Tailwind Utility Classes

**Custom Classes:**
```css
.btn-primary         // Orange button with shadow
.btn-secondary       // White button with orange border
.card                // White card with shadow
.status-badge        // Base badge style
.status-badge-pending   // Yellow badge
.status-badge-approved  // Green badge
.status-badge-rejected  // Red badge
.status-badge-legal     // Blue badge
```

**Usage Example:**
```tsx
<button className="btn-primary">
  שלח תביעה
</button>

<div className="card">
  <span className="status-badge status-badge-approved">
    אושר
  </span>
</div>
```

---

## RTL (Right-to-Left) Support

### Global RTL Configuration

**Configured in:**
- [app/layout.tsx](app/layout.tsx#L15): `<html lang="he" dir="rtl">`
- [app/globals.css](app/globals.css#L4-6): `* { direction: rtl; }`
- [next.config.js](next.config.js#L4-7): i18n locale set to 'he'

### Hebrew Font
Using **Assistant** from Google Fonts - excellent Hebrew support.

```css
font-family: 'Assistant', system-ui, sans-serif;
```

### Number Formatting
```tsx
amount.toLocaleString('he-IL')  // 1,250 → ‏1,250
```

---

## Development Workflow

### 1. Adding a New Component

```bash
# Create component file
touch components/YourComponent.tsx

# Import in page
import YourComponent from '@/components/YourComponent'
```

**Component Template:**
```tsx
'use client'

interface YourComponentProps {
  // Props here
}

export default function YourComponent({ }: YourComponentProps) {
  return (
    <div className="card">
      {/* Component content */}
    </div>
  )
}
```

### 2. Adding a New Page

```bash
# Create page in app directory
mkdir app/your-page
touch app/your-page/page.tsx
```

**Page Template:**
```tsx
export default function YourPage() {
  return (
    <div>
      <h1>Your Page Title</h1>
    </div>
  )
}
```

### 3. Updating Styles

**Global styles:**
Edit [app/globals.css](app/globals.css)

**Tailwind config:**
Edit [tailwind.config.js](tailwind.config.js)

**Run dev server to see changes:**
```bash
npm run dev
```

---

## State Management

### Current Approach
Using React `useState` hooks for local component state.

**Example (from Dashboard):**
```tsx
const [verificationStatus, setVerificationStatus] = useState<'idle'>('idle')
```

### Future Approach (Phase 2+)
- Supabase for backend state
- React Context for global state
- Zustand/Jotai for complex state management

---

## API Integration (Future)

### Planned Integrations

#### 1. Ministry of Transportation API (SIRI/GTFS-RT)
**Purpose:** Verify bus locations and schedules
**Endpoint:** TBD
**Data:**
- Real-time bus positions
- Station schedules
- Route information

#### 2. Supabase Database
**Purpose:** Store user data, incidents, claims
**Tables:**
- Users
- Incidents
- Claims
- Legal_Documents
- Admin_Users

See [plans/phase-1-setup.md](plans/phase-1-setup.md#31-database-schema-design) for full schema.

---

## Testing

### Manual Testing Checklist

**Dashboard:**
- [ ] My Account widget displays correctly
- [ ] Numbers format with Hebrew locale
- [ ] Panic button triggers GPS check
- [ ] Status light changes colors
- [ ] Recent activity cards display
- [ ] Mobile responsive (375px, 768px, 1024px)

**RTL:**
- [ ] Hebrew text aligns right
- [ ] Icons position correctly in RTL
- [ ] Flex layouts reverse properly

**Interactions:**
- [ ] Buttons respond to clicks
- [ ] Hover states work
- [ ] Animations smooth (60fps)

---

## Building for Production

```bash
# Build optimized production bundle
npm run build

# Run production server
npm start
```

### Deployment Options

**Recommended:**
- **Vercel** (Next.js native support)
- **Netlify** (Good for static exports)

**Environment Variables (Future):**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_MOT_API_KEY=ministry_of_transport_key
```

---

## Performance Optimization

### Current Optimizations
- Tailwind CSS purges unused styles
- Next.js automatic code splitting
- React Server Components (App Router)
- Image optimization with next/image (ready to use)

### Future Optimizations
- Lazy loading for modals/forms
- Route prefetching
- Database query optimization
- CDN for static assets

---

## Accessibility (a11y)

### Current Implementation
- Semantic HTML elements
- Color contrast meets WCAG AA
- Keyboard navigation support (native buttons)

### Future Enhancements
- ARIA labels for complex interactions
- Screen reader testing
- Focus management for modals
- Reduced motion support

---

## Common Tasks

### Change Primary Color
Edit [tailwind.config.js](tailwind.config.js#L10-12)
```javascript
primary: {
  orange: '#YOUR_COLOR_HERE',
}
```

### Add New Icon
```tsx
import { IconName } from 'lucide-react'

<IconName className="w-6 h-6 text-primary-orange" />
```

[Browse all icons](https://lucide.dev/)

### Format Currency
```tsx
const formattedAmount = `₪${amount.toLocaleString('he-IL')}`
```

### Add New Status Badge
```css
/* In globals.css */
.status-badge-your-status {
  @apply bg-purple-100 text-purple-800;
}
```

---

## Troubleshooting

### Issue: Tailwind styles not applying
**Solution:**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Issue: Hebrew text displays as ???
**Solution:** Ensure Google Fonts loaded in [app/globals.css](app/globals.css#L1)

### Issue: RTL not working
**Solution:** Check `dir="rtl"` in [app/layout.tsx](app/layout.tsx#L15)

### Issue: Port 3000 already in use
**Solution:**
```bash
# Kill process on port 3000
npx kill-port 3000

# Or run on different port
npm run dev -- -p 3001
```

---

## Next Steps

### Immediate (Phase 1 Continuation)
1. Create Login/Registration form
2. Create Quick Submit incident form
3. Set up Supabase database
4. Implement routing between pages

### Phase 2
1. User authentication system
2. GPS permission requests
3. Camera integration for evidence photos
4. Push notifications setup

See [MASTER_PLAN.md](MASTER_PLAN.md) for full roadmap.

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

---

## Support

For project questions, refer to:
- [CLAUDE.md](CLAUDE.md) - Project memory
- [MASTER_PLAN.md](MASTER_PLAN.md) - Roadmap
- [plans/phase-1-setup.md](plans/phase-1-setup.md) - Technical details

---

**Last Updated:** 2026-01-03
**Version:** 1.0
