#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔑 CONFIGURADOR DE ANTHROPIC API KEY');
console.log('=====================================\n');

// Abre o console Anthropic no navegador padrão
const url = 'https://console.anthropic.com/api_keys';
console.log('📱 Abrindo console Anthropic...');
console.log(`   URL: ${url}\n`);

const isWindows = process.platform === 'win32';
if (isWindows) {
  spawn('cmd', ['/c', 'start', url]);
} else {
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url]);
}

console.log('✅ Console aberto no seu navegador padrão!');
console.log('\n📝 PASSOS NO NAVEGADOR:');
console.log('   1. Faça login com sua conta Claude');
console.log('   2. Clique em "Create Key"');
console.log('   3. Dê um nome (ex: "Forte Solar App")');
console.log('   4. Copie a chave (sk-ant-...)');
console.log('\n');

rl.question('🔐 Cole aqui sua chave ANTHROPIC_API_KEY (sk-ant-...): ', (apiKey) => {
  if (!apiKey.startsWith('sk-ant-')) {
    console.log('\n❌ Erro: Chave inválida! Deve começar com "sk-ant-"');
    rl.close();
    process.exit(1);
  }

  const envFile = path.join(__dirname, '.env');

  try {
    let content = fs.readFileSync(envFile, 'utf-8');

    if (content.includes('ANTHROPIC_API_KEY=')) {
      content = content.replace(/ANTHROPIC_API_KEY=.*/, `ANTHROPIC_API_KEY=${apiKey}`);
    } else {
      content += `\n\n# ANTHROPIC - Claude Vision API\nANTHROPIC_API_KEY=${apiKey}`;
    }

    fs.writeFileSync(envFile, content, 'utf-8');

    console.log('\n✅ Chave configurada em backend/.env');
    console.log(`   ANTHROPIC_API_KEY=${apiKey.substring(0, 20)}...`);

    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. Reinicie o servidor: npm run dev');
    console.log('   2. Configure em Railway: railway variables set ANTHROPIC_API_KEY="' + apiKey + '"');
    console.log('   3. Teste upload: Equipamentos → Carregadores EV');

  } catch (error) {
    console.log('\n❌ Erro ao configurar: ' + error.message);
    process.exit(1);
  }

  rl.close();
});
