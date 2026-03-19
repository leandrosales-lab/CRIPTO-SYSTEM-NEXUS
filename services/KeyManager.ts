/**
 * Gerenciador seguro de credenciais em runtime.
 * Armazena as chaves em data/keys.json (fora do .env).
 * As chaves NUNCA são retornadas completas para o frontend.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const KEYS_DIR   = path.resolve(__dirname, '../data');
const KEYS_FILE = path.join(KEYS_DIR, 'keys.json');
// Chave de ofuscação local (não é criptografia forte — apenas evita texto plano óbvio)
const OBFUSCATION_KEY = Buffer.from('CriptoSystem2025NexusTerminal!!', 'utf8');

interface StoredKeys {
  apiKey:    string;
  apiSecret: string;
  testnet:   boolean;
  liveMode:  boolean;
  savedAt:   string;
}

function obfuscate(text: string): string {
  const buf = Buffer.from(text, 'utf8');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.length];
  return out.toString('base64');
}

function deobfuscate(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.length];
  return out.toString('utf8');
}

export function saveKeys(apiKey: string, apiSecret: string, testnet: boolean, liveMode: boolean): void {
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
  const payload: StoredKeys = {
    apiKey:    obfuscate(apiKey),
    apiSecret: obfuscate(apiSecret),
    testnet,
    liveMode,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(KEYS_FILE, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function loadKeys(): { apiKey: string; apiSecret: string; testnet: boolean; liveMode: boolean } | null {
  try {
    if (!fs.existsSync(KEYS_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')) as StoredKeys;
    return {
      apiKey:    deobfuscate(raw.apiKey),
      apiSecret: deobfuscate(raw.apiSecret),
      testnet:   raw.testnet,
      liveMode:  raw.liveMode,
    };
  } catch {
    return null;
  }
}

export function deleteKeys(): void {
  try { if (fs.existsSync(KEYS_FILE)) fs.unlinkSync(KEYS_FILE); } catch (_) {}
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 6) + '••••••••' + key.slice(-4);
}

export function hasKeys(): boolean {
  const k = loadKeys();
  return !!(k?.apiKey && k.apiKey.length > 10 && k?.apiSecret && k.apiSecret.length > 10);
}
