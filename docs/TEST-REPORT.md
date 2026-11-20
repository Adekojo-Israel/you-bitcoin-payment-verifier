# YOU test report

## Settings structure and profile update

Started from the latest workspace ZIP, `YOU-Onboarding.zip`. Changes were limited to Settings, the two existing tour entry points, the local profile image helper, tests and docs. The Bitcoin module, API paths, CSP policy and dependency lock are unchanged. The build refreshed the inline script hash.

| Check | Result |
|---|---|
| Settings order and separation | **Passed** at 320×640, 390×844, 768×1024 and 1366×900 in Chromium. The six headings are in the requested order. Profile starts in view mode with its editor fields hidden and disabled. Appearance radios stay visible outside Profile and its form. No horizontal overflow was detected on the exercised Settings screens. |
| Profile lifecycle | **Passed** at all four sizes. A legacy profile name loaded. Clicking Edit Profile enabled only name and picture inputs. A valid PNG was decoded and resized locally, the saved name and picture survived reload, and Cancel restored the saved name and photo. An invalid picture showed an error. A blocked profile write left the form open and did not change persisted data. |
| Appearance and network independence | **Passed.** Dark and Light applied without a save. System followed emulated device changes. Appearance persisted after reload. Changing a theme did not unlock Profile or write its draft. Saving Profile left the theme/network storage unchanged. The network save button was tested separately, including blocked writes. |
| Tour, existing browser paths and local flow | **Passed.** Both Settings tour links opened the existing tour. The full onboarding, wallet/QR, clipboard, saved-check and live historical Signet and Testnet 4 browser suites passed. The isolated Bitcoin Core CLI and browser regtest runs accepted and mined a locally signed sweep. No public sweep was sent. |
| Build | **Passed.** All 14 unit tests, JavaScript syntax, HTML5 parse, build and structure/CSP checks (120 unique IDs). `npm audit` reported no known vulnerabilities in this run. |

**Not tested for this update:** physical phones, real screen reader announcements, Safari or Firefox, selecting every supported image format, a public deployment, or a fresh public Signet sweep. The successful photo test used PNG in Chromium. Browser testing used desktop Chromium and emulated mobile sizes. Profile pictures are local, unencrypted and not synced.

## Onboarding and settings update

This build extends the latest workspace archive, `YOU-Polished.zip`. It preserves the earlier verification, Receive, Send Check, checklist, offline Demo, wallet and saved-check features. No new dependency or API was added. The Bitcoin validation/signing module, package lock and CSP policy template are unchanged. The build regenerated the script hash. The existing inline bundle now starts in the head so the saved theme is applied before the body appears.

| Check | Result |
|---|---|
| First visit and replay | **Passed.** Chromium showed the short logo animation before Welcome when motion was allowed. Reduced-motion mode showed Welcome without the animation. The six steps, live targets, Back, keyboard activation, Skip, Escape, completion, reload suppression and replay from Settings passed. |
| Profile and layout | **Passed.** At 320×640, 390×844, 768×1024 and 1366×900, tests checked that the tour popover stayed in bounds and did not cover its highlighted target. The real Settings button opened through the overlay. Its name, expansion state, focus tooltip and 44 px target were checked. No horizontal overflow was detected in the exercised paths. Smaller viewports used Chromium touch/mobile emulation. |
| Theme and save | **Passed.** Dark and Light applied on selection, without pressing Save Settings. System responded to device preference changes. The selected theme survived reload and the tour adopted dark colours. Save Settings showed **Saved** only after a successful write, reset on edits, and retained the profile name and network on reload. Simulated blocked writes showed an honest failure while the theme still applied for the current visit. |
| Existing app | **Passed.** All 14 unit tests and the existing Chromium and saved-check suites. Live historical Signet and Testnet 4 reads ran. A fresh isolated Bitcoin Core regtest run passed the CLI and browser signing/broadcast checks. The standalone HTML ran an offline tour and demo with emulated touch. |
| Build and packaging | **Passed.** Dependency install, syntax and HTML5 parse, production build, structure/CSP checks (95 unique IDs), and package audit. The audit reported no known vulnerabilities at test time. |

**Not tested in this update:** physical devices, real screen reader announcements, Safari or Firefox, a permanent public deployment, and a fresh public Signet sweep. The accessible names, keyboard interactions, focus, and tooltip roles were checked in Chromium, not with a screen reader. If a browser prevents local storage, tour completion and theme choices cannot be remembered on reload. No public test transaction or mainnet payment was sent.

## Saved checks and visual polish

The starting point was `YOU-Verified.zip`. The Bitcoin validation and signing module, explorer request code, CSP policy template, package manifest and lockfile did not change. The build refreshed its script hash to match the changed inline JavaScript. It still embeds all code and styling, including the existing Bitcoin and QR libraries. The app downloads no external fonts, images or scripts.

