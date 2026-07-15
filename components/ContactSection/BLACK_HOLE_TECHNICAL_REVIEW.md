# Black-Hole Freeze Incident Review

## Outcome

The recurring freeze was reproduced, instrumented, and corrected. The final Contact scene starts on fresh desktop and mobile loads, pauses while offscreen, resumes with the same renderer when revisited, survives responsive quality changes, and recovers from an intentionally lost WebGL context. The production build and production server were both tested.

The primary confirmed defect was render-loop ownership: the R3F root could enter demand mode and stop its global loop, while a later active-state change only changed `frameloop` back to `always`. That state change did not reliably restart the already-stopped root. The displayed shader materials were valid; their time stopped because `useFrame` stopped running.

## Scope inspected

The audit covered the application entry point and section layout; hash navigation and smooth scrolling; active-section and Intersection Observer logic; page visibility and responsive quality selection; every `<Canvas>` declaration; every `useFrame`; custom animation loops and global listeners; renderer and composer ownership; manually created render targets, textures, materials, and geometries; Contact shaders and timing; asteroid dragging and surge state; the SVG loader and logo asset; development HMR behavior; and the production build/server.

The six final canvas-owning systems are:

| System | Final root policy | DPR | Continuous work | Post-processing / targets | Particles and notable resources | Cleanup / mobile behavior |
| --- | --- | --- | --- | --- | --- | --- |
| Persistent KL logo | One root shared by desktop and mobile layouts | `[1, 1.5]` | Always; the logo remains visible | None | Procedural SVG geometry plus points/dashes; particle density is controlled by logo props | One root replaces the former two responsive roots; SVG data is sanitized before parsing |
| Hero `TechCore` | Lazy mount on first near-viewport entry, then retain | `[1, 1.5]` | Demand loop driven only while Home is active/onscreen | None | Tesseract meshes/rings and 500 stars | Pauses offscreen; retained resources avoid remount churn |
| About journey | Lazy mount, then retain | `[1, 1.35]` | Demand loop only while onscreen | None | Timeline scene and 420 atmosphere points | Pauses offscreen; no renderer recreation on revisit |
| Projects laptop | Lazy mount, then retain | `[1, 1.55]` | Demand loop only while onscreen | None; shadows disabled | Laptop geometry and cached project textures | Pauses offscreen; texture set survives section revisits |
| Skills radar | Lazy mount, then retain | `[1, 1.5]` | Demand loop only while onscreen and motion is active | None | Radar geometry and 54 WebGL particles; DOM/SVG fallback remains available | Removed the temporary capability-probe context; pauses offscreen |
| Contact black hole | Quality is measured first; lazy mount near Contact, then retain | desktop `[1, 1.3]`, tablet `[1, 1.16]`, mobile `[1, 1]` | Constant demand root with one explicit active invalidation driver | One retained composer on bloom-capable tiers; direct render on mobile; rear lens target scales `0.60/0.44/0.38` | 820/520/290 stars, 170/100/54 dust particles, 7/5/3 asteroids, procedural shaders | Pauses offscreen, preserves renderer/scene, bounded context recovery, no bloom on mobile |

Before the correction, seven R3F roots could coexist in the desktop page because desktop and mobile logo variants each owned a canvas in addition to Hero, About, Projects, Skills, and Contact. The final code has six unique roots. A fresh direct Contact load has two live renderers (the persistent logo and Contact). Visiting every 3D section once retains six renderers, but only the visible section's demand driver runs; repeating the route cycle did not create a seventh renderer.

## Controlled reproduction and evidence

### Failing baseline

1. Run the development server and open `/#contact`.
2. Confirm Contact has rendered and its diagnostic phase says `RUNNING`.
3. Navigate away so the scene becomes offscreen, then navigate back.
4. Read the canvas frame counter and persistent visual-time value, wait more than three seconds, and read them again.

The baseline returned to a nominal `RUNNING` phase, but both values remained fixed at frame `6480` and visual time `48.99`. The renderer was present and the canvas was non-zero-sized; the R3F frame loop itself had stopped. Changing responsive dimensions caused R3F size/invalidation work, explaining why DevTools or device-mode changes could appear to wake the scene. The precise DevTools-toggle sequence was user-reported rather than independently captured before the architecture changed, so this explanation is a code- and scheduler-backed inference, not a separate reproduced event.

The failing baseline was independently reproduced in development. A pre-fix production freeze was not independently captured, so the user-reported production symptom is not presented as a separate confirmed reproduction. The corrected production application was tested directly.

### Diagnostic observations

