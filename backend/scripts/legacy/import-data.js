#!/usr/bin/env node
/**
 * MongoDB Atlas Data Import Script (Node.js)
 * Imports JSON files from local filesystem to MongoDB Atlas cloud database
 */

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function importData() {
  // MongoDB Atlas connection details
  const MONGODB_URI = 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority';
  const DATABASE_NAME = 'forte_solar';

  // Files to import
  const IMPORT_FILES = {
    'clientes': path.join(__dirname, 'backend/data/import-files/clientes.json'),
    'projetos_ev': path.join(__dirname, 'backend/data/import-files/projetos_ev.json'),
    'equipamentos': path.join(__dirname, 'backend/data/import-files/equipamentos.json')
  };

  console.log('======================================================================');
  console.log('INICIANDO IMPORTACAO PARA MONGODB ATLAS');
  console.log('======================================================================');

  let client;
  try {
    // Connect to MongoDB Atlas
    console.log('\n[1/4] Conectando ao MongoDB Atlas...');
    console.log('URI: mongodb+srv://forte-solar:***@cluster0.mongodb.net/forte_solar');

    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    await client.connect();
    console.log('[2/4] Verificando conexao...');

    // Test connection
    await client.db('admin').command({ ping: 1 });
    console.log('OK - Conexao estabelecida com sucesso!');

    // Get database
    const db = client.db(DATABASE_NAME);

    // Import collections
    console.log('\n[3/4] Importando colecoes...');
    let totalDocuments = 0;

    for (const [collectionName, filepath] of Object.entries(IMPORT_FILES)) {
      try {
        // Load JSON data
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        // Ensure data is an array
        let itemsToInsert = Array.isArray(data) ? data : [data];

        // Get collection and clear existing data
        const collection = db.collection(collectionName);
        const deleteResult = await collection.deleteMany({});

        // Insert new data
        if (itemsToInsert.length > 0) {
          const insertResult = await collection.insertMany(itemsToInsert);
          const count = insertResult.insertedCount;
          totalDocuments += count;
          console.log(`  [OK] ${collectionName}: ${count} documento(s) importado(s)`);
        } else {
          console.log(`  [SKIP] ${collectionName}: Arquivo vazio`);
        }

      } catch (error) {
        console.error(`  [ERRO] ${collectionName}: ${error.message}`);
        throw error;
      }
    }

    // Create indexes
    console.log('\n[4/4] Criando indices para melhor performance...');
    try {
      await db.collection('clientes').createIndex({ email: 1 });
      await db.collection('projetos_ev').createIndex({ clienteId: 1 });
      console.log('  [OK] Indices criados com sucesso!');
    } catch (error) {
      console.log(`  [AVISO] Indices ja podem existir - ${error.message}`);
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('IMPORTACAO CONCLUIDA COM SUCESSO!');
    console.log('='.repeat(70));
    console.log('\nResumo:');
    console.log(`  - Total de documentos importados: ${totalDocuments}`);
    console.log(`  - Banco de dados: MongoDB Atlas (${DATABASE_NAME})`);
    console.log(`  - Status: ONLINE - Pronto para testes`);
    console.log(`  - Cluster: cluster0.mongodb.net`);
    console.log('\nSistema Forte Solar espelhado para a nuvem com sucesso!');
    console.log('='.repeat(70));

    process.exit(0);

  } catch (error) {
    console.error('\n[ERRO] Falha na importacao: ' + error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Verifique se esta conectado a internet');
    console.error('  2. Verifique se o IP esta whitelisted no MongoDB Atlas');
    console.error('  3. Verifique as credenciais de conexao');
    console.error('  4. Tente novamente apos alguns segundos');
    process.exit(1);

  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the import
importData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
