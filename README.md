# Connection Builder

Build in this order, working screen after each step before the next:

1. Migrations: all tables above + RLS policies exactly as specified.

2. Auth + single-screen onboarding -> profiles.

3. Queue screen: join -> realtime subscribe -> live count + 30s

   timeout state.

4. Matching: Postgres fn per the algo above, triggered on insert.

5. Session room: LiveKit React SDK, tokens minted server-side via edge

   fn (LIVEKIT_API_KEY/SECRET/URL env vars). No custom signaling.

6. Round timer, swap, end -> full state machine via edge fn.

7. Peer feedback form -> feedback_reports source=peer.

8. AI feedback edge fn -> generateFeedback() abstraction, LLM_PROVIDER

   env var switch -> feedback_reports source=ai.

9. /report/:sessionId: radar chart + breakdown + focus callout.

10. No-show cron/check -> credits + trust_score updates per spec.

Env vars only, no hardcoded keys. Push to GitHub via Lovable's sync as

incremental commits, not one squash.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://soul-link-flame.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/070452d0-608c-45ee-b9a4-d883ec0d0d32).

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
