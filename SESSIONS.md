# Session history — “sauce-mcp” (topic)

_Every exchange mentioning **sauce-mcp** across 4 session(s) on local · 13 prompts. Cloud-only sessions are not included (teleport them to a machine first)._

---
### 2026-07-04 · local · session `7babc816`

**🗣️ You:**

What projects do you see in the directory?

**🤖 Claude:**

Here are the project directories I can see in `/home/ravenhoward`:

## Application / project directories

| Directory | Likely purpose |
|---|---|
| **murmur-server** | Server component of a "Murmur" app |
| **murmur-voice** | Voice component of Murmur |
| **murmur-data** | Data/storage for Murmur |
| **murmur-inbox** | Inbox for Murmur |
| *(also `murmur.code-workspace`)* | VS Code workspace tying Murmur pieces together |
| **daily-briefing** | A daily briefing app/service |
| **finance** | Finance-related project |
| **dashboard** | A dashboard project |
| **sauce-mcp** | MCP server (matches the "Sauce Recipes" connector) |
| **vault-mcp** | MCP server for a "vault" |
| **vault-mirror** | Vault mirroring/backup |
| **immich** | Immich (self-hosted photo management) |
| **couchdb** | CouchDB instance/data |
| **supabase** | Supabase (backend/database) instance |
| **agent-logs** | Logs from agent runs |
| **bin** | User scripts/binaries |
| **Sync** | Sync folder |

