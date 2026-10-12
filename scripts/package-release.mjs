import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { crc32, deflateRawSync } from 'node:zlib'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
  throw new Error('The release version must have the form major.minor.patch.')
}
if (Number(process.versions.node.split('.')[0]) < 24) {
  throw new Error('Release packaging requires Node.js 24 or newer.')
}

// Only these public project files and directories may enter a release archive.
// Never expand this to the workspace root, Git index or generated output folder.
const rootFiles = [
  '.editorconfig',
  '.env.example',
  '.gitattributes',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'AGENTS.md',
  'DESIGN.md',
  'EDUCATION-RESEARCH.md',
  'GLOBUSSOFT-TRIAL.md',
  'PRODUCT.md',
  'README.md',
  'REFERENCE-ASSETS.md',
  'eslint.config.js',
  'index.html',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'scripts/package-release.mjs',
  'scripts/pnpm.ps1',
]
const directories = ['src', 'server', 'shared', 'tests', 'public', 'content', 'docs', 'dist']
const excludedSegment = /^(?:\.local|\.git|node_modules|coverage|output|\.impeccable)$/i
const excludedFile =
  /(?:^\.env(?:\.|$)|\.(?:env|sqlite(?:-wal|-shm)?|db|key|pem|pfx|log|tsbuildinfo)$)/i
const entries = []

async function addFile(relative) {
  const segments = relative.split('/')
  if (
    relative !== '.env.example' &&
    (segments.some((segment) => excludedSegment.test(segment)) ||
      excludedFile.test(segments.at(-1)))
  ) {
    throw new Error(`Refusing a private or generated file in the release: ${relative}`)
  }
  const absolute = path.resolve(root, relative)
  if (!absolute.startsWith(root + path.sep) && path.dirname(absolute) !== root) {
    throw new Error('Release input escaped the project directory.')
  }
  const stat = await lstat(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Release input must be a regular file: ${relative}`)
  }
  entries.push({ name: relative, data: await readFile(absolute) })
}

async function addDirectory(relative) {
  const absolute = path.resolve(root, relative)
  const stat = await lstat(absolute)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Release input must be a real directory: ${relative}`)
  }
  for (const item of await readdir(absolute, { withFileTypes: true })) {
    const name = `${relative}/${item.name}`
    if (item.isSymbolicLink()) throw new Error(`Release input cannot be a symlink: ${name}`)
    if (item.isDirectory()) await addDirectory(name)
    else await addFile(name)
  }
}

await readFile(path.join(root, 'dist/index.html'))
for (const file of rootFiles) await addFile(file)
for (const directory of directories) await addDirectory(directory)
entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
const digest = (data) => createHash('sha256').update(data).digest('hex')
const manifest = {
  name: metadata.name,
  version: metadata.version,
  kind: 'source-and-web-build',
  runtime: metadata.engines.node,
  packageManager: metadata.packageManager,
  notes: 'Local application release. Provider credentials and academic data are not included.',
  files: entries.map(({ name, data }) => ({
    path: name,
    bytes: data.length,
    sha256: digest(data),
  })),
}
entries.push({
  name: 'RELEASE-MANIFEST.json',
  data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
})

// Small, deterministic ZIP writer: UTF-8 paths, DEFLATE, fixed DOS date 1980-01-01.
// ZIP64 is deliberately unsupported; refuse oversized releases instead of truncating.
const chunks = []
const central = []
let offset = 0
for (const entry of entries) {
  const name = Buffer.from(`project-l-${metadata.version}/${entry.name}`, 'utf8')
  const compressed = deflateRawSync(entry.data, { level: 9 })
  const checksum = crc32(entry.data)
  if (entry.data.length > 0xffffffff || compressed.length > 0xffffffff || name.length > 0xffff) {
    throw new Error('Release entry exceeds the supported ZIP size.')
  }
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0x0800, 6)
  header.writeUInt16LE(8, 8)
  header.writeUInt16LE(33, 12)
  header.writeUInt32LE(checksum, 14)
  header.writeUInt32LE(compressed.length, 18)
  header.writeUInt32LE(entry.data.length, 22)
  header.writeUInt16LE(name.length, 26)
  chunks.push(header, name, compressed)

  const directory = Buffer.alloc(46)
  directory.writeUInt32LE(0x02014b50, 0)
  directory.writeUInt16LE(20, 4)
  directory.writeUInt16LE(20, 6)
  directory.writeUInt16LE(0x0800, 8)
  directory.writeUInt16LE(8, 10)
  directory.writeUInt16LE(33, 14)
  directory.writeUInt32LE(checksum, 16)
  directory.writeUInt32LE(compressed.length, 20)
  directory.writeUInt32LE(entry.data.length, 24)
  directory.writeUInt16LE(name.length, 28)
  directory.writeUInt32LE(offset, 42)
  central.push(directory, name)
  offset += header.length + name.length + compressed.length
  if (offset > 0xffffffff) throw new Error('Release archive exceeds the supported ZIP size.')
}
const directorySize = central.reduce((sum, item) => sum + item.length, 0)
if (entries.length > 0xffff || directorySize > 0xffffffff) {
  throw new Error('Release archive exceeds the supported ZIP entry count or directory size.')
}
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(entries.length, 8)
end.writeUInt16LE(entries.length, 10)
end.writeUInt32LE(directorySize, 12)
end.writeUInt32LE(offset, 16)
const archive = Buffer.concat([...chunks, ...central, end])
const archiveName = `project-l-${metadata.version}.zip`
const destination = path.join(root, 'output/releases')
await mkdir(destination, { recursive: true })
await writeFile(path.join(destination, archiveName), archive)
await writeFile(
  path.join(destination, `${archiveName}.sha256`),
  `${digest(archive)}  ${archiveName}\n`,
)
process.stdout.write(
  `Created output/releases/${archiveName} (${entries.length} files; ${archive.length} bytes).\n`,
)
process.stdout.write(
  'Includes source, locked dependencies, teaching assets and the existing dist build.\n',
)
process.stdout.write(
  'Excludes private configuration, academic data and QA artifacts. Run required checks before packaging.\n',
)
