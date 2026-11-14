# Releases

Structor is distributed as Git source. A release, starting at 0.3.0, is an
annotated stable `vX.Y.Z` tag whose commit is reachable from `origin/main`.
`package.json` is the version authority; the tag, both lockfile root versions,
and one nonempty dated `CHANGELOG.md` entry must agree. Release commits must
pass the full validation matrix. The install prompt selects the highest
qualifying version, never moving `main` HEAD. No npm package is needed.

Legacy 0.2.x tags and registry versions predate this policy. They remain
historical records, including the off-main lightweight `v0.2.5` tag. Do not
retag them or treat them as current releases. Version 0.3.0 consolidates the
previously unrecorded work in the changelog.

## Select And Verify A Release

Clone into a new temporary directory outside the selected workspace. Do not
execute source from the default branch before selecting the tag. In the clone:

```sh
git fetch origin main --tags
release_tag=
for candidate in $(git for-each-ref --sort=-version:refname --format='%(refname:strip=2)' refs/tags); do
  case "$candidate" in
    v*) ;;
    *) continue ;;
  esac
  printf '%s\n' "$candidate" | LC_ALL=C grep -Eq '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' || continue
  test "$(git cat-file -t "refs/tags/$candidate")" = tag || continue
  git merge-base --is-ancestor "refs/tags/$candidate^{commit}" refs/remotes/origin/main || continue
  release_tag=$candidate
  break
done
test -n "$release_tag" || { echo 'No qualifying Structor release found' >&2; exit 1; }
git checkout --detach "refs/tags/$release_tag"
node scripts/check-release.mjs --tag "$release_tag"
git rev-parse HEAD
```

Stop on any failure. Record the tag and the full commit. Read
`INSTALL_WITH_AGENT.md` from that checkout and invoke the CLI explicitly as
`node /absolute/path/to/structor/bin/structor.mjs`. Pass the recorded commit as
`--source-revision` for planning. Keep drafts, plans, approvals, and workspace
output outside the source checkout so it stays clean. Node.js 20 or newer is
required; there are no runtime dependencies to install.

## Maintainer Release Order

1. In a PR, choose a new stable version greater than all existing version tags.
   Update `package.json`, both root versions in `package-lock.json`, and the
   changelog. Every release, including documentation-only releases, needs an
   entry. Run `npm run check:release` and the full PR validation matrix.
2. Merge only after review and all required checks pass. Fetch `origin/main`
   and tags, then use a clean checkout of the exact merged main commit. Run
   `npm ci` and `npm run validate` there; verify that commit's main CI matrix
   also passes. Failed or skipped matrix jobs block release.
3. Create the annotated tag locally, then run the strict check before pushing:

   ```sh
   release_tag="v$(node -p "require('./package.json').version")"
   git tag -a "$release_tag" -m "Structor $release_tag"
   npm run check:release -- --tag "$release_tag"
   git push origin "refs/tags/$release_tag"
   ```

4. Verify the remote tag resolves to the intended commit and its tag-triggered
   full CI matrix passes. Clone it into a fresh temporary directory, repeat
   the selection/check above, and exercise approved agent plan/apply for both
   profiles, regeneration, and doctor. A tag is not release-ready merely
   because its metadata check passes. Record the tag, commit, CI run, and fresh
   installation evidence in the GitHub release notes.

GitHub release notes document the validated tag; they do not replace it as
the distribution identity. `npm run check:release` performs no writes and
requires no credentials. It checks metadata on branches and in archives.
`--tag vX.Y.Z` additionally requires Git, the exact tag at HEAD, a clean tree,
and `origin/main` ancestry. Tag CI automatically enables these strict checks
using `GITHUB_REF_TYPE` and `GITHUB_REF_NAME`; CI fetches full history and tags.
Publishing the tag or release notes requires repository write access; validation
does not. No registry publishing token belongs in CI for this distribution.

## Retry And Recovery

Before retrying, fetch tags and inspect the remote ref. If the intended tag
already exists, verify its annotated object and commit in a fresh clone and
resume validation or release notes for that same identity. Do not recreate,
move, delete, or force-push an existing release tag. If any existing identity
or metadata disagrees, stop and investigate; repair in a new version through
main. An interrupted notes publication can be retried against the verified
existing tag. A bad published release requires a new corrective version and
an explicit notice in the old release notes. Never silently fall back to main
or the deprecated npm channel.
