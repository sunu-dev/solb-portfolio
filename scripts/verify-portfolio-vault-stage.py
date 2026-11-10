"""Verify selected vault changes over the last verified production source.
Never links/deploys this directory or copies environment/credential files.
"""
import hashlib
import json
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = pathlib.Path('/private/tmp/joobi-security-prep-20261029')
STAGE = pathlib.Path('/private/tmp/joobi-vault-rollout-20261029')
OUT = ROOT / 'artifacts/portfolio-vault-rollout-20261029'
FILES = [
    'src/components/portfolio/PortfolioMigrationReviewPanel.tsx',
    'src/lib/portfolioVaultMigrationSources.ts', 'src/__tests__/portfolioVaultMigrationSources.test.ts',
    'src/lib/portfolioVaultMigrationReview.ts', 'src/__tests__/portfolioVaultMigrationReview.test.ts',
    'src/__tests__/portfolioVaultPasskeyErrors.test.ts',
    'src/__tests__/privateNotificationPauseRoutes.test.ts',
    'src/lib/privateNotificationPause.ts', 'src/lib/digestDelivery.ts',
    'src/app/api/cron/morning-brief/route.ts', 'src/app/api/cron/monthly-d3-reminder/route.ts',
    'src/app/api/cron/check-alerts/route.ts', 'src/__tests__/privateNotificationPause.test.ts',
    'src/__tests__/digestDelivery.test.ts', 'src/__tests__/digestProducer.test.ts',
    'src/lib/portfolioVaultMigration.ts', 'src/__tests__/portfolioVaultMigration.test.ts',
    'src/__tests__/portfolioVaultReadOnly.test.ts',
    'src/app/page.tsx', 'src/components/portfolio/PortfolioVaultBoundary.tsx',
    'src/components/portfolio/PortfolioVaultBoundary.module.css',
    'src/lib/portfolioVaultEntry.ts', 'src/__tests__/portfolioVaultEntry.test.ts',
    'src/lib/portfolioVaultAccess.ts', 'src/__tests__/portfolioVaultAccess.test.ts',
    'src/lib/portfolioVaultCrypto.ts', 'src/lib/portfolioVaultPasskey.ts',
    'src/lib/portfolioVaultSync.ts', 'src/lib/portfolioVaultLocal.ts',
    'src/lib/portfolioVaultController.ts',
    'src/__tests__/portfolioVaultSync.test.ts',
    'src/lib/portfolioVaultPolicy.ts', 'src/__tests__/portfolioVaultPolicy.test.ts',
    'src/lib/portfolioSync.ts', 'src/lib/portfolioSyncOutbox.ts', 'src/lib/portfolioIdentity.ts',
    'src/store/portfolioStore.ts', 'src/config/privacyHelp.ts',
    'src/app/help/page.tsx', 'src/components/common/PortfolioPrivacyNotice.tsx',
    'src/__tests__/portfolioWriteAccess.test.ts',
    'src/lib/portfolioVaultPayload.ts', 'src/__tests__/portfolioVaultPayload.test.ts',
    'src/__tests__/portfolioVaultPrivateState.test.ts',
    'src/lib/portfolioVaultRuntime.ts', 'src/lib/portfolioVaultHandoff.ts', 'src/lib/portfolioVaultStore.ts',
    'src/hooks/useAuth.ts', 'src/lib/portfolioWriteAccess.ts',
    'src/__tests__/portfolioVaultHandoff.test.ts', 'src/__tests__/authStartupFailure.test.ts',
    'src/__tests__/portfolioVaultStore.test.ts',
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assert BASE.is_dir(), 'verified production source unavailable; restore it first'
    hashes = json.loads((ROOT / 'artifacts/portfolio-vault-20261029/sha256.json').read_text())
    # The manifest's structure is inspected before using the previous release as source.
    assert isinstance(hashes, dict)
    for name, expected in hashes.items():
        assert digest(BASE / name) == expected, f'baseline changed: {name}'
    if not STAGE.exists():
        shutil.copytree(BASE, STAGE, ignore=shutil.ignore_patterns(
            'node_modules', '.next', '.vercel', '.git', '.env*', 'artifacts', '*.log', '*.tsbuildinfo',
        ))
        (STAGE / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    assert not (STAGE / '.vercel').exists(), 'verification directory must never be linked'
    assert not list(STAGE.glob('.env*')), 'verification directory must not contain environments'
    for name in FILES:
        target = STAGE / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    commands = [
        ['node', 'node_modules/next/dist/bin/next', 'typegen'],
        ['npm', 'run', 'verify'],
        ['node', 'node_modules/eslint/bin/eslint.js', *[name for name in FILES if not name.endswith('.css')]],
    ]
    for index, command in enumerate(commands):
        with (OUT / f'stage-{index}.log').open('w') as log:
            result = subprocess.run(command, cwd=STAGE, stdout=log, stderr=subprocess.STDOUT, timeout=180)
        assert result.returncode == 0, f'failed check; inspect stage-{index}.log'
    (OUT / 'stage-result.json').write_text(json.dumps({
        'baseline': 'dpl_DGLY9ZFRJazhUuwd9nQYfmfVCTsT', 'isolatedDirectory': str(STAGE),
        'selectedFiles': {name: digest(ROOT / name) for name in FILES},
        'environmentCopied': False, 'deploymentLinked': False, 'productionChanged': False,
        'checks': ['Next typegen', 'full verify suite', 'ESLint for selected files'],
    }, indent=2) + '\n')
    print('Selected source verification passed; no deployment was performed.')


if __name__ == '__main__':
    main()
