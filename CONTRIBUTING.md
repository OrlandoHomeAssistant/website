# Contributing

Thanks for helping Orlando's smart home community. Small improvements to wording, accessibility, performance, and resource links are welcome. For a larger feature, open an issue first so we can agree on its purpose.

## Set up locally

Use Node.js 24 or newer. CI tests Node 24 and 26. If you use nvm:

```sh
nvm use
npm ci
npm run dev
```

Open the URL Wrangler prints. Local preview reads the public Orlando Luma feed. No API key is needed. Automated tests use an intercepted fixture instead of contacting Luma and need no Cloudflare or GitHub credentials.

## Before opening a pull request

Create a branch from `main`, make a focused change, then run:

```sh
npm run check
```

This runs unit tests, real Worker integration tests, generated binding type checks, and a deployment dry run. For SVG or icon changes, also run `npm run assets` and commit the generated files. CI checks that generated assets match their source.

Add or update tests when behavior changes. Integration tests live in `tests/integration/` and use Miniflare with a simulated Luma service. Relevant scenarios include empty calendars, cancelled or ended events, outage fallback, safe rendering, cache freshness, and crawl/share metadata. Keep dates deterministic; do not depend on today's real calendar.

For visual changes, check a narrow phone screen, a larger screen, both device color schemes, keyboard focus, and larger text. Include before/after screenshots in the PR when they help review. Never imply that a browser viewport test is a test on physical hardware. A Messages preview change needs a fresh share because clients cache previews.

## Project conventions

- Keep the page buildless: HTML/CSS, a small enhancement script, and a Worker. Add a dependency only when it solves a concrete problem.
- Luma owns meetup details and registration. Website content should remain useful when the next event changes.
- Distinguish Orlando's Discord/calendar from global Home Assistant resources. Do not invent attendance, ticket prices, endorsements, or accessibility details.
- Keep one advertised Open Graph image; multiple images can become tiles in Apple Messages.
- Preserve server-rendered information, keyboard accessibility, system themes, and low page weight.
- Keep secrets in local ignored files or GitHub environment secrets. Do not post a credential in an issue or PR. GitHub secret scanning and push protection are enabled.

## Review and deployment

Describe the problem, resulting behavior, and validation. The PR template is intentionally short. The required `check` status covers both supported Node versions. All files are owned by `@NimbleEngineer21` through `.github/CODEOWNERS`, and `main` requires a code-owner approval. Admin bypass remains available for administrative exceptions. GitHub does not allow PR authors to approve their own PRs; maintainers must account for that when using their own account to open changes.

Passing changes merged into `main` deploy automatically to the existing dev Worker once the dev environment credential is configured and `DEV_DEPLOY_ENABLED` is enabled. Fork PRs run checks without deployment credentials. See [deployment setup and rollback](docs/deployment.md).

The current public-domain redirect is outside this workflow. A production cutover requires a separate, explicit change.
