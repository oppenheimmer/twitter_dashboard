import fs from 'fs'
import path from 'path'

export interface CheckResult {
  name: string
  status: 'ok' | 'warn' | 'error'
  message: string
  fix?: 'npm-install' | 'delete-next'
}

const DASHBOARD_ROOT = path.resolve(__dirname, '..', '..')

function resolveFromDashboard(...segments: string[]): string {
  return path.resolve(DASHBOARD_ROOT, ...segments)
}

/**
 * Check whether node_modules exists at all.
 */
export function checkNodeModulesExist(): CheckResult {
  const nmPath = resolveFromDashboard('node_modules')
  if (!fs.existsSync(nmPath)) {
    return {
      name: 'node_modules-exists',
      status: 'error',
      message: 'node_modules/ is missing — dependencies not installed',
      fix: 'npm-install',
    }
  }
  return { name: 'node_modules-exists', status: 'ok', message: 'node_modules/ exists' }
}

/**
 * Check whether node_modules is stale by comparing mtimes.
 * Stale = package.json or package-lock.json is newer than node_modules/.package-lock.json.
 */
export function checkNodeModulesStale(): CheckResult {
  const lockInsideNm = resolveFromDashboard('node_modules', '.package-lock.json')
  if (!fs.existsSync(lockInsideNm)) {
    return {
      name: 'node_modules-stale',
      status: 'error',
      message: 'node_modules/.package-lock.json missing — likely incomplete install',
      fix: 'npm-install',
    }
  }

  const nmMtime = fs.statSync(lockInsideNm).mtimeMs

  const pkgJsonPath = resolveFromDashboard('package.json')
  const pkgLockPath = resolveFromDashboard('package-lock.json')

  const sources = [pkgJsonPath, pkgLockPath].filter((p) => fs.existsSync(p))
  const latestSource = Math.max(...sources.map((p) => fs.statSync(p).mtimeMs))

  if (latestSource > nmMtime) {
    return {
      name: 'node_modules-stale',
      status: 'warn',
      message: 'node_modules/ is older than package.json or package-lock.json',
      fix: 'npm-install',
    }
  }

  return { name: 'node_modules-stale', status: 'ok', message: 'node_modules/ is up to date' }
}

/**
 * Spot-check that critical packages can be resolved from node_modules.
 */
export function checkKeyPackages(): CheckResult {
  const required = ['next', 'react', 'react-dom']
  const missing: string[] = []

  for (const pkg of required) {
    const pkgJsonPath = resolveFromDashboard('node_modules', pkg, 'package.json')
    if (!fs.existsSync(pkgJsonPath)) {
      missing.push(pkg)
    }
  }

  if (missing.length > 0) {
    return {
      name: 'key-packages',
      status: 'error',
      message: `Missing critical packages: ${missing.join(', ')}`,
      fix: 'npm-install',
    }
  }

  return { name: 'key-packages', status: 'ok', message: 'All critical packages present' }
}

/**
 * Check if .next was built with a different Next.js version than what's currently installed.
 */
export function checkNextVersionMatch(): CheckResult {
  const nextBuildPkgPath = resolveFromDashboard('.next', 'package.json')
  const nextInstalledPkgPath = resolveFromDashboard('node_modules', 'next', 'package.json')

  if (!fs.existsSync(nextBuildPkgPath)) {
    // No .next build yet — nothing to check
    return { name: 'next-version', status: 'ok', message: 'No .next build present (nothing to validate)' }
  }
  if (!fs.existsSync(nextInstalledPkgPath)) {
    // next not installed — will be caught by checkKeyPackages
    return { name: 'next-version', status: 'ok', message: 'next package not installed (skipped)' }
  }

  try {
    const buildVersion = JSON.parse(fs.readFileSync(nextBuildPkgPath, 'utf-8')).version
    const installedVersion = JSON.parse(fs.readFileSync(nextInstalledPkgPath, 'utf-8')).version

    if (buildVersion !== installedVersion) {
      return {
        name: 'next-version',
        status: 'warn',
        message: `.next was built with next@${buildVersion} but next@${installedVersion} is installed`,
        fix: 'delete-next',
      }
    }
  } catch {
    return {
      name: 'next-version',
      status: 'warn',
      message: 'Could not read .next/package.json or node_modules/next/package.json',
      fix: 'delete-next',
    }
  }

  return { name: 'next-version', status: 'ok', message: '.next version matches installed next' }
}

/**
 * Check if .next/build-manifest.json is present and parseable (when .next has build output).
 */
export function checkNextBuildIntegrity(): CheckResult {
  const nextDir = resolveFromDashboard('.next')
  if (!fs.existsSync(nextDir)) {
    return { name: 'next-integrity', status: 'ok', message: 'No .next directory (nothing to validate)' }
  }

  const manifestPath = resolveFromDashboard('.next', 'build-manifest.json')
  // Only enforce if there's actual build output (not just dev/ cache)
  const entries = fs.readdirSync(nextDir)
  const hasBuildOutput = entries.some((e) => ['server', 'static', 'build-manifest.json'].includes(e))

  if (!hasBuildOutput) {
    return { name: 'next-integrity', status: 'ok', message: '.next contains only dev cache (OK)' }
  }

  if (!fs.existsSync(manifestPath)) {
    return {
      name: 'next-integrity',
      status: 'warn',
      message: '.next has build output but build-manifest.json is missing — possibly corrupt',
      fix: 'delete-next',
    }
  }

  try {
    JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  } catch {
    return {
      name: 'next-integrity',
      status: 'warn',
      message: '.next/build-manifest.json is not valid JSON — corrupt build cache',
      fix: 'delete-next',
    }
  }

  return { name: 'next-integrity', status: 'ok', message: '.next build-manifest.json is valid' }
}

/**
 * Run all preflight checks and return the results.
 */
export function runAllChecks(): CheckResult[] {
  const results: CheckResult[] = []

  const existsResult = checkNodeModulesExist()
  results.push(existsResult)

  // Only run deeper node_modules checks if it exists
  if (existsResult.status === 'ok') {
    results.push(checkNodeModulesStale())
    results.push(checkKeyPackages())
  }

  results.push(checkNextVersionMatch())
  results.push(checkNextBuildIntegrity())

  return results
}

/**
 * Determine which unique fixes are needed from a set of check results.
 */
export function requiredFixes(results: CheckResult[]): Array<'npm-install' | 'delete-next'> {
  const fixes = new Set<'npm-install' | 'delete-next'>()
  for (const r of results) {
    if (r.fix) fixes.add(r.fix)
  }
  // npm-install first, then delete-next
  const ordered: Array<'npm-install' | 'delete-next'> = []
  if (fixes.has('delete-next')) ordered.push('delete-next')
  if (fixes.has('npm-install')) ordered.push('npm-install')
  return ordered
}
