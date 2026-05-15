import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tentar múltiplas estratégias de conexão
const connectionStrings = [
  // 1. Tentar com directConnection (pula SRV)
  'mongodb+srv://forte-solar:Cr1pt0grafia@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority&directConnection=true',
  // 2. Versão padrão
  'mongodb+srv://forte-solar:Cr1pt0grafia@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority',
];

async function tryConnection(connectionString, index) {
  console.log(`\n🔄 Tentativa ${index + 1}/${connectionStrings.length}...`);
  
  const client = new MongoClient(connectionString, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 1,
  });

  try {
    await client.connect();
    await client.admin.command('ping');
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}

async function importData() {
  let client = null;

  try {
    console.log('🔧 Tentando contornar bloqueio de DNS...\n');
    
    // Tentar conexões
    for (let i = 0; i < connectionStrings.length; i++) {
      try {
        client = await tryConnection(connectionStrings[i], i);
        console.log(`✅ Conexão estabelecida!\n`);
        break;
      } catch (error) {
        if (i === connectionStrings.length - 1) {
          throw new Error(`Todas as tentativas falharam: ${error.message}`);
        }
        console.log(`   ❌ Falhou: ${error.code || error.message}`);
      }
    }

    if (!client) throw new Error('Não foi possível conectar');

    const db = client.db('forte_solar');

    // Importar clientes
    console.log('📥 Importando clientes...');
    const clientesPath = path.join(__dirname, 'data/import-files/clientes.json');
    const clientesData = JSON.parse(fs.readFileSync(clientesPath, 'utf-8'));
    const clientesArray = Array.isArray(clientesData) ? clientesData : [clientesData];
    
    await db.collection('clientes').deleteMany({});
    const clientesResult = await db.collection('clientes').insertMany(clientesArray);
    console.log(`   ✅ ${clientesResult.insertedIds.length} cliente(s)`);

    // Importar projetos_ev
    console.log('📥 Importando projetos_ev...');
    const projetosPath = path.join(__dirname, 'data/import-files/projetos_ev.json');
    const projetosData = JSON.parse(fs.readFileSync(projetosPath, 'utf-8'));
    const projetosArray = Array.isArray(projetosData) ? projetosData : [projetosData];
    
    await db.collection('projetos_ev').deleteMany({});
    const projetosResult = await db.collection('projetos_ev').insertMany(projetosArray);
    console.log(`   ✅ ${projetosResult.insertedIds.length} projeto(s)`);

    // Importar equipamentos
    console.log('📥 Importando equipamentos...');
    const equipamentosPath = path.join(__dirname, 'data/import-files/equipamentos.json');
    const equipamentosData = JSON.parse(fs.readFileSync(equipamentosPath, 'utf-8'));
    const equipamentosArray = Array.isArray(equipamentosData) ? equipamentosData : [equipamentosData];
    
    await db.collection('equipamentos').deleteMany({});
    const equipamentosResult = await db.collection('equipamentos').insertMany(equipamentosArray);
    console.log(`   ✅ ${equipamentosResult.insertedIds.length} equipamento(s)`);

    const total = clientesResult.insertedIds.length + projetosResult.insertedIds.length + equipamentosResult.insertedIds.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 IMPORTAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));
    console.log(`\n📊 Total de documentos: ${total}`);
    console.log(`✨ Acesse: https://projeto-frts-app.vercel.app/login\n`);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    if (client) await client.close();
  }
}

importData();