| Check | Result |
|---|---|
| Installation, syntax, build and CSP | **Passed.** `npm ci`, `node --check`, `npm run build`, `npm run check` and `npm audit` completed. No known dependency vulnerabilities were reported. The build had 82 unique HTML IDs with no missing literal references. Its script matches the CSP hash. An HTML5 parser found no errors in the template or generated file. |
| Unit tests | **Passed.** 14 of 14: the original 11 and three new tests for the 20-entry cap across both networks, newest-first ordering, duplicate queries and corrupt or extra data. |
| Saved checks, guide and copy | **Passed** in Chromium with routed explorer fixtures. No result was saved until an explicit click. Reload, network groups, deduplication, removal, clear, fill-only Recheck, address-only queries retaining a blank transaction ID, malformed or blocked storage, guide dismissal and persistence, and the plain-text clipboard summary all passed. The browser recorded no additional external requests for these local actions. |
| Existing browser paths | **Passed** in Chromium at 320×640, 390×844, 768×1024 and 1366×900. Live historical Signet and Testnet 4 reads ran without `SKIP_LIVE`. The existing navigation, theme, wallet, QR, errors and offline demo checks also passed. The standalone file ran an offline demo with emulated touch. |
| Signing and broadcast | **Passed.** CLI and browser tests ran with a fresh isolated Bitcoin Core regtest datadir. The signed sweep was accepted and mined locally, only after an explicit browser broadcast action in the integration test. No public write was sent. |

**Not tested for this update:** physical devices, Firefox or Safari, camera scanning of a QR, public HTTPS deployment, a fresh faucet-funded public Signet receive-and-sweep, and use by actual sellers. The previous faucet blocker below remains a historical finding. It was not retested. This pass is not a security audit or a claim of seller demand.

Verification results are saved locally only when you choose **Save this check**. They are unencrypted and not synced. YOU never saves wallet keys. A saved check may be out of date.

## Prior independent verification, 19 November 2026

This pass started from a fresh extraction of `YOU-Final.zip`, the latest wallet-project ZIP in the workspace. The archive, package and lockfile, scripts, original report, README, and Pages workflow were checked before edits. Node.js v20.20.2, Playwright Chromium 1.65.1 package, and Bitcoin Core v29.0.0 were used. The original 10 unit tests, browser suite, and both Core test paths passed before the fixes below. The original design and features were retained.

### Failed in the prior version and corrected

| Bug found | Reproduction and correction |
|---|---|
| Transaction ID was silently shortened | In Chromium, a valid 64-digit ID followed by `a` was reduced to the original 64 characters on insertion. Removed the browser field length cap and let the exact-length validator reject the entire value before a lookup. |
| BTC and fee-rate fields silently changed numeric input | Entering `10000000.000000019` in Verify yielded `10000000.00000001`; entering `100` in the sweep rate field yielded `10`. Removed truncating caps from transaction-critical fields in Verify/Receive/sweep. Full pasted amounts now reach the eight-decimal validator and fee rates over 50 are rejected. |
| Chain-tip 404 incorrectly implied a missing transaction | With a real Signet transaction response and an injected 404 for the tip height, the original UI said **Transaction not found**. Now only a 404 of the exact transaction endpoint can produce that verdict. An unavailable tip or history endpoint cannot be mistaken for an absent exact transaction. |
| Incoming history trusted an incomplete confirmation flag | The shared transaction inspector accepted `confirmed: true` without a valid positive integer block height, so history could show “Confirmed” for an inconsistent response. The inspector now rejects it. The exact-ID verifier still checks block height against the tip as well. |

Regression tests were added, not substituted for the existing ones. The browser harness now also explicitly blocks public explorer writes. Its separate Signet-shaped test route submits only to the isolated Core node for the regtest case.

### Passed on the prior corrected build

