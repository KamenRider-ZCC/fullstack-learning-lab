import { mkdirSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const certificateDirectory = resolve(projectRoot, '.certs');
const argumentsAfterSeparator = process.argv.slice(2).filter((value) => value !== '--');
if (argumentsAfterSeparator.length > 1) {
  throw new Error('最多只能提供一个局域网 IP 地址');
}
const extraAddress = argumentsAfterSeparator[0]?.trim();

if (extraAddress && !isIP(extraAddress)) {
  throw new Error('可选参数必须是有效的 IPv4 或 IPv6 地址');
}

mkdirSync(certificateDirectory, { recursive: true });

const subjectAltNames = ['DNS:localhost', 'IP:127.0.0.1'];
if (extraAddress) subjectAltNames.push(`IP:${extraAddress}`);

const result = spawnSync('docker', [
  'run',
  '--rm',
  '--volume',
  `${certificateDirectory}:/certs`,
  'alpine/openssl:3.5.4',
  'req',
  '-x509',
  '-nodes',
  '-newkey',
  'rsa:2048',
  '-sha256',
  '-days',
  '365',
  '-keyout',
  '/certs/dev.key',
  '-out',
  '/certs/dev.crt',
  '-subj',
  '/CN=localhost',
  '-addext',
  `subjectAltName=${subjectAltNames.join(',')}`,
], { stdio: 'inherit' });

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`证书生成失败，Docker 退出码：${result.status}`);
}

console.log(`本地证书已生成：${certificateDirectory}`);
console.log('该证书为自签名证书，只用于本地学习，请勿用于正式环境。');
