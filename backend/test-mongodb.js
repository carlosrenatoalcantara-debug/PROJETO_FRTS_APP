import mongoose from 'mongoose';

async function testConnection() {
  try {
    const mongoUri = 'mongodb+srv://carlosrenatoalcantara_db_user:RenatoAlcantara@cluster0.8jrrytu.mongodb.net/forte-solar?retryWrites=true&w=majority&authSource=admin';
    console.log('Tentando conectar a MongoDB Atlas...');
    
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    
    console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    console.error('Tipo:', error.name);
  }
}

testConnection();
