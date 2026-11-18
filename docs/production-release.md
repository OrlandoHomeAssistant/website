# Production releases

Production runs in the domain owner's Cloudflare account as `orlando-home-assistant`, using `wrangler.production.jsonc`. Its current URL is https://orlando-home-assistant.thestealthsmarthome.workers.dev. Dev and PR previews remain in their existing account. The production environment has its own `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable; token values never belong in source or release notes.

## Publish a version

1. Merge a reviewed PR into main and wait for dev checks and smoke verification to pass.
2. Create a stable semantic-version tag on that exact main commit, such as `v1.0.0`, and publish its GitHub Release. Drafts and prereleases do not deploy.
3. The `Release production` workflow verifies that the published tag matches its execution SHA and belongs to main, then reruns tests, type checking, artwork verification, and a production deployment dry-run on Node 24 and 26.
4. Approve the `production` environment deployment. It is restricted to `v*` tags and requires the owner's approval. Self-review is allowed so the owner can authorize their own release.
5. The workflow verifies access to the existing Worker, deploys the exact tested tag, and checks the live commit, asset hashes, meetup feed behavior, crawler endpoints, social metadata, and counter reads. The read-only counter readiness check retries transient 502/503/504 responses up to ten times; a persistent failure still fails deployment.

Release tag creation is restricted to the repository owner, NimbleEngineer21. Separate active rules prohibit updating or deleting `v*` tags, including administrator bypass. Publish a new patch version for code changes; keep an existing release tag pointing at the same commit.

For an interrupted deployment, rerun failed jobs. A full retry can be dispatched from the same published tag:

```sh
gh workflow run production.yml --ref v1.0.0 --field tag=v1.0.0
```

## Free-tier design

Fonts, images, CSS, JavaScript, and other static files use Cloudflare's asset-first path and `_headers` security policy. Only the landing page and dynamic endpoints are forced through the Worker. Integration tests instrument the actual asset router to verify that static requests bypass Worker execution while the page and APIs still invoke it. This preserves the Free request allowance for server-rendered meetup information and explicit switch interactions.

The counter uses SQLite-backed Durable Objects, supported on Workers Free. Production creates its own namespace; its totals are separate from dev/preview and persist across builds. Preserve the production Worker name, `PorchCounter` class, migration history, and instance name. Quotas and CPU limits still apply; the first production smoke checks validate the real target account rather than treating success on a paid dev account as proof of Free-tier behavior.

## Domain cutover

The release workflow does not change DNS, add Custom Domains, or remove the existing Luma redirect. Coordinate those actions with the domain owner after the workers.dev deployment is verified. Once the official hostname is attached, update the release smoke target and canonical-host behavior through a reviewed PR. Preserve existing email DNS records.

## Recovery

A redeployment of a previous published tag uses the same provenance checks and production approval. Verify storage compatibility before rolling back across a Durable Object migration. Prefer a patch release for forward fixes. Do not delete the production Worker or its namespace to roll back application code: that would discard the shared counter's storage.
