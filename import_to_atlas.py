#!/usr/bin/env python3
"""
MongoDB Atlas Data Import Script
Imports JSON files from local filesystem to MongoDB Atlas cloud database
"""

import json
import sys
from pathlib import Path
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

def load_json_file(filepath):
    """Load and parse a JSON file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def import_to_atlas():
    """Main import function"""

    # MongoDB Atlas connection details
    mongodb_uri = 'mongodb+srv://forte-solar:Cr1pt0grafia@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority'
    database_name = 'forte_solar'

    # Files to import
    import_files = {
        'clientes': r'C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\import-files\clientes.json',
        'projetos_ev': r'C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\import-files\projetos_ev.json',
        'equipamentos': r'C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\import-files\equipamentos.json'
    }

    print("=" * 70)
    print("🚀 INICIANDO IMPORTAÇÃO PARA MONGODB ATLAS")
    print("=" * 70)

    try:
        # Connect to MongoDB Atlas
        print("\n[1/4] Conectando ao MongoDB Atlas...")
        print(f"URI: mongodb+srv://forte-solar:***@cluster0.mongodb.net/forte_solar")

        client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=10000,
            socketTimeoutMS=10000,
            connectTimeoutMS=10000
        )

        # Test connection
        print("[2/4] Verificando conexão...")
        client.admin.command('ping')
        print("✅ Conexão estabelecida com sucesso!")

        # Get database
        db = client[database_name]

        # Import collections
        print("\n[3/4] Importando coleções...")
        total_documents = 0

        for collection_name, filepath in import_files.items():
            try:
                # Load JSON data
                data = load_json_file(filepath)

                # Ensure data is a list
                if isinstance(data, dict):
                    data = [data]
                elif not isinstance(data, list):
                    print(f"  ❌ {collection_name}: Formato inválido (esperado lista ou dicionário)")
                    continue

                # Get collection and clear existing data
                collection = db[collection_name]
                collection.delete_many({})

                # Insert new data
                if data:
                    result = collection.insert_many(data)
                    count = len(result.inserted_ids)
                    total_documents += count
                    print(f"  ✅ {collection_name}: {count} documento(s) importado(s)")
                else:
                    print(f"  ⏭️  {collection_name}: Arquivo vazio")

            except Exception as e:
                print(f"  ❌ {collection_name}: Erro - {str(e)}")
                raise

        # Create indexes
        print("\n[4/4] Criando índices para melhor performance...")
        try:
            db['clientes'].create_index('email')
            db['projetos_ev'].create_index('clienteId')
            print("  ✅ Índices criados com sucesso!")
        except Exception as e:
            print(f"  ⚠️  Índices já podem existir - {str(e)}")

        # Final summary
        print("\n" + "=" * 70)
        print("✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!")
        print("=" * 70)
        print(f"\n📊 Resumo:")
        print(f"  - Total de documentos importados: {total_documents}")
        print(f"  - Banco de dados: MongoDB Atlas ({database_name})")
        print(f"  - Status: ONLINE - Pronto para testes")
        print(f"  - Cluster: cluster0.mongodb.net")
        print(f"\n🎉 Sistema Forte Solar espelhado para a nuvem com sucesso!")
        print("=" * 70)

        client.close()
        return True

    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print(f"\n❌ ERRO DE CONEXÃO: {str(e)}")
        print("\nTroubleshooting:")
        print("  1. Verifique se está conectado à internet")
        print("  2. Verifique se o IP está whitelisted no MongoDB Atlas")
        print("  3. Verifique as credenciais de conexão")
        print("  4. Tente novamente após alguns segundos")
        return False

    except Exception as e:
        print(f"\n❌ ERRO: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = import_to_atlas()
    sys.exit(0 if success else 1)
