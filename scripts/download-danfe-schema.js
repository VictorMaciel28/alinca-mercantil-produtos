const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const BASE_URL = 'https://dfe-portal.svrs.rs.gov.br/Schemas/PRNFE/XSLT/NFe/'
const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'app', 'api', 'public', 'rastreamento', 'danfe-schema')

const fetched = new Set()
const queue = ['NFe.xsl']

async function downloadSchemas() {
  while (queue.length) {
    const file = queue.shift()
    if (fetched.has(file)) continue
    fetched.add(file)

    const destPath = path.join(SCHEMA_DIR, file)
    ensureDir(path.dirname(destPath))

    if (fs.existsSync(destPath)) {
      parseIncludes(file)
      continue
    }

    const url = new URL(file, BASE_URL).toString()
    const data = await fetchUrl(url)
    fs.writeFileSync(destPath, data, 'utf8')
    console.log(`Saved ${file}`)
    parseIncludes(file, data)
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function parseIncludes(file, content) {
  const filePath = path.join(SCHEMA_DIR, file)
  const raw = content || fs.readFileSync(filePath, 'utf8')
  const hrefRegex = /href=['"]([^'"]+)['"]/g
  let match
  while ((match = hrefRegex.exec(raw))) {
    const href = match[1]
    if (!href.toLowerCase().endsWith('.xsl')) continue
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), href))
    const normalized = resolved.startsWith('/') ? resolved.slice(1) : resolved
    if (!fetched.has(normalized)) queue.push(normalized)
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? http : https
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible)',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchUrl(res.headers.location))
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`))
          return
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve(body))
      }
    )
    req.on('error', reject)
  })
}

downloadSchemas().catch((error) => {
  console.error(error)
  process.exit(1)
})