| Area | Evidence from this pass |
|---|---|
| Dependency install and audit | `npm ci` completed, `npm audit` reported zero known vulnerabilities at test time. `npx playwright install chromium` completed; existing Linux libraries sufficed. |
| Syntax, HTML, and artifact | `node --check` passed for the requested sources and extracted production bundle. `npm run build` and `npm run check` passed: 72 unique IDs, no missing literal references, matching inline script CSP hash. An HTML5 parser reported no errors for either template or built file. |
| Unit tests | **11 passed, 0 failed**: original 10 plus confirmation metadata regression. Covers address checksums, exact amount conversion, matching scripts and outputs, confirmations, fee/virtual size/RBF, BIP21 and sweep restrictions. |
| Browser UI / responsive | Chromium at **320×640, 390×844, 768×1024, and 1366×900**. Navigation and settings open/exit, light/dark/system, persisted profile and network, local recipient save/remove, checklist progress/reset, clipboard, local QR rendering, BIP21, all offline scenarios, invalid inputs, loading controls, and no horizontal overflow or JS/CSP errors in exercised paths. A separate touch-emulated Chromium session opened the standalone file directly while offline and ran a demo. |
| Real public explorer reads | Historical Signet and Testnet 4 transactions loaded with live checks enabled. Assertions compared displayed exact BTC, confirmation count, fee, virtual size, fee rate and RBF against the actual responses. A Signet ID on Testnet 4 returned not found. Also exercised live Signet history, wrong amount/address, and a missing transaction. |
| Injected explorer failures | Connection abort, HTTP 429, HTTP 503 (including loading/disabled state), and a tip-only HTTP 404 all yielded an unavailable result, never a successful payment verdict. |
| Fresh, isolated regtest | Ran the inherited CLI integration and browser integration against a newly initialized Bitcoin Core regtest datadir with networking disabled. Core funded a browser-generated 2,500-sat wallet; UI showed pending, then confirmed after mining. UTXO retrieval fed a signed review; no POST during review, exactly one POST on explicit click, mempool acceptance and a mined sweep to the chosen address. The mined fee met the selected sat/vB floor. A pasted watch-only address hid sweep controls, and a reload created a different wallet. |
| Deployment readiness (local only) | Reviewed the Pages workflow and ran build/check locally. The artifact ran from a project-style `/you-project/` subpath and opened directly as a standalone offline file. No development dependency or external static assets need to load at runtime. |

**Failed on final rerun:** None in the executed suite. See **Blocked** and **Not tested** below; a local pass does not convert them into passes.

### Previously blocked

- **Fresh public Signet funding and sweep:** The primary `signetfaucet.com` timed out in this pass; `alt.signetfaucet.com` and `signet25.bublina.eu.org` returned HTTP 403 interstitials. We did not bypass the restrictions or request coins. No fresh public transfer or sweep was attempted, and no public POST was sent. [Manual test step 10](MANUAL-TEST.md) provides exact follow-up with an independently funded Signet wallet; only broadcast publicly with separate approval.
- **Physical Android:** No attached device was available. Viewport and touch checks were Chromium emulation, not an Android hardware test. Follow steps 1, 2, 6 and 7 on Android Chrome, especially touch navigation, scrolling, clipboard and QR scanning.
- **Publishing:** No repository access or publishing credentials were supplied. GitHub Actions was inspected, not run remotely. Follow the README deployment steps and open the resulting public URL while signed out.

### Not tested in that pass

Other browser engines, camera-based QR scanning, venue or Nigerian ISP conditions, provider uptime and rate limits over time, and usability with actual sellers. The project does not claim demand validation or a professional security audit.

### Focused security review

The app accepts Signet/Testnet address encodings only and uses an allowlist of public test-chain API paths. Signing is local; the private key is held in a closure and is not returned as a raw key, logged, stored, requested via a seed field or passed to fetch. A Signet POST sends only the signed raw transaction after an explicit broadcast click. Testnet 4 is read-only. The app uses a script-hash CSP, DOM text operations, and exception-protected localStorage for profile, preferences and public recipients. Saved verification results in the new version use the same exception-protected helpers and require an explicit click. The explorer still sees connection metadata and requested public identifiers. Anyone controlling the host, browser, extensions or dependencies could undermine these guarantees; the app trusts explorer responses and cannot independently prove finality. This was a focused review, not an audit.

## Reproduce

```sh
npm ci
node --check src/app.js
node --check src/bitcoin.js
node --check scripts/browser.mjs
npm test
npm run build
npm run check
npm audit
npx playwright install chromium
npm run test:browser
```

If needed on Linux, run `npx playwright install-deps chromium`. Do not use `SKIP_LIVE=1` when reporting live API results.

### Isolated Bitcoin Core integration

Use a fresh datadir and Bitcoin Core v29+ on `PATH` (or `CLI=/path/to/bitcoin-cli`). Do not point these scripts at a production wallet. The browser Signet request interception applies only to its test session.

```sh
export CORE_DATA=$(mktemp -d)
export CORE_RPC_PORT=28443
bitcoind -regtest -datadir="$CORE_DATA" -server -listen=0 -networkactive=0 -rpcport="$CORE_RPC_PORT" -daemonwait
bitcoin-cli -regtest -datadir="$CORE_DATA" -rpcport="$CORE_RPC_PORT" createwallet judge
node scripts/regtest.mjs
npm run test:browser
bitcoin-cli -regtest -datadir="$CORE_DATA" -rpcport="$CORE_RPC_PORT" stop
```
