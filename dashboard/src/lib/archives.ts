import fs from 'fs'
import path from 'path'

export function getArchiveNames(): string[] {
  const root = process.env.ARCHIVE_ROOT!
  return fs.readdirSync(root)
    .filter(name => /^twitter-\d{4}-\d{2}/.test(name))
    .filter(name => fs.existsSync(path.join(root, name, 'data', 'like.js')))
    .sort()
}
