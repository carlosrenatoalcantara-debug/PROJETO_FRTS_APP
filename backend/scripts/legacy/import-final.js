import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uri = 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority';

async function importData() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  try {
    console.log('Conectando ao MongoDB Atlas...');
    await client.connect();
    console.log('✓ Conectado com sucesso!');

    const db = client.db('forte_solar');

    // Importar clientes
    console.log('\nImportando clientes...');
    const clientesPath = path.join(__dirname, 'data/import-files/clientes.json');
    const clientesData = JSON.parse(fs.readFileSync(clientesPath, 'utf-8'));
    const clientesArray = Array.isArray(clientesData) ? clientesData : [clientesData];
    
    await db.collection('clientes').deleteMany({});
    const clientesResult = await db.collection('clientes').insertMany(clientesArray);
    console.log(`✓ ${clientesResult.insertedIds.length} cliente(s) importado(s)`);

    // Importar projetos_ev
    console.log('\nImportando projetos_ev...');
    const projetosPath = path.join(__dirname, 'data/import-files/projetos_ev.json');
    const projetosData = JSON.parse(fs.readFileSync(projetosPath, 'utf-8'));
    const projetosArray = Array.isArray(projetosData) ? projetosData : [projetosData];
    
    await db.collection('projetos_ev').deleteMany({});
    const projetosResult = await db.collection('projetos_ev').insertMany(projetosArray);
    console.log(`✓ ${projetosResult.insertedIds.length} projeto(s) importado(s)`);

    // Importar equipamentos
    console.log('\nImportando equipamentos...');
    const equipamentosPath = path.join(__dirname, 'data/import-files/equipamentos.json');
    const equipamentosData = JSON.parse(fs.readFileSync(equipamentosPath, 'utf-8'));
    const equipamentosArray = Array.isArray(equipamentosData) ? equipamentosData : [equipamentosData];
    
    await db.collection('equipamentos').deleteMany({});
    const equipamentosResult = await db.collection('equipamentos').insertMany(equipamentosArray);
    console.log(`✓ ${equipamentosResult.insertedIds.length} equipamento(s) importado(s)`);

    console.log('\n' + '='.repeat(50));
    console.log('IMPORTAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(50));
    console.log(`\nTotal de documentos importados: ${clientesResult.insertedIds.length + projetosResult.insertedIds.length + equipamentosResult.insertedIds.length}`);

  } catch (error) {
    console.error('✗ Erro durante importação:', error.message);
    console.error('\nDetalhes:', error);
  } finally {
    await client.close();
  }
}

importData().catch(console.error);