- Successful and frozen states both had valid, non-zero CSS and drawing-buffer sizes. Zero-size initialization was not the root cause.
- Shader visual time, asteroid motion, disk plasma, photon-ring motion, and stars stopped together. No sampled uniform was `NaN`; shader timing was a victim of the stopped frame loop, not an independent shader defect.
- A resize changes R3F size state and invalidates a frame. That external invalidation explains the apparent DevTools/responsive “fix.”
- Repeated `THREE.WebGLRenderer: Context Lost.` messages were strongly amplified by development HMR/unmounts. R3F intentionally calls `forceContextLoss()` when disposing an old root, so those teardown logs are not proof of organic browser context exhaustion.
- Clean normal-use development and production sessions did not produce an organic context loss.
- The installed `@react-three/postprocessing` wrapper removed passes during cleanup but did not dispose its composer. Repeated wrapper/quality lifecycle changes could retain render targets. This was a confirmed resource-lifecycle defect and a GPU-pressure contributor, but not the demonstrated trigger for the stopped loop.
- The original Contact “ready” signal fired from Canvas creation, before a successful rendered frame. It could hide first-frame failures and made the lifecycle state misleading.
- Direct hash navigation inherited global smooth scrolling. On a fresh `#contact` load it could traverse and mount upstream 3D sections. On mobile, later upstream layout growth could also move Contact back offscreen. Visibility/navigation therefore contributed to inconsistent startup.
- The Skills WebGL capability probe created an avoidable extra context.

## Root-cause classification

| Question | Evidence-backed answer |
| --- | --- |
| Confirmed primary cause | Competing/dynamic frame-loop ownership allowed a demand root to stop without a reliable mechanism to restart it. |
| Did shader timing cause the freeze? | No. Persistent visual time stopped only because `useFrame` stopped; all rendered materials consume the shared time source. |
| Did zero-size initialization cause it? | No in the measured reproductions. Sizes were valid. Premature readiness was still corrected. |
| Did visibility detection contribute? | Yes. Several booleans and initial hash/layout shifts could leave Contact offscreen or nominally active at the wrong time. |
| Did responsive logic contribute? | Yes. Initial quality selection, quality transitions, smooth hash scrolling, and size invalidation changed lifecycle timing. Resize was a wake-up stimulus, not the actual cure. |
| Did post-processing contribute? | Yes, as a resource-lifecycle risk: the wrapper composer was not explicitly disposed. It was not the measured frame-stop trigger. |
| Was browser WebGL-context exhaustion proven? | No. Seven roots and leaked composer targets increased pressure, but no clean normal-use session exceeded a context limit or organically lost the final Contact context. |
| Was GPU-memory exhaustion proven? | No direct browser/GPU memory API was available. Stable renderer resource counts after repeated navigation/surges argue against continuous growth in the corrected scene. |
| Did HMR or Strict Mode contribute? | HMR/React teardown amplified context-loss logs and remount churn. They exposed cleanup weaknesses but were not proven as the production root cause. Strict Mode was not disabled. |
| Why did SVGLoader warn? | `fill="url(#gradient_2)"` and `fill="url(#gradient_3)"` reached `SVGLoader`, which cannot resolve those paint-server references and passed them toward `THREE.Color`. |

## Permanent corrections

### Frame and scene lifecycle

- Every continuously animated section root now keeps `frameloop="demand"` for its entire lifetime.
- `ActiveFrameLoop` owns one unambiguous policy: while active it invalidates the next frame from `useFrame`; when inactive it stops requesting frames. A layout effect consumes the paused clock gap and invalidates once on reactivation.
- Contact uses explicit phases: `DORMANT`, `INITIALIZING`, `RUNNING`, `PAUSED_OFFSCREEN`, `CONTEXT_LOST`, `RESTORING`, and `FAILED`.
- Readiness is published only after a successful render, not merely after renderer creation.
- Visual time is held in a persistent ref, advanced from clamped delta, and supplied to all animated scene materials without React state updates per frame.

### Canvas, visibility, and navigation lifecycle

- Hero, About, Projects, Skills, and Contact mount lazily on first approach and retain their root/resources thereafter.
- Only the currently visible/active scene continuously invalidates. Offscreen scenes keep their state but consume no continuous frames.
- One shared navigation provider owns section/hash state and listeners.
- Direct hash placement uses immediate scrolling, avoiding the initial traversal through every WebGL section.
- A short-lived initial anchor lock responds only to genuine upstream layout changes and stops on user intent. It uses `ResizeObserver`; it does not dispatch a fake resize or depend on a timeout.
- Contact quality is measured before its Canvas mounts. DPR and camera/composer sizing update without changing the renderer-construction options.
- Desktop and mobile now share one persistent logo renderer instead of two CSS-hidden responsive variants.
- The Skills capability-probe renderer was removed.

### Renderer, composer, and GPU resources

- Contact is the sole priority-one render owner for its R3F root.
- The post-processing wrapper dependency was removed. A direct `postprocessing` composer is created at most once, retained across quality changes, resized in place, bypassed on mobile, and disposed exactly once on unmount.
- No geometry, material, texture, shader, or render target is created inside `useFrame`.
- The lensing framebuffer has no depth/stencil buffer and uses tiered resolution scaling.
- Desktop/tablet DPR is capped and mobile bloom is disabled while procedural lensing, plasma, particles, asteroids, and interaction remain active.
- Plasma surge-only meshes are skipped when their contribution is zero.
- Manually owned asteroid resources and listeners have scoped cleanup; R3F-owned shared resources are not prematurely disposed.

### Context recovery

