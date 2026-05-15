import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Função para fazer requisição HTTP POST
async function postToApi(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Erro ao chamar API: ${error.message}`);
  }
}

async function importData() {
  console.log('🌐 Importando via API HTTP da aplicação Forte Solar...\n');
  
  try {
    // URLs da API (vercel.app)
    const baseUrl = 'https://projeto-frts-app.vercel.app/api';
    
    // Importar clientes
    console.log('📥 Importando clientes...');
    const clientesPath = path.join(__dirname, 'data/import-files/clientes.json');
    const clientesData = JSON.parse(fs.readFileSync(clientesPath, 'utf-8'));
    const clientesArray = Array.isArray(clientesData) ? clientesData : [clientesData];
    
    for (const cliente of clientesArray) {
      try {
        const result = await postToApi(`${baseUrl}/clientes`, cliente);
        console.log(`   ✅ Cliente inserido: ${cliente.nome || 'OK'}`);
      } catch (error) {
        console.log(`   ℹ️  Pode já existir: ${error.message}`);
      }
    }
    console.log(`   ✅ Total: ${clientesArray.length} cliente(s)\n`);

    // Importar projetos
    console.log('📥 Importando projetos_ev...');
    const projetosPath = path.join(__dirname, 'data/import-files/projetos_ev.json');
    const projetosData = JSON.parse(fs.readFileSync(projetosPath, 'utf-8'));
    const projetosArray = Array.isArray(projetosData) ? projetosData : [projetosData];
    
    for (const projeto of projetosArray) {
      try {
        const result = await postToApi(`${baseUrl}/projetos`, projeto);
        console.log(`   ✅ Projeto inserido: ${projeto.nome || 'OK'}`);
      } catch (error) {
        console.log(`   ℹ️  Pode já existir: ${error.message}`);
      }
    }
    console.log(`   ✅ Total: ${projetosArray.length} projeto(s)\n`);

    // Importar equipamentos
    console.log('📥 Importando equipamentos...');
    const equipamentosPath = path.join(__dirname, 'data/import-files/equipamentos.json');
    const equipamentosData = JSON.parse(fs.readFileSync(equipamentosPath, 'utf-8'));
    const equipamentosArray = Array.isArray(equipamentosData) ? equipamentosData : [equipamentosData];
    
    for (const equipamento of equipamentosArray) {
      try {
        const result = await postToApi(`${baseUrl}/equipamentos`, equipamento);
        console.log(`   ✅ Equipamento inserido: ${equipamento.modelo || 'OK'}`);
      } catch (error) {
        console.log(`   ℹ️  Pode já existir: ${error.message}`);
      }
    }
    console.log(`   ✅ Total: ${equipamentosArray.length} equipamento(s)\n`);

    console.log('='.repeat(60));
    console.log('🎉 IMPORTAÇÃO CONCLUÍDA!');
    console.log('='.repeat(60));
    console.log(`\n✨ Acesse: https://projeto-frts-app.vercel.app/login\n`);

  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
}

importData();
