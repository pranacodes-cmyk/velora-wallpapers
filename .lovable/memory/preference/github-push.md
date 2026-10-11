---
name: Always push to GitHub with the token
description: Every change must be pushed to pranacodes-cmyk/velora-wallpapers using the GITHUB_PUSH_TOKEN secret via the GitHub API; user reviews the live preview
type: preference
---
Every turn that changes code must end with the code pushed to GitHub `pranacodes-cmyk/velora-wallpapers` (`main`) — the user does not want to ask for it each time.

**How to apply:**
- `git push` is blocked in this sandbox. Push with the GitHub REST API (blobs → tree → commit → refs) using the secret `GITHUB_PUSH_TOKEN` (available as an env var in an edge function / script; see `/tmp/ghsync.mjs` pattern).
- Push only; never trigger a workflow / APK build unless the user explicitly asks in that message.
- Repo stays private.
- The user verifies UI on the Lovable live preview, so web mirror must always be in sync with Flutter.
