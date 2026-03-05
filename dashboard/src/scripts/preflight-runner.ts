import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { runAllChecks, requiredFixes, type CheckResult } from '../lib/preflight'

const DASHBOARD_ROOT = path.resolve(__dirname, '..', '..')

const ICONS: Record<CheckResult['status'], string> = {
  ok: '✓',
  warn: '⚠',
  error: '✗',
}

function log(result: CheckResult) {
  const icon = ICONS[result.status]
  const label = result.status === 'ok' ? '' : ` [${result.status}]`
  console.log(`  ${icon} ${result.name}${label}: ${result.message}`)
}

function applyFix(fix: 'npm-install' | 'delete-next') {
  if (fix === 'delete-next') {
    const nextDir = path.resolve(DASHBOARD_ROOT, '.next')
    console.log(`\n→ Removing stale .next/ directory...`)
    fs.rmSync(nextDir, { recursive: true, force: true })
    console.log('  Done.')
  } else if (fix === 'npm-install') {
    console.log(`\n→ Running npm install...`)
    execSync('npm install', { cwd: DASHBOARD_ROOT, stdio: 'inherit' })
    console.log('  Done.')
  }
}

function main() {
  console.log('Preflight checks:')

  const results = runAllChecks()
  for (const r of results) log(r)

  const fixes = requiredFixes(results)

  if (fixes.length === 0) {
    console.log('\nAll checks passed — ready to go.\n')
    process.exit(0)
  }

  console.log(`\n${fixes.length} fix(es) needed:`)

  for (const fix of fixes) {
    applyFix(fix)
  }

  // Re-run checks after fixes
  console.log('\nRe-checking after fixes:')
  const recheck = runAllChecks()
  for (const r of recheck) log(r)

  const remaining = requiredFixes(recheck)
  if (remaining.length > 0) {
    console.error('\nSome issues persist after auto-fix. Manual intervention may be needed.')
    process.exit(1)
  }

  console.log('\nAll checks passed after auto-fix.\n')
}

main()
