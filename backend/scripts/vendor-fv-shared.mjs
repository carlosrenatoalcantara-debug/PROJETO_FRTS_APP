/**
 * vendor-fv-shared.mjs — reempacota packages/fv-shared para backend/vendor.
 *
 * O backend consome @fortesolar/fv-shared como dependência vendorizada
 * (file:vendor/fortesolar-fv-shared.tgz) porque a raiz de deploy no Railway é
 * `backend/` — caminho relativo que escape dessa raiz resolve em produção como
 * ERR_MODULE_NOT_FOUND (BUG-013).
 *
 * Consequência: o .tgz é um SNAPSHOT. Toda alteração em packages/fv-shared exige
 * rodar este script e commitar o .tgz, senão o backend roda código defasado
 * enquanto o frontend (que lê a pasta direto, via alias do Vite) roda o novo.
 *
 * Uso: npm run vendor:fv-shared   (dentro de backend/)
 */
import { execFileSync } from 'node:child_process'
import { renameSync, readdirSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const raizBackend = path.resolve(aqui, '..')
const pacote = path.resolve(raizBackend, '../packages/fv-shared')
const vendor = path.resolve(raizBackend, 'vendor')
const destino = path.join(vendor, 'fortesolar-fv-shared.tgz')

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
// `shell: true` é obrigatório para .cmd no Windows (Node ≥ 22, EINVAL sem ele).
const exec = (args, cwd) =>
  execFileSync(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

// FV-UX-006: o nome do tarball é estável, então `npm install` reaproveita a
// entrada do package-lock (versão + integrity) e serve a cópia ANTIGA do cache,
// mesmo com o .tgz novo em disco. Só o número de versão quebra esse empate.
const manifesto = path.join(pacote, 'package.json')
const pkg = JSON.parse(readFileSync(manifesto, 'utf8'))
const [maj, min, pat] = pkg.version.split('.')
pkg.version = `${maj}.${min}.${Number(pat) + 1}`
writeFileSync(manifesto, JSON.stringify(pkg, null, 2) + '\n')
console.log(`↑ versão do pacote → ${pkg.version}`)

// Empacota dentro do próprio pacote: `--pack-destination` com caminho contendo
// espaço quebra sob `shell: true`.
exec(['pack'], pacote)

// npm pack nomeia com a versão; o package.json referencia um nome estável.
const gerado = readdirSync(pacote).find((f) => /^fortesolar-fv-shared-.+\.tgz$/.test(f))
if (!gerado) {
  console.error('❌ npm pack não produziu o tarball esperado em', pacote)
  process.exit(1)
}
try { unlinkSync(destino) } catch { /* primeira execução */ }
renameSync(path.join(pacote, gerado), destino)

// Reinstala apontando direto para o tarball: força npm a reresolver a entrada do
// lock em vez de servir do cache.
exec(['install', 'file:vendor/fortesolar-fv-shared.tgz', '--save'], raizBackend)

console.log('\n✅ vendor atualizado:', path.relative(raizBackend, destino))
console.log(`   @fortesolar/fv-shared@${pkg.version} instalado.`)
console.log('   Commite: o .tgz, o package.json do pacote e o package-lock.json.')
