import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const salt = process.env.PASSWORD_HASH_SALT || ''
  // derive 32-byte key from salt
  return crypto.createHash('sha256').update(salt).digest()
}

export function encryptPassword(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // store iv + tag + ct as base64
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptPassword(payload: string): string {
  const key = getKey()
  const data = Buffer.from(payload, 'base64')
  const iv = data.slice(0, 12)
  const tag = data.slice(12, 28)
  const ct = data.slice(28)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const res = Buffer.concat([decipher.update(ct), decipher.final()])
  return res.toString('utf8')
}

export default { encryptPassword, decryptPassword }

