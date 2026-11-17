# Dev and PR deployments

`Website checks` tests pull requests and `main` on Node 24 and 26. The stable `check` job remains the required branch-protection check.

- **Merge to main:** after checks pass, the exact checked commit deploys automatically to `https://orlando-home-assistant-dev.imagineer21.workers.dev`.
- **PR preview:** a passing, non-draft PR from this repository creates or updates a native Cloudflare Preview named `pr-<number>`. Approve its `preview` environment deployment to release the preview credential. The URL appears in the GitHub deployment, job summary, and one updated PR comment. The preview runs the tested PR merge revision, so it includes the current base branch.
- **Forks and Dependabot:** run validation without receiving Cloudflare credentials or deploying. A maintainer can bring a reviewed contribution onto an internal branch to preview it.
- **PR closed or merged:** a trusted close handler checks out `main` and removes that PR's disposable Preview, including its deployments. An absent Preview is a successful no-op. It never executes closed PR code.

The dev hostname and official domain redirect stay unchanged. No production deployment or DNS change is configured.

## One-time credentials

Configure `CLOUDFLARE_API_TOKEN` as an **environment secret** in both GitHub environments:

- [dev settings](https://github.com/OrlandoHomeAssistant/website/settings/environments): restricted to protected branches. Used for main deployments and trusted close-event cleanup.
- [preview settings](https://github.com/OrlandoHomeAssistant/website/settings/environments): requires the owner's deployment approval because it executes unmerged PR code. Self-review is allowed for this environment so the owner can approve previews for their own PRs. This is separate from the PR's merge approval.

Use a dedicated Cloudflare deployment token with Workers Scripts edit permission scoped to the hosting account. Never put its value in source, issues, command arguments, or chat. `CLOUDFLARE_ACCOUNT_ID` is a non-secret environment variable and is configured in both environments.

GitHub cannot reveal a saved secret's value. To reuse an existing token, supply the original value again in each environment. The local Wrangler OAuth login is not a CI credential. See [Cloudflare's GitHub Actions instructions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

Set repository variables `DEV_DEPLOY_ENABLED` and `PREVIEW_DEPLOY_ENABLED` to `true` after the secrets are saved. An explicit `false` pauses the corresponding deployments; when absent, deployment is enabled. They remain paused while credentials are missing. Re-run a PR workflow to create its Preview; merge the reviewed workflow PR and run `Website checks` on `main` to verify automatic dev deployment.

## Storage, URLs, and verification

Native [Worker Previews](https://developers.cloudflare.com/workers/previews/) use the same Worker project with isolated Durable Object namespaces and storage. Preview switch clicks cannot change dev totals. Keep classes and migration history at the top level; `previews.durable_objects.bindings` declares the binding used by preview code. The assets are uploaded from the checked branch. Preview variables are explicitly configured and `--ignore-base-config` avoids inheriting dashboard-only settings.

A `pr-<number>` URL is stable across that PR's updates. Closing the PR deletes its disposable preview state. Dev counters persist across deployments. Cloudflare adds `X-Robots-Tag: noindex` to the Preview's `workers.dev` responses; the preview smoke test requires it. Dev smoke tests require indexing to remain allowed.

Both paths verify `/health` matches the exact checked SHA, compare static asset hashes against that source, and check sharing metadata, public crawler endpoints, Luma availability handling, and read-only counter access. Automated checks never manufacture switch clicks.

Deployments are serialized per target and outdated queued revisions are skipped. Checkout does not persist Git credentials. Tokens are supplied only to credential validation and Cloudflare deployment/cleanup steps. Preview publication uses GitHub's short-lived token and updates only the comment carrying the preview marker. The `pull_request_target` close handler uses protected `main` code and never checks out a PR ref.

## Local commands and rollback

```sh
npx wrangler login
npm run check
npm run deploy:dev -- --var "BUILD_SHA:$(git rev-parse HEAD)"
EXPECTED_BUILD_SHA="$(git rev-parse HEAD)" npm run smoke -- https://orlando-home-assistant-dev.imagineer21.workers.dev
```

To preview reviewed local work independently:

```sh
npx wrangler preview --name pr-<number> --ignore-base-config --var "BUILD_SHA:$(git rev-parse HEAD)" --json
EXPECTED_BUILD_SHA="$(git rev-parse HEAD)" EXPECT_NOINDEX=true npm run smoke -- <returned-preview-url>
```

To undo a bad main change, revert it through a PR. For an urgent restore, use Cloudflare's deployment rollback and then revert the source. Set `DEV_DEPLOY_ENABLED=false` while investigating. Set `PREVIEW_DEPLOY_ENABLED=false` to pause PR deployment and cleanup; existing Preview URLs remain until removed.
