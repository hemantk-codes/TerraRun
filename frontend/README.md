# TerraRun — Frontend

React (Vite) + Tailwind + React Router. See the [root README](../README.md)
for how to run this alongside the backend.

## Structure

```
src/
  components/   Shared UI (NavBar, PlaceholderPage, ...)
  pages/        One file per route (Map, LoginSignup, Profile, Leaderboard, FriendsChat)
  App.jsx       Route table
  main.jsx      Entry point, wraps App in BrowserRouter
  index.css     Tailwind import + design tokens (@theme block)
```

## Scripts

- `npm run dev` — start the Vite dev server (http://localhost:5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