## Notes
- None of these are git repos at the top level (`/home/ravenhoward` itself isn't one), though individual project folders may be — I'd need to check each.
- The "murmur-*" folders clearly form one larger project, grouped by the `murmur.code-workspace` file.
- `sauce-mcp` and `vault-mcp` look like MCP servers you're developing — interesting given the "Sauce Recipes" connector appears in the available (unauthorized) MCP list.

Want me to dig into any of these — e.g., check which are git repos, read their READMEs, or summarize what a specific project does?

_ran: `Bash`_

**🗣️ You:**

Sauce and murmur are iOS apps. Are there cloud tools you can use on Linux to develop iOS apps that are free and open source? Looking for workarounds for this limitation

**🤖 Claude:**

Short version: **Apple's own toolchain (final SwiftUI/UIKit compile + code signing + App Store upload) legally requires macOS on Apple hardware.** That wall is real and no FOSS tool fully removes it. But you can do a surprising amount of iOS work on Linux, and the "last mile" can be handled by a *free cloud Mac* rather than a physical one. Here's the honest landscape:

## What actually runs on Linux (FOSS)

**1. Swift toolchain itself** — `swift.org` ships an official open-source Swift compiler + `swift-corelibs-foundation` for Linux. You can write, build, and unit-test all your **non-UI logic** (networking, models, business rules, Swift packages) natively on Linux today. What's *missing* is UIKit/SwiftUI — those are closed Apple frameworks with no Linux implementation.

**2. `xtool`** (`github.com/xtool-org/xtool`) — the most relevant recent project. It's an open-source, cross-platform Xcode replacement that can **build and deploy a real SwiftUI iOS app from Linux/Windows** using the open Swift toolchain + Apple's SDK stubs. This is the closest thing to what you're asking for. It's young and moving fast, so capabilities/limits shift — worth testing against your actual Murmur/Sauce projects rather than trusting a feature list.

**3. `theos`** — mature open-source iOS build system (big in the tweak/jailbreak world), runs on Linux, drives clang/Swift to produce iOS binaries.

**4. `libimobiledevice` + `ios-deploy`** — FOSS libraries to talk to a physical iPhone *from Linux*: install apps, stream logs, debug. Genuinely useful for the on-device loop.

## The realistic "cloud" workaround (free)

**GitHub Actions free macOS runners + fastlane.** This is what most people actually use:
- Apple-hosted macOS runners are **free for public repos** (and a monthly free-minute allotment for private).
- `fastlane` (open source) automates `xcodebuild`, signing, TestFlight, and App Store upload.
- Your workflow YAML is open/version-controlled; you develop on Linux and let the Mac runner do the signed build + submission.

**Codemagic / Cirrus CI** have similar free tiers for mobile CI if GitHub Actions minutes get tight.

## The gray-area option

**Docker-OSX / OSX-KVM** — open-source projects that run macOS (and Xcode) in a VM on Linux. Technically feasible, but: (a) it **violates Apple's EULA** (macOS is licensed only on Apple hardware), and (b) the iOS Simulator barely works under nested virtualization with no GPU passthrough. I'd treat this as a curiosity, not a workflow.

## My recommendation for your setup

Since Sauce and Murmur are existing iOS apps:

1. **Develop + test logic on Linux** with the Swift toolchain (and `xtool` for building).
2. **Wire up GitHub Actions macOS runners + fastlane** for signed builds, TestFlight, and App Store submission — that's your free, legit "cloud Mac."
3. Keep `libimobiledevice` around for on-device debugging if you have a physical iPhone.

---

Two things worth flagging: `xtool` in particular is evolving quickly and my knowledge cuts off around January 2026, so the current state may have shifted. Want me to **run a web search / deep-research pass** to confirm the latest capabilities (especially whether `xtool` can now handle full signing + App Store submission solo)? I can also **look inside your `murmur-*` and `sauce-mcp` folders** to see how the projects are structured and suggest a concrete CI setup tailored to them.

**🗣️ You:**

How’s it going now?

**🤖 Claude:**

The research finished, though the final synthesis step got cut off by an API session limit (resets midnight UTC), and a batch of the CI/free-tier claims couldn't be verified for the same reason. I have the 14 verified findings plus the refuted/unverified list — let me grab the truncated tail, then synthesize the report myself and clearly mark what's independently verified vs. what I'm filling in from knowledge.

Research is done. The workflow verified the core findings before an API session limit (resets midnight UTC) cut off the final synthesis and a batch of the CI/submission claims — so I'll synthesize it myself, clearly marking what got **independently fact-checked (3-vote verified)** vs. what I'm **filling in from knowledge** (claims the tool queued but couldn't verify due to the limit — not refuted, just unconfirmed).

Bottom line up front: **there is now a real pure-Linux build path (`xtool`), but no FOSS tool removes the two hard walls — an Apple Developer account for signing, and Apple's servers for App Store submission.** For *shipping* existing apps, a free cloud Mac (GitHub Actions) is still the sane route.

---

## 1. Building on Linux directly

**`xtool`** (github.com/xtool-org/xtool) — the standout, actively maintained project. ✓*Verified:*
- Builds a **SwiftPM package into an iOS app entirely on Linux** (also WSL/macOS), can **sign and install to a device**, and talks to **Apple Developer Services** programmatically. It provides UIKit/SwiftUI on Linux by **extracting them from the real iOS SDK**.
- ⚠️ **Two hard caveats, both verified:** (1) it **cannot deploy to App Store Connect yet** — no TestFlight/App Store submission from the tool; (2) it needs you to **supply Apple's `Xcode.xip`** yourself to build the SDK locally (requires Swift 6.1+). So it's not a clean-room stub — you download Apple's toolchain, you just run it on Linux.
- *Unverified (session limit, from knowledge):* it has two backends — a macOS-only "XcodePacker" and a cross-platform "Packer" that builds directly via SwiftPM. It's SwiftPM-centric, which matters for you (see the caveat at the end).

**`CrossCode`** (github.com/nab138/CrossCode) — ✓*Verified:* a Win/Linux IDE targeting Swift 6.2 to create/build/test apps without a Mac, with **Apple-ID-based signing and on-device install**. Newer/less proven than xtool but worth watching.

**Swift toolchain (swift.org) on Linux** — runs natively for **non-UI logic and tests**; UIKit/SwiftUI are not natively present (that's exactly the gap xtool fills by extracting them).

**`theos`** — mature Linux-capable build system, but oriented to tweaks/jailbreak workflows rather than App Store apps.

## 2. Code signing & device deploy from Linux

**`zsign`** (github.com/zhlynn/zsign) — ✓*Verified, strongest result (3-0 across the board):* a fast, MIT-licensed, **cross-platform `codesign` alternative** that re-signs `.ipa`/Mach-O/`.app` on **Linux with no macOS/Xcode**. **Actively maintained — v1.0.4, April 2026, ~1.8k stars.** You supply a **private key/P12, provisioning profile, and certificate (PEM/DER)** — i.e. it signs on Linux but you still need Apple-issued credentials.
- *Unverified/knowledge:* you can even generate the CSR/key with **OpenSSL** on Linux and get the cert issued by Apple, so the whole signing chain can avoid a Mac.

**`isign`** (sauce-archives/isign) — ✓*Verified:* Python re-signer, but **archived Feb 2020, unmaintained.** Note the tool **refuted (0-3)** the idea that you need a Mac to obtain the credentials — you don't. Prefer zsign.

**`Sideloader`** (Dadoum/Sideloader) — *Unverified (session limit):* cross-platform installer (Cydia Impactor replacement) with a **GTK4 Linux frontend** that fetches a dev certificate the way Xcode does, needing only an Apple account. Plausible and relevant, but I couldn't fact-check it this run.

**`libimobiledevice` / `ios-deploy`** — the FOSS glue to install/debug on a physical iPhone from Linux.

## 3. Free cloud/CI "Mac"

**GitHub Actions macOS runners** — ✓*Verified:* **free and unlimited on public repos**, including macOS. For **private repos**, macOS draws down your monthly free minutes and is then billed — and it's the **most expensive tier** (macOS minutes count ~10× against quota). This is the most reliable free cloud Mac. Pair with **fastlane** for build + signing + submission.

*Unverified (session limit — treat as ~accurate, not confirmed):* Codemagic free tier (~500 macOS-M2 min/mo), Xcode Cloud (~25 compute hours/mo included with a Developer membership), and fastlane's `upload_to_testflight` supporting **App Store Connect API keys** (avoids 2FA) — some reports of running it from Linux via Transporter.

## 4. macOS in a VM (Docker-OSX / OSX-KVM)

✓*Verified from the projects' own author:* Apple's EULA licenses macOS **only on Apple hardware**. The EULA permits up to 2 VM instances **but only on a Mac you own** — so running it on your Linux box is an **EULA violation**, per Docker-OSX's own maintainer. Plus the iOS Simulator barely works without GPU passthrough. Skip it.

## 5. App Store submission — the hard wall

*Unverified this run but well-established:* the **App Store Connect API is a REST API (JWT auth)**, so *uploading* a build isn't strictly tied to the Xcode GUI. **But** every path ends with **Apple's servers processing the build**, an **Apple Developer Program membership ($99/yr)**, and **App Review**. No FOSS tool removes those.

---

## Recommended pipelines for you (Sauce + Murmur)

**The realistic free shipping pipeline:**
1. **Develop & iterate on Linux** — Swift toolchain for logic/tests; **xtool + zsign + libimobiledevice** for building and testing on a real iPhone. This gives you a genuine no-Mac inner loop.
2. **Release via GitHub Actions macOS runner + fastlane** — signed archive → TestFlight/App Store. **Make the repo public and it's unlimited-free**; private burns limited macOS minutes fast.

**One caveat that specifically affects you:** xtool is **SwiftPM-centric**. If Sauce/Murmur are conventional **`.xcodeproj`/`.xcworkspace` apps** (storyboards, asset catalogs, CocoaPods, custom build phases), the **pure-Linux xtool build may not accept them as-is** — you'd either restructure toward SwiftPM or lean on the CI-Mac path, which builds your existing Xcode project unchanged. 

I can look inside the `murmur-*` and `sauce-mcp` folders to see how the iOS projects are actually structured (SwiftPM vs. Xcode project) and then draft you a **concrete GitHub Actions + fastlane workflow file**, plus a local `xtool`/`zsign` setup script. Want me to do that? (Also note: the unverified free-tier numbers above are worth a fresh check after the API limit resets — I can re-run just that slice.)

_ran: `Read`_

**🗣️ You:**

How do most of the mainstream tools that handle of that for you work? Assuming like GitHub actions? 

I think we can go ahead and get the xtool and zsign setup because that’s just for testing. And then Xcode can run off of GitHub so it will be up to date if I need to publish anything on my Mac

**🤖 Claude:**

Great plan — and it's the right mental model. Let me answer the "how do the mainstream tools actually work" question first, clear up one small thing in your plan, then start the setup (I'll poke at your machine to see what we're working with while I explain).

Good instinct on the split — but I hit something important while poking around, so let me give you the "how it works" explanation, fix one small thing in your plan, then show you what I found.

## How the mainstream tools actually work (GitHub Actions + fastlane)

The magic is that they **script the exact clicks you'd do in Xcode, on a rented Mac, triggered automatically.** Piece by piece:

**1. The runner = a throwaway Mac.** When you push code (or click "run"), GitHub boots a **fresh, clean macOS virtual machine that it owns**, with **Xcode already installed** — actually several Xcode versions pre-installed, kept current by GitHub. Your job runs, then the machine is **destroyed**. You never patch or maintain anything.

**2. The workflow file = a recipe.** A little `.github/workflows/release.yml` file in your repo lists the steps in plain terms: *check out code → pick Xcode 26 → install dependencies → build & archive → sign → upload to TestFlight.* GitHub reads it top to bottom on that rented Mac.

**3. fastlane = the button-presser.** Apple's raw command-line tools (`xcodebuild`, Transporter, the App Store Connect API) are finicky. **fastlane** wraps them into named "lanes" so one command — `fastlane beta` — does the whole chain: bump build number → build → sign → upload. It's the layer that means you don't hand-write Apple's cryptic commands.

**4. The hard part they solve for you — signing secrets.** The throwaway Mac starts empty, so how does it get your private signing certificate without you leaking it? Two mechanisms:
   - **fastlane `match`** stores your certificates + provisioning profiles **encrypted in a private repo**, and installs them into the runner's keychain at the start of each run.
   - **GitHub Secrets** — an encrypted vault in your repo settings — holds your **App Store Connect API key** and the match passphrase, injected as environment variables. The API key is what lets it talk to Apple **without your Apple ID password or 2FA codes**.

**5. Apple still does the last mile.** The runner uploads the signed build to App Store Connect via Apple's API; **Apple's servers process it**; it appears in TestFlight / ready for review. fastlane can even submit it for review. That part is always Apple's — the tools just automate *reaching* it.

So the whole "it handles it for you" is: **secure secrets + a recipe file + a pre-loaded rented Mac.** That's it.

## One fix to your plan

> *"Xcode can run off GitHub so it will be up to date if I need to publish anything on my Mac"*

Almost — the key upgrade to your mental model: **GitHub's runner *is* the Mac.** You don't need a Mac of your own at all. GitHub keeps its runners' Xcode current, so publishing happens **on GitHub's Mac**, not yours. If you happen to have a Mac, great, you *can* publish from it — but the whole point is you no longer *have to*. Your plan works even with zero Macs in your life.

## What I found on your machine (the catch)

I checked your box before installing anything. Good news: it's a capable host — **Ubuntu 24.04, x86_64, 4 cores, 71 GB free.** But two things:

- **Swift isn't installed**, and a few build tools are missing (`clang`, `cmake`, `unzip`) — all easily fixed.
- **The bigger one: there's no iOS app source code on this machine at all.** No `.xcodeproj`, no `Package.swift`, no `.swift` files anywhere. The `murmur-*` and `sauce-mcp` folders are all **backend/server** code — not the iOS apps themselves.

That matters because **xtool and zsign need the actual app code to do anything.** Installing them onto a machine with no app to build would be setting up an empty workbench. So before I install the toolchain, I need to know where the real iOS source lives.

Got it — and let me untangle two things, because there's a small misconception worth clearing up, then I'll answer the VM question straight.

**On the "GitHub route":** version-control backups and the publishing pipeline are *separate things that happen to live in the same repo.* You can keep your private repo purely as a backup and **never touch GitHub Actions** — that's totally fine. But also worth knowing: **Actions works on private repos too.** You don't have to make anything public. Private repos get ~2,000 free minutes/month; macOS burns them ~10× faster, so ~200 macOS-minutes/month free, then it's pay-per-minute. So "private repo" was never the blocker — you opted out of CI, which is a separate choice. Just want that on the table.

Now, your actual question:

## Can you run your own Mac VM? Here's how it works

**The technical idea:** Your Linux machine has a virtualization engine (KVM/QEMU) that can pretend to be different hardware. Projects like **Docker-OSX** and **OSX-KVM** package up the tricky configuration needed to make QEMU impersonate a real Mac closely enough that macOS boots and runs. You feed it a macOS installer image, it spins up a virtual "Mac," you install macOS, then install Xcode inside it. From there it behaves like a Mac desktop in a window. That's the dream: your own private, self-hosted Mac, no GitHub, no monthly fee.

**But there are three walls, and for your specific machine, they're steep:**

**Wall 1 — It breaks Apple's license.** This one's verified from the research: Apple licenses macOS to run **only on Apple hardware.** The EULA allows a couple of macOS VMs, *but only on a Mac you already own.* Running it on your Ubuntu PC is a EULA violation — even the author of Docker-OSX says so plainly. Not a police-at-your-door thing, but it's officially against the rules, and it's why no one can offer it as a real product.

**Wall 2 — Your hardware can't really run it.** This is the practical dealbreaker, and I'm looking at your actual specs:
- **RAM: 7.7 GB total** (and ~4 GB already in use). A macOS VM wants **8 GB+ just for itself**, and Xcode is a notorious memory hog on top of that. You can't give a VM more RAM than you physically have. This alone makes it painful-to-unusable.
- **No GPU passthrough** → macOS renders in software → the whole UI is laggy, and the **iOS Simulator barely runs.**
- **Disk: 71 GB free** — macOS (~30 GB) + Xcode (~40 GB) + build files would leave you nearly full.
- **4 cores** is marginal but the least of the problems.

**Wall 3 — You're on Intel (x86_64), which caps your macOS version.** Recent macOS (the 26/"Tahoe" generation) is **Apple-Silicon-only** — it won't run on an Intel-emulated VM at all. So you'd be stuck on the last Intel-supporting macOS (Sequoia-era), which in turn **caps how new an Xcode you can install.** That directly undercuts your "stay up to date" goal.

**Honest verdict:** on *this* box, a Mac VM would be a slow, rule-breaking, version-capped machine that eats all your RAM. I wouldn't build your publishing story on it.

## What actually fits, given "private + not GitHub CI"

Ranked for your situation:

1. **A cheap used Mac mini** (M1, often ~$300–400 used). If you publish even occasionally, this is the pragmatic winner: **fully legal, runs the latest Xcode, private, no monthly fee, one-time cost.** It becomes your publish button and can even host builds. For someone maintaining real shipping apps, this usually beats every workaround.
2. **Pay-as-you-go cloud Mac by the hour** (MacinCloud, MacStadium, Scaleway Mac minis). Legit, private, no GitHub. You rent a real Mac for the 20 minutes it takes to archive and submit, then let it go. Costs a few dollars per session — cheaper than a Mac if you publish rarely.
3. **GitHub Actions on your existing private repo** — still the zero-hardware option if you ever change your mind; you'd only spend the free macOS minutes when you actually cut a release.

And regardless of which you pick for *publishing*: **your daily development and on-device testing stays on Linux with xtool + zsign** — that part of your plan is solid and I can still set it up.

Two quick things so I aim the setup right:

1. **Do you have *any* Mac access at all** — even occasionally (a friend's, work, an old one in a drawer)? Or truly zero?
2. **How often do you expect to actually publish** — like weekly, a few times a year, or "rarely, mostly just testing on my own phone"?

That'll tell us whether it's worth a $300 Mac mini, an hourly cloud Mac, or just leaning on Linux + an occasional borrowed Mac. Meanwhile, want me to go ahead and install the Linux testing toolchain (Swift + build deps + zsign) so that half is ready to go?

_ran: `Bash`, `AskUserQuestion`_


---
### 2026-07-05 · local · session `b54e0a9c`

**🗣️ You:**

What projects do you see in the directory?

**🤖 Claude:**

Here are the project directories I can see in `/home/ravenhoward`:

## Application / project directories

| Directory | Likely purpose |
|---|---|
| **murmur-server** | Server component of a "Murmur" app |
| **murmur-voice** | Voice component of Murmur |
| **murmur-data** | Data/storage for Murmur |
| **murmur-inbox** | Inbox for Murmur |
| *(also `murmur.code-workspace`)* | VS Code workspace tying Murmur pieces together |
| **daily-briefing** | A daily briefing app/service |
| **finance** | Finance-related project |
| **dashboard** | A dashboard project |
| **sauce-mcp** | MCP server (matches the "Sauce Recipes" connector) |
| **vault-mcp** | MCP server for a "vault" |
| **vault-mirror** | Vault mirroring/backup |
| **immich** | Immich (self-hosted photo management) |
| **couchdb** | CouchDB instance/data |
| **supabase** | Supabase (backend/database) instance |
| **agent-logs** | Logs from agent runs |
| **bin** | User scripts/binaries |
| **Sync** | Sync folder |

## Notes
- None of these are git repos at the top level (`/home/ravenhoward` itself isn't one), though individual project folders may be — I'd need to check each.
- The "murmur-*" folders clearly form one larger project, grouped by the `murmur.code-workspace` file.
- `sauce-mcp` and `vault-mcp` look like MCP servers you're developing — interesting given the "Sauce Recipes" connector appears in the available (unauthorized) MCP list.

Want me to dig into any of these — e.g., check which are git repos, read their READMEs, or summarize what a specific project does?

_ran: `Bash`_

**🗣️ You:**

Sauce and murmur are iOS apps. Are there cloud tools you can use on Linux to develop iOS apps that are free and open source? Looking for workarounds for this limitation

**🤖 Claude:**

Short version: **Apple's own toolchain (final SwiftUI/UIKit compile + code signing + App Store upload) legally requires macOS on Apple hardware.** That wall is real and no FOSS tool fully removes it. But you can do a surprising amount of iOS work on Linux, and the "last mile" can be handled by a *free cloud Mac* rather than a physical one. Here's the honest landscape:

## What actually runs on Linux (FOSS)

**1. Swift toolchain itself** — `swift.org` ships an official open-source Swift compiler + `swift-corelibs-foundation` for Linux. You can write, build, and unit-test all your **non-UI logic** (networking, models, business rules, Swift packages) natively on Linux today. What's *missing* is UIKit/SwiftUI — those are closed Apple frameworks with no Linux implementation.

**2. `xtool`** (`github.com/xtool-org/xtool`) — the most relevant recent project. It's an open-source, cross-platform Xcode replacement that can **build and deploy a real SwiftUI iOS app from Linux/Windows** using the open Swift toolchain + Apple's SDK stubs. This is the closest thing to what you're asking for. It's young and moving fast, so capabilities/limits shift — worth testing against your actual Murmur/Sauce projects rather than trusting a feature list.

**3. `theos`** — mature open-source iOS build system (big in the tweak/jailbreak world), runs on Linux, drives clang/Swift to produce iOS binaries.

**4. `libimobiledevice` + `ios-deploy`** — FOSS libraries to talk to a physical iPhone *from Linux*: install apps, stream logs, debug. Genuinely useful for the on-device loop.

## The realistic "cloud" workaround (free)

**GitHub Actions free macOS runners + fastlane.** This is what most people actually use:
- Apple-hosted macOS runners are **free for public repos** (and a monthly free-minute allotment for private).
- `fastlane` (open source) automates `xcodebuild`, signing, TestFlight, and App Store upload.
- Your workflow YAML is open/version-controlled; you develop on Linux and let the Mac runner do the signed build + submission.

**Codemagic / Cirrus CI** have similar free tiers for mobile CI if GitHub Actions minutes get tight.

## The gray-area option

**Docker-OSX / OSX-KVM** — open-source projects that run macOS (and Xcode) in a VM on Linux. Technically feasible, but: (a) it **violates Apple's EULA** (macOS is licensed only on Apple hardware), and (b) the iOS Simulator barely works under nested virtualization with no GPU passthrough. I'd treat this as a curiosity, not a workflow.

## My recommendation for your setup

Since Sauce and Murmur are existing iOS apps:

1. **Develop + test logic on Linux** with the Swift toolchain (and `xtool` for building).
2. **Wire up GitHub Actions macOS runners + fastlane** for signed builds, TestFlight, and App Store submission — that's your free, legit "cloud Mac."
3. Keep `libimobiledevice` around for on-device debugging if you have a physical iPhone.

---

Two things worth flagging: `xtool` in particular is evolving quickly and my knowledge cuts off around January 2026, so the current state may have shifted. Want me to **run a web search / deep-research pass** to confirm the latest capabilities (especially whether `xtool` can now handle full signing + App Store submission solo)? I can also **look inside your `murmur-*` and `sauce-mcp` folders** to see how the projects are structured and suggest a concrete CI setup tailored to them.

**🗣️ You:**

How’s it going now?

**🤖 Claude:**

The research finished, though the final synthesis step got cut off by an API session limit (resets midnight UTC), and a batch of the CI/free-tier claims couldn't be verified for the same reason. I have the 14 verified findings plus the refuted/unverified list — let me grab the truncated tail, then synthesize the report myself and clearly mark what's independently verified vs. what I'm filling in from knowledge.

Research is done. The workflow verified the core findings before an API session limit (resets midnight UTC) cut off the final synthesis and a batch of the CI/submission claims — so I'll synthesize it myself, clearly marking what got **independently fact-checked (3-vote verified)** vs. what I'm **filling in from knowledge** (claims the tool queued but couldn't verify due to the limit — not refuted, just unconfirmed).

Bottom line up front: **there is now a real pure-Linux build path (`xtool`), but no FOSS tool removes the two hard walls — an Apple Developer account for signing, and Apple's servers for App Store submission.** For *shipping* existing apps, a free cloud Mac (GitHub Actions) is still the sane route.

---

## 1. Building on Linux directly

**`xtool`** (github.com/xtool-org/xtool) — the standout, actively maintained project. ✓*Verified:*
- Builds a **SwiftPM package into an iOS app entirely on Linux** (also WSL/macOS), can **sign and install to a device**, and talks to **Apple Developer Services** programmatically. It provides UIKit/SwiftUI on Linux by **extracting them from the real iOS SDK**.
- ⚠️ **Two hard caveats, both verified:** (1) it **cannot deploy to App Store Connect yet** — no TestFlight/App Store submission from the tool; (2) it needs you to **supply Apple's `Xcode.xip`** yourself to build the SDK locally (requires Swift 6.1+). So it's not a clean-room stub — you download Apple's toolchain, you just run it on Linux.
- *Unverified (session limit, from knowledge):* it has two backends — a macOS-only "XcodePacker" and a cross-platform "Packer" that builds directly via SwiftPM. It's SwiftPM-centric, which matters for you (see the caveat at the end).

**`CrossCode`** (github.com/nab138/CrossCode) — ✓*Verified:* a Win/Linux IDE targeting Swift 6.2 to create/build/test apps without a Mac, with **Apple-ID-based signing and on-device install**. Newer/less proven than xtool but worth watching.

**Swift toolchain (swift.org) on Linux** — runs natively for **non-UI logic and tests**; UIKit/SwiftUI are not natively present (that's exactly the gap xtool fills by extracting them).

**`theos`** — mature Linux-capable build system, but oriented to tweaks/jailbreak workflows rather than App Store apps.

## 2. Code signing & device deploy from Linux

**`zsign`** (github.com/zhlynn/zsign) — ✓*Verified, strongest result (3-0 across the board):* a fast, MIT-licensed, **cross-platform `codesign` alternative** that re-signs `.ipa`/Mach-O/`.app` on **Linux with no macOS/Xcode**. **Actively maintained — v1.0.4, April 2026, ~1.8k stars.** You supply a **private key/P12, provisioning profile, and certificate (PEM/DER)** — i.e. it signs on Linux but you still need Apple-issued credentials.
- *Unverified/knowledge:* you can even generate the CSR/key with **OpenSSL** on Linux and get the cert issued by Apple, so the whole signing chain can avoid a Mac.

**`isign`** (sauce-archives/isign) — ✓*Verified:* Python re-signer, but **archived Feb 2020, unmaintained.** Note the tool **refuted (0-3)** the idea that you need a Mac to obtain the credentials — you don't. Prefer zsign.

**`Sideloader`** (Dadoum/Sideloader) — *Unverified (session limit):* cross-platform installer (Cydia Impactor replacement) with a **GTK4 Linux frontend** that fetches a dev certificate the way Xcode does, needing only an Apple account. Plausible and relevant, but I couldn't fact-check it this run.

**`libimobiledevice` / `ios-deploy`** — the FOSS glue to install/debug on a physical iPhone from Linux.

## 3. Free cloud/CI "Mac"

**GitHub Actions macOS runners** — ✓*Verified:* **free and unlimited on public repos**, including macOS. For **private repos**, macOS draws down your monthly free minutes and is then billed — and it's the **most expensive tier** (macOS minutes count ~10× against quota). This is the most reliable free cloud Mac. Pair with **fastlane** for build + signing + submission.

*Unverified (session limit — treat as ~accurate, not confirmed):* Codemagic free tier (~500 macOS-M2 min/mo), Xcode Cloud (~25 compute hours/mo included with a Developer membership), and fastlane's `upload_to_testflight` supporting **App Store Connect API keys** (avoids 2FA) — some reports of running it from Linux via Transporter.

## 4. macOS in a VM (Docker-OSX / OSX-KVM)

✓*Verified from the projects' own author:* Apple's EULA licenses macOS **only on Apple hardware**. The EULA permits up to 2 VM instances **but only on a Mac you own** — so running it on your Linux box is an **EULA violation**, per Docker-OSX's own maintainer. Plus the iOS Simulator barely works without GPU passthrough. Skip it.

## 5. App Store submission — the hard wall

*Unverified this run but well-established:* the **App Store Connect API is a REST API (JWT auth)**, so *uploading* a build isn't strictly tied to the Xcode GUI. **But** every path ends with **Apple's servers processing the build**, an **Apple Developer Program membership ($99/yr)**, and **App Review**. No FOSS tool removes those.

---

## Recommended pipelines for you (Sauce + Murmur)

**The realistic free shipping pipeline:**
1. **Develop & iterate on Linux** — Swift toolchain for logic/tests; **xtool + zsign + libimobiledevice** for building and testing on a real iPhone. This gives you a genuine no-Mac inner loop.
2. **Release via GitHub Actions macOS runner + fastlane** — signed archive → TestFlight/App Store. **Make the repo public and it's unlimited-free**; private burns limited macOS minutes fast.

**One caveat that specifically affects you:** xtool is **SwiftPM-centric**. If Sauce/Murmur are conventional **`.xcodeproj`/`.xcworkspace` apps** (storyboards, asset catalogs, CocoaPods, custom build phases), the **pure-Linux xtool build may not accept them as-is** — you'd either restructure toward SwiftPM or lean on the CI-Mac path, which builds your existing Xcode project unchanged. 

I can look inside the `murmur-*` and `sauce-mcp` folders to see how the iOS projects are actually structured (SwiftPM vs. Xcode project) and then draft you a **concrete GitHub Actions + fastlane workflow file**, plus a local `xtool`/`zsign` setup script. Want me to do that? (Also note: the unverified free-tier numbers above are worth a fresh check after the API limit resets — I can re-run just that slice.)

_ran: `Read`_

**🗣️ You:**

How do most of the mainstream tools that handle of that for you work? Assuming like GitHub actions? 

I think we can go ahead and get the xtool and zsign setup because that’s just for testing. And then Xcode can run off of GitHub so it will be up to date if I need to publish anything on my Mac

**🤖 Claude:**

Great plan — and it's the right mental model. Let me answer the "how do the mainstream tools actually work" question first, clear up one small thing in your plan, then start the setup (I'll poke at your machine to see what we're working with while I explain).

Good instinct on the split — but I hit something important while poking around, so let me give you the "how it works" explanation, fix one small thing in your plan, then show you what I found.

## How the mainstream tools actually work (GitHub Actions + fastlane)

The magic is that they **script the exact clicks you'd do in Xcode, on a rented Mac, triggered automatically.** Piece by piece:

**1. The runner = a throwaway Mac.** When you push code (or click "run"), GitHub boots a **fresh, clean macOS virtual machine that it owns**, with **Xcode already installed** — actually several Xcode versions pre-installed, kept current by GitHub. Your job runs, then the machine is **destroyed**. You never patch or maintain anything.

**2. The workflow file = a recipe.** A little `.github/workflows/release.yml` file in your repo lists the steps in plain terms: *check out code → pick Xcode 26 → install dependencies → build & archive → sign → upload to TestFlight.* GitHub reads it top to bottom on that rented Mac.

**3. fastlane = the button-presser.** Apple's raw command-line tools (`xcodebuild`, Transporter, the App Store Connect API) are finicky. **fastlane** wraps them into named "lanes" so one command — `fastlane beta` — does the whole chain: bump build number → build → sign → upload. It's the layer that means you don't hand-write Apple's cryptic commands.

**4. The hard part they solve for you — signing secrets.** The throwaway Mac starts empty, so how does it get your private signing certificate without you leaking it? Two mechanisms:
   - **fastlane `match`** stores your certificates + provisioning profiles **encrypted in a private repo**, and installs them into the runner's keychain at the start of each run.
   - **GitHub Secrets** — an encrypted vault in your repo settings — holds your **App Store Connect API key** and the match passphrase, injected as environment variables. The API key is what lets it talk to Apple **without your Apple ID password or 2FA codes**.

**5. Apple still does the last mile.** The runner uploads the signed build to App Store Connect via Apple's API; **Apple's servers process it**; it appears in TestFlight / ready for review. fastlane can even submit it for review. That part is always Apple's — the tools just automate *reaching* it.

So the whole "it handles it for you" is: **secure secrets + a recipe file + a pre-loaded rented Mac.** That's it.

## One fix to your plan

> *"Xcode can run off GitHub so it will be up to date if I need to publish anything on my Mac"*

Almost — the key upgrade to your mental model: **GitHub's runner *is* the Mac.** You don't need a Mac of your own at all. GitHub keeps its runners' Xcode current, so publishing happens **on GitHub's Mac**, not yours. If you happen to have a Mac, great, you *can* publish from it — but the whole point is you no longer *have to*. Your plan works even with zero Macs in your life.

## What I found on your machine (the catch)

I checked your box before installing anything. Good news: it's a capable host — **Ubuntu 24.04, x86_64, 4 cores, 71 GB free.** But two things:

- **Swift isn't installed**, and a few build tools are missing (`clang`, `cmake`, `unzip`) — all easily fixed.
- **The bigger one: there's no iOS app source code on this machine at all.** No `.xcodeproj`, no `Package.swift`, no `.swift` files anywhere. The `murmur-*` and `sauce-mcp` folders are all **backend/server** code — not the iOS apps themselves.

That matters because **xtool and zsign need the actual app code to do anything.** Installing them onto a machine with no app to build would be setting up an empty workbench. So before I install the toolchain, I need to know where the real iOS source lives.

Got it — and let me untangle two things, because there's a small misconception worth clearing up, then I'll answer the VM question straight.

**On the "GitHub route":** version-control backups and the publishing pipeline are *separate things that happen to live in the same repo.* You can keep your private repo purely as a backup and **never touch GitHub Actions** — that's totally fine. But also worth knowing: **Actions works on private repos too.** You don't have to make anything public. Private repos get ~2,000 free minutes/month; macOS burns them ~10× faster, so ~200 macOS-minutes/month free, then it's pay-per-minute. So "private repo" was never the blocker — you opted out of CI, which is a separate choice. Just want that on the table.

Now, your actual question:

## Can you run your own Mac VM? Here's how it works

**The technical idea:** Your Linux machine has a virtualization engine (KVM/QEMU) that can pretend to be different hardware. Projects like **Docker-OSX** and **OSX-KVM** package up the tricky configuration needed to make QEMU impersonate a real Mac closely enough that macOS boots and runs. You feed it a macOS installer image, it spins up a virtual "Mac," you install macOS, then install Xcode inside it. From there it behaves like a Mac desktop in a window. That's the dream: your own private, self-hosted Mac, no GitHub, no monthly fee.

**But there are three walls, and for your specific machine, they're steep:**

**Wall 1 — It breaks Apple's license.** This one's verified from the research: Apple licenses macOS to run **only on Apple hardware.** The EULA allows a couple of macOS VMs, *but only on a Mac you already own.* Running it on your Ubuntu PC is a EULA violation — even the author of Docker-OSX says so plainly. Not a police-at-your-door thing, but it's officially against the rules, and it's why no one can offer it as a real product.

**Wall 2 — Your hardware can't really run it.** This is the practical dealbreaker, and I'm looking at your actual specs:
- **RAM: 7.7 GB total** (and ~4 GB already in use). A macOS VM wants **8 GB+ just for itself**, and Xcode is a notorious memory hog on top of that. You can't give a VM more RAM than you physically have. This alone makes it painful-to-unusable.
- **No GPU passthrough** → macOS renders in software → the whole UI is laggy, and the **iOS Simulator barely runs.**
- **Disk: 71 GB free** — macOS (~30 GB) + Xcode (~40 GB) + build files would leave you nearly full.
- **4 cores** is marginal but the least of the problems.

**Wall 3 — You're on Intel (x86_64), which caps your macOS version.** Recent macOS (the 26/"Tahoe" generation) is **Apple-Silicon-only** — it won't run on an Intel-emulated VM at all. So you'd be stuck on the last Intel-supporting macOS (Sequoia-era), which in turn **caps how new an Xcode you can install.** That directly undercuts your "stay up to date" goal.

**Honest verdict:** on *this* box, a Mac VM would be a slow, rule-breaking, version-capped machine that eats all your RAM. I wouldn't build your publishing story on it.

## What actually fits, given "private + not GitHub CI"

Ranked for your situation:

1. **A cheap used Mac mini** (M1, often ~$300–400 used). If you publish even occasionally, this is the pragmatic winner: **fully legal, runs the latest Xcode, private, no monthly fee, one-time cost.** It becomes your publish button and can even host builds. For someone maintaining real shipping apps, this usually beats every workaround.
2. **Pay-as-you-go cloud Mac by the hour** (MacinCloud, MacStadium, Scaleway Mac minis). Legit, private, no GitHub. You rent a real Mac for the 20 minutes it takes to archive and submit, then let it go. Costs a few dollars per session — cheaper than a Mac if you publish rarely.
3. **GitHub Actions on your existing private repo** — still the zero-hardware option if you ever change your mind; you'd only spend the free macOS minutes when you actually cut a release.

And regardless of which you pick for *publishing*: **your daily development and on-device testing stays on Linux with xtool + zsign** — that part of your plan is solid and I can still set it up.

Two quick things so I aim the setup right:

1. **Do you have *any* Mac access at all** — even occasionally (a friend's, work, an old one in a drawer)? Or truly zero?
2. **How often do you expect to actually publish** — like weekly, a few times a year, or "rarely, mostly just testing on my own phone"?

That'll tell us whether it's worth a $300 Mac mini, an hourly cloud Mac, or just leaning on Linux + an occasional borrowed Mac. Meanwhile, want me to go ahead and install the Linux testing toolchain (Swift + build deps + zsign) so that half is ready to go?

_ran: `Bash`, `AskUserQuestion`_


---
### 2026-07-07 · local · session `2280ee9f`

**🗣️ You:**

Your vault is at /home/ravenhoward/vault-mirror/current (added read-only). Before answering, quietly read these for grounding (only surface them if relevant): /home/ravenhoward/vault-mirror/current/~me.md; /home/ravenhoward/vault-mirror/current/~journal-types-map.md; /home/ravenhoward/vault-mirror/current/01) lovinggod/soul/Personal Liturgy.md.

Ground rules: When you look through my journals, use only my genuine entries (Calendar/Journal/Daily Journals and my real dated notes); skip AI-drafted files (names starting with ~) and the 'rosebud' reflection wrappers — keep only my own words. Never write to or edit my journal or any file. You ask; I answer. Speak as invitation, not indictment. Be concrete and specific — real words and real nudges, no vague filler.

Passages related by meaning (not keywords) to what I'm asking — from your own vault and from things Presence has remembered before. Use them as leads: read the full note with your tools if useful, and only surface what's genuinely relevant. Don't recite this list mechanically.
- /home/ravenhoward/vault-mirror/current/AIOS/log.md › [2026-04-29] migrate | Phase 2 file moves complete
  Vault root is now clean: only the 5 numbered role folders + AIOS, Attachments, Calendar, resources, _archive, _unsorted, ~me.md, ~vault-map.md. Pending Raven's review: - `~me.md` content (working preferences, frameworks)
- /home/ravenhoward/vault-mirror/current/05) maker/Presence/Setup Guide.md › 5. Mac → vault pull
  ## 5. Mac → vault pull ```bash ssh-copy-id ravenhoward@ravelab.local # passwordless SSH (one time) chmod +x ~/dev/murmur/scripts/mac-pull.sh cp ~/dev/murmur/scripts/org.ravenhoward.murmur-pull.plist ~/Library/LaunchAgent
- /home/ravenhoward/vault-mirror/current/05) maker/Sauce/Deployment.md › What's where
  ## What's where | Thing | Value | |---|---| | **API base (public)** | `https://sauce-api.ravenhoward.org` — via the existing `vault` Cloudflare tunnel; works off-LAN (phone on cellular) | | API base (LAN direct) | `http:
- /home/ravenhoward/vault-mirror/current/_infra-changes-2026-07-04.md › 3. ravelab reorganized into `~/dev`
  ## 3. ravelab reorganized into `~/dev` - Moved 6 code projects out of the home junk-drawer into `~/dev/` (matches the Mac's `~/dev`): finance, daily-briefing, murmur-server, murmur-voice, vault-mcp, sauce-mcp. - **Data d
- /home/ravenhoward/vault-mirror/current/00) active/Closet, inbox, vault — same intake gap.md › Downloads folder
  ### Downloads folder **Intake-time action:** When you download something, one question fires: **"will I need this for the next 30 days?"** Yes → rename now (date prefix is fine) and drop in the right vault folder. No → t
- /home/ravenhoward/vault-mirror/current/05) maker/Presence/Sync Design.md › Two-hop flow
  ## Two-hop flow ``` 📱 phone ──POST /ingest──▶ 🖥️ ravelab (always on) ──rsync pull──▶ 💻 Mac vault markdown ~/murmur-inbox/ 05) maker/Presence/Voice Inbox ``` 1. **Phone → ravelab.** App POSTs `{folder, filenam

Me: Use your Grep tool to search my vault for the exact word Rolheiser and tell me one file path it appears in. You must actually run the tool.

**🤖 Claude:**

Searching your vault now.

One match: `/home/ravenhoward/vault-mirror/current/.obsidian/plugins/snipd-official/data.json`

_ran: `Grep`_


---
### 2026-07-07 · local · session `08db5d25`

**🗣️ You:**

Okay this is helpful but I have a ton of different contexts: there’s murmur now called presence, job search which is in my obsidian vault, sauce, etc. does Claude have the master list of everything and it should prompt me to create a new project or context if needed as well

**🤖 Claude:**

Great question — and the honest answer up front: **no, Claude does not have a master list of all your contexts, and nothing prompts you to spin up a new one.** Those aren't built-in behaviors. What you have right now is two *separate*, partial mechanisms that don't talk to each other:

- **Auto-memory** (`MEMORY.md`) — loads every session, but it's a bag of *facts*, not a project registry.
- **`CLAUDE.md` files** — discovered only by the folder you happen to start in. No global index.

So "murmur/presence" has a router, but "job search" and "sauce" are invisible unless you're sitting in the right folder or happen to have a memory about them. Let me actually map what exists before I propose the fix.

That's the real picture — and it shows the problem crisply. You have **~10 code projects** in `~/dev` plus a whole **Obsidian vault** of knowledge areas, but only **one** (`murmur`) has a router. Everything else is effectively invisible to a fresh session. Let me quickly probe the unclear ones and find where things like "job search" live before I design the fix.

Now I've got the full landscape, and it's genuinely big. Here's what actually exists:

**Code** (`~/dev`): `daily-briefing`, `finance`, `murmur`/Presence, `murmur-bible`, `murmur-server`, `murmur-voice`, `sauce` + `sauce-mcp`, `tools`, `vault-mcp`

**Maker/work knowledge** (vault `05) maker/`): Presence, Sauce, finance, Training Stack, vendr, saves-engine, Podcast Pipeline, **career → "2026 job search"**, aiden-mcp…

**Life areas** (vault top level): `01) lovinggod`, `02) ellen hudson`, `03) family`, `04) church`, `Running`, `buying truck`…

Two things jump out. First, several things are **mirrored** — Presence, Sauce, finance, Training Stack each exist as *both* code (`~/dev`) and vault notes (`05) maker/`). Second, "job search" isn't a code project at all — it's `05) maker/career/2026 job search` in the vault.

## The design (this answers both your questions)

There's no master list today, but the fix is clean: **turn `~/CLAUDE.md` into a master context registry.** It already auto-loads on every phone session, so it's the one file guaranteed to be in front of Claude. I'll make it hold:

1. **A registry table** — every context, its type (code / vault-knowledge / life-area), where it lives, a one-line purpose, and *how to engage it* (open a `~/dev` router, read a vault folder, or use an MCP like Sauce_Recipes / Obsidian).
2. **A "new context" protocol** — a standing instruction: *when your topic doesn't match anything in the registry, Claude offers to create one* — `/blueprint` a new `~/dev/<name>` for code, or a vault folder (+ context note) for knowledge — and then adds it to the registry.

That gives you exactly what you asked: a master list Claude always sees, and proactive prompting to spin up new contexts.

Before I build it, one fork is genuinely yours to decide — how wide the registry should be:

_ran: `Bash`, `AskUserQuestion`_

**🗣️ You:**

[Request interrupted by user]

Yeah let’s do everything. Thinking the workflow should be I start a new Claude session and say what am I working on or show me my contexts and I can pick or spin up a new ones. For all my existing ones it has the blueprint setup so it knows where I was left off despite if it is a cloud or local session on here or my Mac. 

If it’s a new one it will setup the structure

**🤖 Claude:**

Perfect — that workflow is exactly the right shape, and it's very achievable. Let me build the keystone: rewrite `~/CLAUDE.md` from a murmur-only pointer into the **master context registry** that drives that whole flow.

Now let me update memory to reflect that `~/CLAUDE.md` is now the master registry, not just a murmur pointer.

Done. Here's where things stand — and I want to be straight about what works now vs. what's still a gap.

## What's live right now
`~/CLAUDE.md` is now your **master registry**, and because it auto-loads on every home-scoped session (i.e. all your phone/remote sessions on ravelab), the workflow you described works immediately:

- You start a session and say **"what am I working on"** → Claude shows the picker (Code / Maker / Life).
- You **pick one** → Claude loads that context and tells you the "up next."
- Your topic **matches nothing** → Claude offers to create one and scaffolds it.

It covers everything: 10 code projects, the maker/vault areas (including `2026 job search`), and life areas (family, church, walk with God, running, truck).

## The honest gaps (so you're not surprised)
1. **Only Presence/murmur is actually blueprinted.** The other ~9 code projects and all the vault areas are *registered* (Claude knows they exist and where), but they have no `TASKS.md`/`SESSIONS.md` yet — so "where I left off" is real for murmur and thin for the rest until we scaffold them. They're marked `—` in the registry.
2. **Cross-machine isn't automatic yet.** Resume "on here or my Mac or cloud" works *if* two things are true: the registry file exists on that machine, and the repo's `SESSIONS.md`/`TASKS.md` are committed + pushed. On ravelab that's set. **The Mac needs its own copy of `~/CLAUDE.md`** (I can't see the Mac from here to place it) — and cloud sessions only see what's committed to git.
3. **Auto-SESSIONS covers murmur only.** The Stop hook I added regenerates *murmur's* `SESSIONS.md`. Extending it per-context is a follow-up.

## Suggested next step
Roll `/blueprint` across the rest so resume works everywhere — but each one needs a real look (some repos may be empty or stale), so I'd do them properly, not blindly. I'd start with the **active** ones: `daily-briefing`, `murmur-server`, `sauce` + `sauce-mcp`, `finance` — then the vault's `2026 job search`.

Want me to start blueprinting that active batch now (I'll go one at a time and show you each router before moving on)? Or would you rather I first sort out the **Mac + cloud sync** of the registry so the whole thing is portable before we deepen individual contexts?

_ran: `Write`, `Edit`_

**🗣️ You:**

Blueprint the rest. I just tested with an nda question and it didn’t pick up any of the job search context

**🤖 Claude:**

Two things: I'll blueprint the rest, and — more urgently — the NDA/job-search miss is a real gap I want to fix, because it exposes *why* vault contexts don't "just work." Let me look at what's actually in the job-search folder and diagnose the pickup failure.

Diagnosis confirmed — and it's an important design gap, not a one-off. The job-search folder is **rich and fully readable from here** (Job Applications Tracker, Job Search Boundaries, Company Target List, an `Applications/Zip - Solutions Engineer/` with a recruiter debrief, Synergi/ERS interview prep). The content was always there. The failure is that the registry only loads a vault context when you *explicitly pick it from the menu* — but you just **asked an NDA question directly**, and nothing told Claude to (a) connect "NDA" → job search, or (b) go read the vault.

Fix = make contexts **auto-load on trigger words**, not just on menu-pick, and make vault-reading explicit. Let me patch the registry:

Now enrich the job-search row with trigger words and its key files:

Job-search pickup is fixed — now an NDA/offer/recruiter question auto-loads the vault context before answering. I'll re-sync the registry to GitHub at the end. Now to the main ask: **blueprint the rest.** Let me inspect all remaining repos in one pass:

Good — now I can see the shape of each. Notable: **sauce** is a full monorepo (api/web/iOS/extension/mcp), **murmur-bible** and **sauce-mcp** aren't git repos yet (need creating), and **murmur-voice** is just a 2-file scan script (I'll fold that rather than make a repo for it).

Let me blueprint them. Starting with the two biggest — sauce and finance:

sauce (6564 SESSIONS lines) and finance (4565) are blueprinted and pushed. Now murmur-server, murmur-bible, and vault-mcp — plus creating the two that aren't repos yet.

Now the git work. First the two that already have remotes — murmur-server and vault-mcp (I'll also make sure vault-mcp's `venv/` isn't tracked):

murmur-server and vault-mcp done. Now the two that need creating — murmur-bible and sauce-mcp. I'll check sizes and scan for secrets before pushing:

Two things to resolve before these go up: **murmur-bible is 209M** but data/ is only 240K — something heavy is hiding — and **sauce-mcp has a `.env`** (must be ignored). The secret-scan hits look like false positives (code referencing "token"/"supabase"), but I need to see the actual lines to be sure nothing's hardcoded:

Both clean — all the "secret" hits are **variables reading from `process.env`/env**, not hardcoded values (confirmed: `SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY`, and murmur-bible uses a `KEY` var). The only real bulk is murmur-bible's **`.venv/` (209M)** and sauce-mcp's **`.env`** — both just need ignoring. Creating and pushing all three now:

All three created and pushed — murmur-bible (832K, venv excluded), sauce-mcp (`.env` confirmed ignored), murmur-voice (4K). Now let me flip all the registry flags to reflect reality:

Now verify everything on GitHub and re-sync the registry to your dotfiles repo:

Everything's on GitHub and private. And I spotted something useful in that list: **`training-stack-ios` and `training-stack-mcp` already exist as private repos** — that's why Training Stack had no code on ravelab (its build lane lives on the Mac + GitHub, exactly as we theorized). Let me wire those real repos into the Training Stack entry so the context points at actual code:

Let me sync that final registry change and update memory with the completed rollout:

Both done. Here's the full picture.

## Job-search pickup — fixed
The real gap: the registry only loaded a vault context when you *picked it from the menu*. Now there's an **"auto-load on triggers"** rule — an NDA / offer / recruiter / company-name question makes Claude read the job-search vault folder (`Job Applications Tracker`, `Job Search Boundaries`, `Applications/<company>/`) **before answering**, so you get your real situation instead of a generic reply. Your job-search notes were always readable from ravelab — nothing was ever loading them.

## Blueprint rollout — complete
Every `~/dev` project is now a **private GitHub repo** and blueprinted:

| Blueprinted (router + TASKS + SESSIONS) | On GitHub, lighter |
|---|---|
| murmur ✅, daily-briefing ✅, sauce ✅, finance ✅, murmur-server ✅, murmur-bible ✅, vault-mcp ✅ | sauce-mcp, murmur-voice, tools (curated) |

SESSIONS distilled from your real history (sauce 6.5k lines, finance 4.6k, murmur-server 2k, etc.). All committed and pushed.

## Two useful discoveries
- **`gh` is installed + authed** (device flow, no token in chat) — I can create/manage repos for you going forward.
- **Your GitHub has repos not on ravelab** — notably **`training-stack-ios` + `training-stack-mcp`**. That confirms the multi-lane theory: Training Stack's build lane lives on the Mac + GitHub, use lane via MCP. I pointed the registry's Training Stack entry at those real repos.

## What still needs *you* (I can't from ravelab)
1. **Vault `_context.md` files** (Training Stack build notes, 2026 job-search summary) — must be written through **Obsidian**; the ravelab vault mirror is read-only.
2. **`chezmoi update` on your Mac** — lands the registry there so the whole system loads on the Mac too.
3. A couple of judgment calls I flagged in TASKS: reconcile `sauce-mcp` vs `sauce/recipe-mcp`, and commit the WIP sitting in `murmur-server` (`brain.sh`, `embed.py`).

Want me to knock out anything else — e.g. blueprint the **Mac-only** repos (`training-stack-ios`) by cloning them here read-only for the routers, or set up the per-context SESSIONS auto-refresh hook for the new repos like murmur has?

_ran: `Bash`, `Edit`, `Write`_

**🗣️ You:**

Yes ensure everything has a blueprint and as I add sessions everything will fall into that structure

**🤖 Claude:**

Yes — let's make it uniform and self-sustaining. Two parts to "everything has a blueprint" + "sessions fall into the structure":
1. **Every repo gets a router + TASKS + SESSIONS** (the blueprint).
2. **A generalized auto-refresh** so every context's `SESSIONS.md` regenerates on its own — not just murmur's.

I'll parallelize the router-writing across subagents (one per repo) while I build the automation myself. Launching the blueprint agents now:

8 blueprint agents are running in the background. While they work, let me build the **auto-refresh engine** — the part that makes "sessions fall into the structure" true for *every* context, not just murmur. It's a manifest of contexts + a script that regenerates each `SESSIONS.md`, driven by a timer.

6 of 8 routers done (aiden-mcp, murmur-voice, gmail-followup-agent, Remain, tools, sauce-mcp — which flagged the byte-identical duplicate vs `sauce/recipe-mcp`). training-stack-ios/mcp still writing. Let me finish the automation — the refresh script and its timer:

7 of 8 done — just training-stack-ios still going. Now the systemd timer to run the refresh, plus the legacy routers:

The timer's first run is mid-flight (that's why my manual run saw the lock held). Let me wait for it to finish and verify — it's scanning all 18 contexts:

_ran: `Agent`, `Write`, `Bash`_

