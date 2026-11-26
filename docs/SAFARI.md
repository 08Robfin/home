# Safari Home Screen app

Home uses HTTPS, a stable manifest identity, standalone display, app icons, safe-area padding and a service worker. API data and receipts stay outside the offline cache. These are implementation choices, not a claim that browser testing replaces a real iPhone check.

## Install and enable notifications

1. Open Home in Safari and choose Share → Add to Home Screen.
2. Keep Open as Web App enabled when that option is shown, then add it.
3. Launch Home from the new icon and sign in if needed.
4. Open Settings → Notifications. Choose chores/payments, lead time and time. More options contains time zone and overdue reminders. Save the settings.
5. Tap Enable on this device and allow the system prompt. Tap Send test notification, then check it with Home closed or backgrounded.

Web Push requires iOS/iPadOS 16.4+ and a Home Screen installation. Permission must follow a tap, so Home never prompts on launch. If permission was denied, use the system's notification settings to allow Home, then reopen it. Each browser installation needs its own subscription. Email remains a separate option.

Notifications are a daily summary, not an exact alarm. Connectivity, Focus/Do Not Disturb, notification settings and OS delivery policies can delay or suppress presentation. Private details appear only after opening the app. A failed test should not be described as successful delivery merely because a provider accepted it.

## Device verification before claiming iPhone support is fully tested

- Install, cold launch, background and reopen; confirm sign-in and selected household survive normal relaunch.
- Inspect light/dark/system appearance, portrait/landscape safe areas and the home indicator. Check the dock stays fixed across all tabs and never covers the last item after scrolling.
- Open forms with the keyboard visible; confirm focused input and save/cancel actions remain reachable, touch pinch/double-tap zoom is suppressed as requested and text inputs do not unexpectedly zoom.
- Navigate with VoiceOver and larger text. Check labels, selected states, focus return and dialog dismissal.
- Enable from a tap, receive a test while backgrounded/closed, tap to reopen Home and inspect blocked permission. Disable, sign out and reset password; verify subscriptions are revoked as documented.
- Save a near-future reminder schedule using synthetic data; verify the correct channel/category, local time and lead date, with no repeated scheduling after worker restart.
- Disconnect the network. Confirm the public shell can load after an online visit, private records are not cached and writes fail honestly. Reconnect and verify refresh.
- Leave a form open during a new release. Confirm an explicit reload prompt appears and the form is not replaced automatically. Reload and verify the new version.

Automated coverage includes the RFC encryption vector, signature verification, tenant/subscription isolation, timing, DST, retries and expiry. Chromium viewport checks cover 320 px and ordinary phone widths. Physical iPhone/APNs delivery remains unverified until a maintainer performs the above device checks. Never use residents' real data or publish their notification previews as evidence.

## Primary references

- [WebKit: Web Push on iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit: Safari 26 Home Screen changes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [WebKit: safe-area layout](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Apple: sending Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [web.dev: service-worker updates](https://web.dev/learn/pwa/service-workers)

## Fixed-scale mobile layout — 26 November 2026

The owner explicitly requested vertical-only navigation and disabled touch zoom. The viewport is fixed at scale 1, scroll surfaces use pan-y, and Safari gesture handlers suppress pinch zoom. Form controls use at least 16 px text to avoid focus-triggered zoom. The OS/browser may retain accessibility zoom overrides; page code cannot promise to disable those. Menus constrain width, wrap long content and scroll vertically within the visible keyboard-adjusted viewport. The mobile header has 12 px extra top clearance beyond its previous safe-area padding.

Send test notification is visible in the push section before subscription; its tap requests permission when necessary and then queues an encrypted server-worker test. Unsupported or non-installed iPhone browsers show installation guidance instead.
