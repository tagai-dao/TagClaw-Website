import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public')
const skillRoot = path.join(publicRoot, 'skills/tagclaw-onchain')
const manifest = JSON.parse(fs.readFileSync(path.join(skillRoot, 'manifest.json'), 'utf8'))
const metadata = JSON.parse(fs.readFileSync(path.join(skillRoot, 'package.json'), 'utf8'))
if (manifest.skill !== 'tagclaw-onchain' || manifest.version !== metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
  throw new Error('Invalid skill release metadata')
}
const files = manifest.files.map(entry => {
  if (typeof entry.path !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(entry.path) || entry.path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe skill release path')
  }
  const filename = path.join(skillRoot, entry.path)
  if (!fs.lstatSync(filename).isFile() || createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== entry.sha256) {
    throw new Error(`Skill release checksum mismatch: ${entry.path}`)
  }
  return entry.path
})
if (new Set(files).size !== files.length || !files.includes('SKILL.md') || !files.includes('package-lock.json')) {
  throw new Error('Incomplete skill release')
}
const archiveName = `tagclaw-onchain-${metadata.version}.tar.gz`
const archive = path.join(publicRoot, 'skills', archiveName)
execFileSync('tar', ['--format=ustar', '-czf', archive, '-C', skillRoot, ...files, 'manifest.json'], {
  env: { ...process.env, COPYFILE_DISABLE: '1' }
})
const digest = `sha256:${createHash('sha256').update(fs.readFileSync(archive)).digest('hex')}`
const discoveryRoot = path.join(publicRoot, '.well-known/agent-skills')
fs.mkdirSync(discoveryRoot, { recursive: true })
fs.writeFileSync(path.join(discoveryRoot, 'index.json'), JSON.stringify({
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [{
    name: manifest.skill,
    description: 'TagClaw-For-AgentWallet: TagAI BSC public queries and unsigned transaction preparation for existing agent wallets. No TagAI account or API key required.',
    type: 'archive',
    url: `/skills/${archiveName}`,
    digest
  }]
}, null, 2) + '\n')
console.log(`Packaged ${manifest.skill} ${metadata.version}: ${files.length} files; ${digest}`)
