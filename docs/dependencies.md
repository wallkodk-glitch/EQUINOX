# Dependency and release-tool audit — 2026-10-02

Package versions were checked using official project documentation and npm registry metadata before installation. Exact direct versions are in `package.json`; transitive versions and integrity digests are in `package-lock.json`. A separate clean `npm ci` installation and full build were compared byte-for-byte with the development workspace build.

- React/react-dom 19.3.0 — https://react.dev/versions
- Vite 8.3.2 — https://vite.dev/guide/
- TypeScript 6.0.3 — https://www.typescriptlang.org/download/ ; the newer TypeScript 7 release was not selected because the pinned typescript-eslint 8.71 peer-support range is `<6.1`. Installation was resolved by choosing compatible stable TypeScript, not using force/legacy-peer-deps.
- Vitest 5.0.3 — https://vitest.dev/guide/
- Official npm metadata: https://registry.npmjs.org/ . Recheck the locked tree with `npm ci`, not unconstrained install or an automatic major-version upgrade.
- Python reference: NumPy 2.3.5 and SciPy 1.17.0; Python 3.12.14 in the validation environment.
- Formatting only: Prettier 3.9.9, invoked separately, not a runtime dependency.
- Browser testing only: Playwright 1.63.0. A downloaded npm-packaged Chromium 153.0.8010.0 was used in this restricted environment because the normal Playwright CDN returned an HTML failure page. No security-disabled web-origin flags were used. WebKit was not available and is not claimed tested.

GitHub Actions were checked against the actions organization's official release pages. The workflow uses released versions: checkout7.0.1, setup-node7.0.0, setup-python7.0.0, upload-artifact7.0.1, upload-pages-artifact5.0.0, deploy-pages5.0.1. Resolved commit SHAs are pinned where retrieved; upload-pages-artifact is pinned to its full release tag. This is source/configuration verification, not evidence of a successful hosted workflow run.

- https://github.com/actions/checkout/releases
- https://github.com/actions/setup-node/releases
- https://github.com/actions/setup-python/releases
- https://github.com/actions/upload-artifact/releases
- https://github.com/actions/upload-pages-artifact/releases
- https://github.com/actions/deploy-pages/releases
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

`npm audit --omit=dev --audit-level=high` returned zero known runtime vulnerabilities in this environment on the audit date. This is not a comprehensive security certification or a guarantee about future advisories.
