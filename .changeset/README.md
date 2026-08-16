# Changesets

Every change that users would notice needs one:

```bash
pnpm changeset
```

Pick the packages, pick the bump, describe the change in a sentence someone reading a release note would understand. The file lands in this folder and goes in with your PR.

The three packages are versioned **in lockstep** (`fixed` in `config.json`). An integration is written against a specific core API, so a version number that means the same thing across all three is worth more than a tight one per package.

Merging to `main` opens a release PR that collects the pending changesets into version bumps and CHANGELOG entries. Merging _that_ publishes to npm from CI, with provenance.
