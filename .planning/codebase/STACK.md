# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- TypeScript 5 - Full codebase (frontend and backend)
- CSS/Tailwind - Styling

**Secondary:**
- SQL - Database queries and schema (PostgreSQL via Supabase)

## Runtime

**Environment:**
- Node.js (latest stable via Next.js 15)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 15.5.12 - Full-stack framework with App Router
- React 19.0.0 - UI components
- TypeScript 5 - Type safety

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS
- autoprefixer 10.4.24 - CSS vendor prefixes

**Content & Rendering:**
- react-markdown 10.1.0 - Markdown parsing and rendering for articles

**Authentication & Security:**
- jose 5.9.6 - JWT signing and verification (HS256)
- bcryptjs 3.0.3 - Password hashing (12 salt rounds)

**UI & Icon Library:**
- lucide-react 0.471.0 - SVG icon components

**Utility:**
- clsx 2.1.1 - Conditional CSS class names

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.47.10 - PostgreSQL database client with service role authentication
- jose 5.9.6 - JWT token signing/verification for session management
- bcryptjs 3.0.3 - Password hashing for contributor accounts

**Infrastructure:**
- next 15.5.12 - Production-ready full-stack framework
- react 19.0.0 - Component rendering engine
- typescript 5 - Type checking and compilation
- tailwindcss 3.4.1 - CSS generation from utility classes

## Development Tools

**Linting & Formatting:**
- eslint 9 - Code quality checking
- eslint-config-next 15.1.7 - Next.js-specific ESLint rules

**Build & Dev:**
- PostCSS 8 - CSS transformation pipeline
- autoprefixer 10.4.24 - Browser compatibility

**Type Definitions:**
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - ReactDOM type definitions
- @types/bcryptjs 2.4.6 - bcryptjs type definitions

## Configuration

**TypeScript:**
- Path aliases: `@/*` maps to project root (defined in `tsconfig.json`)
- Strict mode: enabled
- Target: ES2017
- Module: ESNext

**Next.js:**
- Config: `next.config.ts`
- Image remote patterns: `drive.google.com` (Google Drive thumbnails)
- App Router: used (no Pages Router)

**Tailwind:**
- Config: `tailwind.config.ts`
- Content paths: `./pages/**`, `./components/**`, `./app/**`
- Custom colors: navy color palette (navy.50 through navy.900)

**Build Output:**
- Compiled to `.next/` directory
- TypeScript incremental compilation enabled
- Next.js plugins configured

## Environment

**Required Environment Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role API key (server-side only)
- `CAPTAIN_PASSWORD` - Single password for captain login (plaintext, environment-based)
- `AUTH_SECRET` - Random 32+ character string for JWT signing (generate with `openssl rand -base64 32`)
- `INVITE_CODE` - Invite code for new contributor registration

**Environment Config File:**
- `.env.local` - Development and production secrets
- `.env.local.example` - Template with required variables

**Node Environment Detection:**
- `process.env.NODE_ENV === 'production'` - Used for secure cookie flag

## Platform Requirements

**Development:**
- Node.js (tested with latest stable)
- npm (for dependency management)
- Supabase account with project (free tier sufficient)

**Production:**
- Node.js 18+ (Next.js 15 requirement)
- Deployment target: Vercel (recommended), any Node.js hosting (Docker compatible)
- PostgreSQL database: Supabase provides managed PostgreSQL
- SSL/HTTPS: Required for secure cookie transmission in production

## Database

**Primary Storage:**
- PostgreSQL via Supabase
- Connection: Service role key authentication (server-side only)
- Client: `@supabase/supabase-js` v2.47.10
- Configuration: `lib/supabase.ts` with Supabase JS client

**Schema:**
- Database initialization: `supabase-schema.sql` (initial schema)
- Migrations: `supabase-migration-qa-replies.sql` (incremental updates)
- Tables: sessions, comments, reference_videos, reference_folders, users, articles

---

*Stack analysis: 2026-03-10*
