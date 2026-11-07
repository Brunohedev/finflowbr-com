# Public homepage iOS layout

## Route and cause
The signed-out root `/` redirects to `/login` (`RootRedirect` → `Login` → `LoginScreen`). The sales video at `/vsl` is not the app's signed-out homepage.

`LoginScreen` positioned demonstration and language controls absolutely at 12px from the page edges, without safe-area offsets. Its centered wrapper used `min-height: 100vh` and only 16px padding, without reserving the navigation row or home-indicator area. The previous safe-area selectors targeted authenticated headers/menus, not this public page.

The viewport already has `viewport-fit=cover`. Capacitor 8's installed native defaults are automatic content inset adjustment `never` and scrolling enabled; project configuration does not override them. No additional native inset is configured. The generated TestFlight WebView cannot be inspected here.

## Scoped correction
- `src/components/LoginScreen.tsx`: add public-page layout hooks to the wrapper and its two existing navigation controls.
- `src/index.css`: iOS WebKit-only rules add top/bottom/landscape safe-area spacing, reserve the navigation row, and use `100dvh` with a `100vh` fallback. Height remains a minimum, so content expands and the document scrolls normally. No fixed-height container or overflow clipping is introduced.
- `AGENTS.md`, `roadmap.md`: document scope and validation tracking.

Content, logo animation, colors, typography, login behavior, dashboard, native configuration and viewport metadata are unchanged. Desktop and Android retain existing styles.

## Validation
Preview compilation succeeded. Browser checks exercised signed-out `/` redirecting to `/login`, login/register mode switching, required-field feedback, language navigation, and scrolling to the final action at 393×852, 375×667, 320×568, 852×393 and a reduced 375×400 viewport. The exact page CSS was exercised with simulated top/bottom/landscape insets: no horizontal overflow, controls below the simulated status bar, content below navigation, and final actions reachable above the home indicator. Screenshots were reviewed. Desktop control positioning remained unchanged.

These are Chromium layout simulations, not physical WKWebView/TestFlight tests; actual device behavior is still unverified.

## Device release check
Update the local project from the connected repository, rebuild the web app, run `npx cap sync ios`, and submit a new TestFlight build. Check signed-out `/` on small and Dynamic Island iPhones, portrait/landscape, login/register, language selection, and scrolling to the final action. Actual status-bar and home-indicator behavior requires this physical-device check.

See the Lovable blog guide on developing native mobile apps with Capacitor for the iOS release workflow.