- Canvas creation synchronously attaches `webglcontextlost` and `webglcontextrestored` listeners.
- Loss calls `preventDefault()` so browser restoration remains possible, pauses dependent rendering, and moves the UI to `CONTEXT_LOST`.
- Restoration moves through `RESTORING`; the next successful render increments a readiness epoch and returns to `RUNNING` or `PAUSED_OFFSCREEN`.
- If restoration does not complete, Contact allows at most two controlled remount attempts and then preserves the HTML Contact interface with a restrained fallback. It never reloads the page or loops indefinitely.

### Console and asset cleanup

- A small `SVGLoader` subclass preprocesses the two unsupported gradient paint references into the intended solid colors before Three.js parses the markup. The original SVG remains suitable for the DOM favicon.
- A document-level SVG favicon link replaces the missing `/favicon.ico` request.
- Color objects previously allocated during the logo's frame loop are memoized.

## Regression results

### Static and dependency checks

- Babel parsed all 36 JavaScript source files checked by the repository script.
- `npm.cmd ls` resolved `@react-three/fiber 8.18.0`, `three 0.168.0`, and direct `postprocessing 6.39.1`; `@react-three/postprocessing` is absent.
- The offline install/prune reported zero dependency vulnerabilities.
- `git diff --check` passed; the only terminal notices were existing line-ending warnings.
- `npm.cmd run build` completed compilation, lint/type validation, static generation, and route generation for `/`, `/404`, `/api/projects/[projectId]`, and `/logo-lab`. Webpack emitted only cache snapshot warnings; there were no application compile errors.

### Development runtime

- Fresh desktop `/#contact`: two canvases, `RUNNING`, desktop tier, non-zero `825×694` CSS and `1071×901` drawing buffer, one composer, advancing frame/time.
- Fresh mobile `/#contact`: two canvases, mobile tier, direct renderer, no composer, non-zero `382×290` CSS/drawing buffer, advancing frame/time.
- Repeated mobile/desktop breakpoint crossings kept readiness epoch `1`; composer count stayed `0` on mobile and `1` on desktop, then remained `1` when bypassed again.
- Full Home/About/Projects/Skills/Services/Contact traversal grew the retained root count only as each scene was first encountered: `2 → 3 → 4 → 5 → 6`. Repeating the cycle remained at six.
- Contact paused offscreen with frame/time unchanged. Returning reused readiness epoch `1` and advanced again (`9480 → 9720` in one sample; `12120 → 12240` on another cycle).
- A full five-second surge/absorption sequence returned to idle. A repeated surge kept Contact resource counts stable at 18 geometries, 18 textures, and 17 programs in that development session.
- An intentional context loss produced `CONTEXT_LOST`, then `RESTORING`, then `RUNNING`; readiness epoch moved from `1` to `2`, the frame counter resumed, and canvas count remained two. The temporary injector used for this test was removed.
- A fresh development tab logged only the expected HMR connection. No SVGLoader gradient, unknown-color, favicon, shader, framebuffer, or organic context-loss errors appeared.

### Production runtime

- Fresh mobile direct load: Contact stayed anchored at viewport top through upstream layout completion, entered `RUNNING`, and advanced from frame `120`/time `0.98` to frame `360`/time `2.67`. It used two canvases, mobile quality, zero composers, and a valid `382×290` buffer.
- Mobile-to-desktop resize reused readiness epoch `1`, selected desktop quality, resized to `825×694`, enabled exactly one composer, and continued advancing (`3840 → 3960`, time `27.37 → 28.20`).
- Final away/back test: Home navigation placed Contact in `PAUSED_OFFSCREEN` at frame `21360`. Returning to Contact reused epoch `1`, entered `RUNNING`, and advanced `22080 → 22320` while visual time advanced `155.91 → 157.60` over the 1.4-second sample.
- In the final desktop production sample the Contact renderer remained at one composer, 15 geometries, 18 textures, and 23 programs. Counts did not change across the away/back sample.
- The final production console was empty of context-loss, SVG, favicon, shader, framebuffer, resize-observer, pointer, and unhandled-promise errors.

## Preserved behavior

The implementation keeps the event horizon, front/rear accretion disk, photon ring, screen-space lensing, procedural plasma, stars, orbital particles, asteroid drift/gravity/drag, surge charging, five-second absorption, asteroid respawn, reduced-motion behavior, and responsive quality tiers. No static-image replacement or interaction removal was used.

## Remaining limitations and risks

- The in-app browser backend did not change `document.visibilityState` when its controlled tab lost selection. Switching away and back caused no freeze, but a true 30-second hidden-tab/minimize restoration could not be truthfully validated in this environment.
- A second supported browser, hardware-acceleration controls, laptop power-saving mode, and OS-level window minimization were not available to the test harness.
- Browser heap and driver-level GPU memory were unavailable. Resource stability was verified with `renderer.info`, canvas/composer counts, readiness epochs, and repeated interaction/navigation rather than a direct VRAM reading.
- This is a physically inspired real-time lensing approximation, not a general-relativistic ray tracer. Frame rate still depends on GPU/browser capability; the tiered DPR, framebuffer scale, particle counts, and mobile bloom bypass bound the workload but cannot guarantee 60 FPS on every device.
