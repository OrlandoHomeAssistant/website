# Dev deployment

The GitHub `Website checks` workflow validates pull requests and `main` on Node 24 and 26. Its stable `check` job is required by branch protection. After checks pass, pushes to `main` deploy to `orlando-home-assistant-dev` when deployment is enabled. Manual runs on `main` follow the same checks. PRs never receive deployment credentials or deploy code.

## One-time setup

The repository has a GitHub environment named `dev`, restricted to protected branches. Configure it in [environment settings](https://github.com/OrlandoHomeAssistant/website/settings/environments):

1. Add environment secret `CLOUDFLARE_API_TOKEN`: a dedicated Cloudflare Workers deployment token scoped to the account hosting this Worker. Use Cloudflare's Edit Cloudflare Workers template and restrict resources to that account. Keep its permissions and lifetime limited to what this deployment needs. Do not use the local Wrangler OAuth token as the CI secret.
2. Set environment variable `CLOUDFLARE_ACCOUNT_ID` to that account's ID. This has already been configured for the current dev account.
3. Set repository Actions variable `DEV_DEPLOY_ENABLED` to `true`. Until then, validation runs and the deploy job is skipped.
4. Run `Website checks` manually on `main` or merge a PR. Confirm the deployment and smoke-check steps succeed.

GitHub cannot reveal an existing secret's value. If reusing a token from another repo, an owner must supply its original value again; it cannot be copied out through the API. Prefer a separate token so it can be rotated independently. Never put token values in source, command arguments, issues, or chat.

[Cloudflare's GitHub Actions instructions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) explain token creation and account selection.

## What deployment verifies

The job installs the lockfile dependencies, deploys the exact checked commit with a public `BUILD_SHA` identifier, then runs `npm run smoke` against the dev URL. `/health` returns that commit ID. Smoke checks compare deployed static asset hashes with the source and verify the page, sharing metadata, crawler endpoints, and graceful handling of Luma availability. No messages or registrations are sent.

The deployment token is exposed only to credential validation and the deployment step. Checkout does not retain Git credentials, workflow permissions are read-only, and deployments are serialized. These controls do not replace review: a maintainer who changes workflows or `main` can affect what is deployed.

## Manual deployment and rollback

For a local deployment:

```sh
npx wrangler login
npm run check
npm run deploy:dev -- --var "BUILD_SHA:$(git rev-parse HEAD)"
npm run smoke -- https://orlando-home-assistant-dev.imagineer21.workers.dev
```

`npm run deploy:dev` pins the dev Worker name. No zone routes or custom domains are configured.

To undo a bad change, revert its commit through a PR; passing checks deploy the revert. For an urgent restore, a maintainer can use Cloudflare's Worker deployment rollback, then revert the source to prevent a later push from reintroducing the issue. Disable `DEV_DEPLOY_ENABLED` while investigating if automatic deployments must stop.

## Production

The existing domain redirect stays unchanged. There is no automatic production deployment, DNS change, or production token in this workflow. Add a separate production configuration and review its hostname, crawler policy, and credentials when the organizers explicitly authorize the cutover.
