# Releasing 4D Ages. The work is done by npm scripts (which also run on Windows); these are the two commands to remember.
#
#   make bump                 next patch version (1.0.0 → 1.0.1) in app.json, src/brand.ts, package.json, package-lock.json
#   make bump PART=minor      or PART=major
#   make bump VERSION=1.4.2   exactly that version
#   make release              test, commit the bump, tag v<version> and push: GitHub then builds, signs and publishes the APK

VERSION_FILES := app.json src/brand.ts package.json package-lock.json

.PHONY: bump release

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
