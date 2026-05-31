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
    mongodb_uri = 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority'
    database_name = 'forte_solar'

    # Files to import
    import_files = {
        'clientes': r'C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\import-files\clientes.json',
        'projetos_ev': r'C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\import-files\projetos_ev.json',
        'equipamentos': r'C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\import-files\equipamentos.json'
    }

    print("=" * 70)
    print("INICIANDO IMPORTACAO PARA MONGODB ATLAS")
    print("=" * 70)

    try:
        # Connect to MongoDB Atlas
        print("\n[1/4] Conectando ao MongoDB Atlas...")
        print("URI: mongodb+srv://forte-solar:***@cluster0.mongodb.net/forte_solar")

        client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=10000,
            socketTimeoutMS=10000,
            connectTimeoutMS=10000
        )

        # Test connection
        print("[2/4] Verificando conexao...")
        client.admin.command('ping')
        print("OK - Conexao estabelecida com sucesso!")

        # Get database
        db = client[database_name]

        # Import collections
        print("\n[3/4] Importando colecoes...")
        total_documents = 0

        for collection_name, filepath in import_files.items():
            try:
                # Load JSON data
                data = load_json_file(filepath)

                # Ensure data is a list
                if isinstance(data, dict):
                    data = [data]
                elif not isinstance(data, list):
                    print("  [ERRO] {}: Formato invalido (esperado lista ou dicionario)".format(collection_name))
                    continue

                # Get collection and clear existing data
                collection = db[collection_name]
                collection.delete_many({})

                # Insert new data
                if data:
                    result = collection.insert_many(data)
                    count = len(result.inserted_ids)
                    total_documents += count
                    print("  [OK] {}: {} documento(s) importado(s)".format(collection_name, count))
                else:
                    print("  [SKIP] {}: Arquivo vazio".format(collection_name))

            except Exception as e:
                print("  [ERRO] {}: {}".format(collection_name, str(e)))
                raise

        # Create indexes
        print("\n[4/4] Criando indices para melhor performance...")
        try:
            db['clientes'].create_index('email')
            db['projetos_ev'].create_index('clienteId')
            print("  [OK] Indices criados com sucesso!")
        except Exception as e:
            print("  [AVISO] Indices ja podem existir - {}".format(str(e)))

        # Final summary
        print("\n" + "=" * 70)
        print("IMPORTACAO CONCLUIDA COM SUCESSO!")
        print("=" * 70)
        print("\nResumo:")
        print("  - Total de documentos importados: {}".format(total_documents))
        print("  - Banco de dados: MongoDB Atlas ({})".format(database_name))
        print("  - Status: ONLINE - Pronto para testes")
        print("  - Cluster: cluster0.mongodb.net")
        print("\nSistema Forte Solar espelhado para a nuvem com sucesso!")
        print("=" * 70)

        client.close()
        return True

    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print("\n[ERRO] Falha na conexao: {}".format(str(e)))
        print("\nTroubleshooting:")
        print("  1. Verifique se esta conectado a internet")
        print("  2. Verifique se o IP esta whitelisted no MongoDB Atlas")
        print("  3. Verifique as credenciais de conexao")
        print("  4. Tente novamente apos alguns segundos")
        return False

    except Exception as e:
        print("\n[ERRO] {}".format(str(e)))
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = import_to_atlas()
    sys.exit(0 if success else 1)
