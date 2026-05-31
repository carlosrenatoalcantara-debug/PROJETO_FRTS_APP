import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import { promises as dnsPromises } from 'dns';

// Configurar DNS para usar Google DNS
dnsPromises.setServers(['8.8.8.8', '8.8.4.4']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uri = 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority';

async function importData() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  });

  try {
    console.log('🔧 Configurando Google DNS (8.8.8.8)...');
    console.log('Conectando ao MongoDB Atlas...\n');
    
    await client.connect();
    console.log('✅ Conectado com sucesso ao MongoDB Atlas!\n');

    const db = client.db('forte_solar');

    // Importar clientes
    console.log('📥 Importando clientes...');
    const clientesPath = path.join(__dirname, 'data/import-files/clientes.json');
    const clientesData = JSON.parse(fs.readFileSync(clientesPath, 'utf-8'));
    const clientesArray = Array.isArray(clientesData) ? clientesData : [clientesData];
    
    await db.collection('clientes').deleteMany({});
    const clientesResult = await db.collection('clientes').insertMany(clientesArray);
    console.log(`   ✅ ${clientesResult.insertedIds.length} cliente(s) importado(s)`);

    // Importar projetos_ev
    console.log('\n📥 Importando projetos_ev...');
    const projetosPath = path.join(__dirname, 'data/import-files/projetos_ev.json');
    const projetosData = JSON.parse(fs.readFileSync(projetosPath, 'utf-8'));
    const projetosArray = Array.isArray(projetosData) ? projetosData : [projetosData];
    
    await db.collection('projetos_ev').deleteMany({});
    const projetosResult = await db.collection('projetos_ev').insertMany(projetosArray);
    console.log(`   ✅ ${projetosResult.insertedIds.length} projeto(s) importado(s)`);

    // Importar equipamentos
    console.log('\n📥 Importando equipamentos...');
    const equipamentosPath = path.join(__dirname, 'data/import-files/equipamentos.json');
    const equipamentosData = JSON.parse(fs.readFileSync(equipamentosPath, 'utf-8'));
    const equipamentosArray = Array.isArray(equipamentosData) ? equipamentosData : [equipamentosData];
    
    await db.collection('equipamentos').deleteMany({});
    const equipamentosResult = await db.collection('equipamentos').insertMany(equipamentosArray);
    console.log(`   ✅ ${equipamentosResult.insertedIds.length} equipamento(s) importado(s)`);

    const totalDocs = clientesResult.insertedIds.length + projetosResult.insertedIds.length + equipamentosResult.insertedIds.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 IMPORTAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));
    console.log(`\n📊 Resumo:`);
    console.log(`   • Clientes: ${clientesResult.insertedIds.length}`);
    console.log(`   • Projetos EV: ${projetosResult.insertedIds.length}`);
    console.log(`   • Equipamentos: ${equipamentosResult.insertedIds.length}`);
    console.log(`   • TOTAL: ${totalDocs} documentos\n`);
    console.log(`✨ Sistema Forte Solar espelhado para MongoDB Atlas com sucesso!`);
    console.log(`🌐 Acesse em: https://projeto-frts-app.vercel.app\n`);

  } catch (error) {
    console.error('\n❌ Erro durante importação:');
    console.error('   Mensagem:', error.message);
    if (error.code) console.error('   Código:', error.code);
    console.error('\nTroubleshooting:');
    console.error('   1. Verifique conexão com internet');
    console.error('   2. Verifique firewall local');
    console.error('   3. Tente novamente em alguns segundos');
  } finally {
    await client.close();
    process.exit(0);
  }
}

importData().catch(console.error);
