# Releasing 4D Ages. The work is done by npm scripts (which also run on Windows); these are the two commands to remember.
#
#   make bump                 next patch version (1.0.0 → 1.0.1) in app.json, src/brand.ts, package.json, package-lock.json
#   make bump PART=minor      or PART=major
#   make bump VERSION=1.4.2   exactly that version
#   make release              test, commit the bump, tag v<version> and push: GitHub then builds, signs and publishes the APK
#
# Shipping work in progress as a branch (open the PR on GitHub afterwards):
#
#   make ship MSG="Fix avatar crop"                 new branch off the latest main, commit everything, push it
#   make ship MSG="Fix avatar crop" BRANCH=avatar   pick the branch name (default: a timestamp like 202610072041)
#   make ship                                       commit message written from the changed files

VERSION_FILES := app.json src/brand.ts package.json package-lock.json
BRANCH ?= $(shell date +%Y%m%d%H%M)

.PHONY: bump release ship

bump:
	@node scripts/bump-version.mjs $(or $(VERSION),$(PART),patch)

release:
	@v=$$(node -p "require('./app.json').expo.version"); \
	if [ "$$(git rev-parse --abbrev-ref HEAD)" != main ]; then echo "✗ Releases are tagged from main."; exit 1; fi; \
	if git rev-parse -q --verify "refs/tags/v$$v" >/dev/null; then echo "✗ v$$v is already tagged. Run 'make bump' first."; exit 1; fi; \
	if [ -n "$$(git status --porcelain -- . $(addprefix ':!',$(VERSION_FILES)))" ]; then echo "✗ Commit or stash your other changes first (only the version files may be uncommitted)."; exit 1; fi; \
	npm test && \
	git add $(VERSION_FILES) && \
	{ git diff --cached --quiet || git commit -m "Release v$$v"; } && \
	git tag "v$$v" && \
	git push origin main "v$$v"

ship:
	@set -e; \
	if [ -z "$$(git status --porcelain)" ]; then echo "✗ Nothing to ship: no changes."; exit 1; fi; \
	if git rev-parse -q --verify "refs/heads/$(BRANCH)" >/dev/null; then echo "✗ Branch $(BRANCH) already exists. Pass BRANCH=<name>."; exit 1; fi; \
	git fetch -q origin main; \
	git stash push -u -q -m "make ship"; \
	git checkout -q -b "$(BRANCH)" origin/main; \
	if ! git stash pop -q; then echo "✗ Your changes conflict with the latest main. Resolve them on $(BRANCH), then commit and push."; exit 1; fi; \
	git add -A; \
	msg='$(subst ','\'',$(MSG))'; \
	if [ -z "$$msg" ]; then \
		n=$$(git diff --cached --name-only | wc -l | tr -d ' '); \
		areas=$$(git diff --cached --name-only | sed 's|/.*||' | sort -u | head -3 | paste -sd, - | sed 's/,/, /g'); \
		if [ "$$n" = 1 ]; then msg="Update $$(git diff --cached --name-only)"; else msg="Update $$areas ($$n files)"; fi; \
	fi; \
	git commit -q -m "$$msg"; \
	git push -u origin "$(BRANCH)"; \
	echo "✓ Pushed \"$$msg\" to $(BRANCH)"
