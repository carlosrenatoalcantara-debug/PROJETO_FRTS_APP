import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function postToApi(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function importProjectsVariants() {
  const baseUrl = 'https://projeto-frts-app.vercel.app/api';
  const projetosPath = path.join(__dirname, 'data/import-files/projetos_ev.json');
  const projetosData = JSON.parse(fs.readFileSync(projetosPath, 'utf-8'));
  const projetosArray = Array.isArray(projetosData) ? projetosData : [projetosData];
  
  console.log('🔍 Tentando diferentes endpoints para projetos...\n');
  
  const endpoints = [
    `${baseUrl}/projetos`,
    `${baseUrl}/projetos_ev`,
    `${baseUrl}/projects`,
    `${baseUrl}/ev-projects`,
  ];
  
  for (const projeto of projetosArray) {
    let inserted = false;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`   Tentando: ${endpoint}`);
        const result = await postToApi(endpoint, projeto);
        console.log(`   ✅ Sucesso em: ${endpoint}\n`);
        inserted = true;
        break;
      } catch (error) {
        // Continua para próximo endpoint
      }
    }
    
    if (!inserted) {
      console.log(`   ⚠️  Nenhum endpoint funcionou para o projeto\n`);
      console.log(`   Dados do projeto: ${JSON.stringify(projeto)}\n`);
    }
  }
}

importProjectsVariants();
