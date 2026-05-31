#!/usr/bin/env node
/**
 * MongoDB Atlas Data Import - Mongoose Version
 * Uses Mongoose to import JSON data to MongoDB Atlas
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define simple schemas for import
const clienteSchema = new mongoose.Schema({}, { strict: false });
const projetoEvSchema = new mongoose.Schema({}, { strict: false });
const equipamentoSchema = new mongoose.Schema({}, { strict: false });

const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');
const ProjetoEV = mongoose.model('ProjetoEV', projetoEvSchema, 'projetos_ev');
const Equipamento = mongoose.model('Equipamento', equipamentoSchema, 'equipamentos');

async function importData() {
  console.log('======================================================================');
  console.log('INICIANDO IMPORTACAO PARA MONGODB ATLAS (Mongoose)');
  console.log('======================================================================\n');

  try {
    // Connect to MongoDB
    console.log('[1/4] Conectando ao MongoDB Atlas via Mongoose...');
    const mongoUri = 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority';

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    console.log('OK - Conexao estabelecida com sucesso!\n');

    // Prepare data
    console.log('[2/4] Carregando arquivos JSON...');

    const clientesPath = path.join(__dirname, 'data/import-files/clientes.json');
    const projetosEvPath = path.join(__dirname, 'data/import-files/projetos_ev.json');
    const equipamentosPath = path.join(__dirname, 'data/import-files/equipamentos.json');

    const clientesData = JSON.parse(fs.readFileSync(clientesPath, 'utf-8'));
    const projetosEvData = JSON.parse(fs.readFileSync(projetosEvPath, 'utf-8'));
    const equipamentosData = JSON.parse(fs.readFileSync(equipamentosPath, 'utf-8'));

    console.log('OK - Arquivos carregados\n');

    // Import data
    console.log('[3/4] Importando colecoes...');
    let totalDocuments = 0;

    // Clear and import clientes
    await Cliente.deleteMany({});
    const clientesArray = Array.isArray(clientesData) ? clientesData : [clientesData];
    const clientesResult = await Cliente.insertMany(clientesArray);
    console.log(`  [OK] clientes: ${clientesResult.length} documento(s) importado(s)`);
    totalDocuments += clientesResult.length;

    // Clear and import projetos_ev
    await ProjetoEV.deleteMany({});
    const projetosEvArray = Array.isArray(projetosEvData) ? projetosEvData : [projetosEvData];
    const projetosEvResult = await ProjetoEV.insertMany(projetosEvArray);
    console.log(`  [OK] projetos_ev: ${projetosEvResult.length} documento(s) importado(s)`);
    totalDocuments += projetosEvResult.length;

    // Clear and import equipamentos
    await Equipamento.deleteMany({});
    const equipamentosArray = Array.isArray(equipamentosData) ? equipamentosData : [equipamentosData];
    const equipamentosResult = await Equipamento.insertMany(equipamentosArray);
    console.log(`  [OK] equipamentos: ${equipamentosResult.length} documento(s) importado(s)\n`);
    totalDocuments += equipamentosResult.length;

    // Create indexes
    console.log('[4/4] Criando indices...');
    try {
      await Cliente.collection.createIndex({ email: 1 });
      await ProjetoEV.collection.createIndex({ clienteId: 1 });
      console.log('  [OK] Indices criados com sucesso!\n');
    } catch (error) {
      console.log(`  [AVISO] Indices ja podem existir\n`);
    }

    // Final summary
    console.log('======================================================================');
    console.log('IMPORTACAO CONCLUIDA COM SUCESSO!');
    console.log('======================================================================');
    console.log('\nResumo:');
    console.log(`  - Total de documentos importados: ${totalDocuments}`);
    console.log(`  - Banco de dados: MongoDB Atlas (forte_solar)`);
    console.log(`  - Status: ONLINE - Pronto para testes`);
    console.log(`  - Cluster: cluster0.mongodb.net`);
    console.log('\nSistema Forte Solar espelhado para a nuvem com sucesso!');
    console.log('======================================================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n[ERRO] Falha na importacao:');
    console.error('Mensagem:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Verifique se esta conectado a internet');
    console.error('  2. Verifique se o IP esta whitelisted no MongoDB Atlas');
    console.error('  3. Verifique as credenciais de conexao');
    console.error('  4. Tente novamente apos alguns segundos');
    process.exit(1);

  } finally {
    try {
      await mongoose.connection.close();
    } catch (e) {
      // Connection already closed
    }
  }
}

// Run the import
importData().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
