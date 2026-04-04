# Osiris Mobile — Claude Instructions

## What This Is
Mobile app (iOS + Android) for **Osiris**, a multi-tenant SaaS platform for cleaning service businesses. This app replicates the FULL dashboard experience currently at https://spotless-scrubbers-api.vercel.app/ — it is a frontend-only app that calls the existing backend APIs. There is NO backend code in this repo.

## Reference Codebase
The existing web app lives at: https://github.com/MrSpotlessOneMil/winbrostest
- Branch to reference: `Test`
- Study the dashboard pages in `app/(dashboard)/` to understand every screen
- Study the API action routes in `app/api/actions/` to understand every API call
- Study the components in `components/` to understand UI patterns and data shapes
- The mobile app should call the SAME API endpoints — do not rebuild backend logic

## Tech Stack (STRICT)
- **Expo** (managed workflow) with **React Native**
- **TypeScript** (strict mode)
- **Expo Router** for navigation (file-based routing, similar to Next.js App Router)
- **NativeWind** (Tailwind for React Native) for styling
- **Supabase JS client** (`@supabase/supabase-js`) for auth (login/session) and any direct DB reads that the web app does client-side
- **React Query** (`@tanstack/react-query`) for server state / API caching
- **Expo SecureStore** for token storage
- **React Native Calendars** or similar for calendar view
- Do NOT use: Redux, MobX, Styled Components, or any CSS-in-JS besides NativeWind

## API Base URL
All API calls go to: `https://spotless-scrubbers-api.vercel.app/api/`
- Action routes: `/api/actions/{action-name}`
- The web app authenticates via Supabase Auth (email/password) — the mobile app should do the same
- After login, include the Supabase session token in API requests as the web app does
- Study `lib/auth.ts` in the web repo to understand how `requireAuthWithTenant()` works — mobile requests must send the same headers

## Screens to Build (mirrors web dashboard)
Each screen should match the FUNCTIONALITY of the web version (not pixel-perfect, but same features):

1. **Login** — email/password via Supabase Auth (see `app/login/page.tsx`)
2. **Overview** — stats dashboard (see `app/(dashboard)/overview/`)
3. **Customers** — customer list, message history, send SMS (see `app/(dashboard)/customers/`)
4. **Leads** — lead pipeline and management (see `app/(dashboard)/leads/`)
5. **Calendar/Jobs** — job scheduling calendar view (see `app/(dashboard)/jobs/`)
6. **Teams** — Telegram messages to cleaners, message history (see `app/(dashboard)/teams/`)
7. **Assistant** — AI chat assistant (see `app/(dashboard)/assistant/`)
8. **Inbox** — unified inbox (see `app/(dashboard)/inbox/`)
9. **Campaigns** — marketing campaigns (see `app/(dashboard)/campaigns/`)
10. **Earnings** — revenue tracking (see `app/(dashboard)/earnings/`)
11. **Admin** — tenant management, settings (see `app/(dashboard)/admin/`)

### Lower priority (build after core screens):
- Quotes, Retargeting, Memberships, Leaderboard, Insights, Rain Day, Calls, Exceptions

## Navigation Structure
- Bottom tab bar for main sections: Overview, Customers, Calendar, Teams, More
- "More" tab opens a menu for: Leads, Assistant, Inbox, Campaigns, Earnings, Admin
- Stack navigation within each tab for detail screens (e.g., Customer → Customer Detail → Message Thread)

## Multi-Tenancy
- The logged-in user has a `tenant_id` — the API uses this to scope all data
- The app does NOT need tenant switching UI unless the user is an admin
- Admin users may manage multiple tenants — mirror the web admin panel

## Git Workflow (STRICT)
- Initialize a new git repo in this folder
- Create a GitHub repo called `osiris-mobile` under the `MrSpotlessOneMil` org
- Work on a `dev` branch, NOT `main`
- Commit and push after completing each screen or meaningful feature
- Commit messages: lowercase, imperative mood (e.g., "add customer list screen", "wire up calendar API")
- Push to remote after every commit — never leave changes local

## Build & Run
- Use `npx expo start` for development
- Test on iOS Simulator and Android Emulator
- Use Expo Go on physical devices for quick testing
- Target: iOS 15+ and Android API 28+

## Code Conventions
- Functional components only, no class components
- Use hooks for all state and effects
- File structure:
app/                  # Expo Router screens (file-based routing)
(tabs)/             # Tab layout
overview.tsx
customers/
index.tsx
[id].tsx
calendar.tsx
teams.tsx
more.tsx
login.tsx
components/           # Reusable components
ui/                 # Base UI components (buttons, inputs, cards)
customers/          # Customer-specific components
calendar/           # Calendar-specific components
lib/                  # Utilities
supabase.ts         # Supabase client setup
api.ts              # API client (fetch wrapper with auth headers)
auth.ts             # Auth context and hooks
types/                # TypeScript interfaces (mirror from web app)
constants/            # Colors, config, API URLs


- Extract API call functions into `lib/api.ts` — screens should not contain raw fetch calls
- Type everything — copy relevant interfaces from the web app's types

## Environment Variables
Use `expo-constants` and `app.config.ts`:
EXPO_PUBLIC_API_URL=https://spotless-scrubbers-api.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://kcmbwstjmdrjkhxhkkjt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbWJ3c3RqbWRyamtoeGhra2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzU0MDYsImV4cCI6MjA4NTE1MTQwNn0.W-8q1Frms6Octc2YETZjK2_9lgpUm4tlIt7brMZ5ZX8



## What NOT to Build
- No backend/API routes — those already exist in the web app
- No webhook handlers — those run server-side
- No cron jobs — those run on Vercel
- No payment processing logic — just link to Stripe checkout URLs returned by the API
- No SMS sending logic — call the existing `/api/actions/send-sms` endpoint

## Quality Bar
- Every screen must handle: loading states, empty states, error states, pull-to-refresh
- Offline: show cached data when available, queue actions for retry
- Responsive to different phone sizes (iPhone SE through Pro Max, various Android sizes)
- Haptic feedback on key actions (submit, delete, assign)
- Dark mode support from day one (use NativeWind dark: variants)