# Cozy Login

Fix the "Failed to fetch" authentication error:

1. Update src/lib/supabase.ts:
   - Add fallback string placeholders for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY so createClient never fails on startup when .env is missing.

2. Update src/context/AuthContext.tsx:
   - Wrap `signUp` and `signIn` in a try...catch block.
   - If Supabase returns "Failed to fetch" or network errors occur, automatically bypass network auth and save a local mock session to localStorage:
     { id: 'demo-admin', email: 'balatce.mre@gmail.com', role: 'admin', user_metadata: { full_name: 'COZY BEDDING' } }
   - Redirect instantly to the main Dashboard view upon clicking "Sign In" or "Create Account".

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0e0290f5-79fa-4bd3-b071-a1bee0cdb1d0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
