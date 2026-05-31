#!/usr/bin/env python3
"""
MongoDB Atlas Final Migration Script
Espelha todos os dados do localhost para MongoDB Atlas na nuvem
"""

import json
import sys
from pymongo import MongoClient

def migrate():
    print("="*70)
    print("INICIANDO MIGRACAO PARA MONGODB ATLAS")
    print("="*70)

    try:
        # Step 1: Read local data
        print("\n[1/5] Lendo dados locais...")
        with open('data/memory-storage.json', 'r') as f:
            data = json.load(f)

        print(f"  - Clientes: {len(data['collections'].get('clientes', []))} registros")
        print(f"  - Projetos EV: {len(data['collections'].get('projetos_ev', []))} registros")
        print(f"  - Projetos FV: {len(data['collections'].get('projetos_fv', []))} registros")
        print(f"  - Equipamentos: {len(data['collections'].get('equipamentos', []))} registros")

        # Step 2: Connect to MongoDB
        print("\n[2/5] Conectando ao MongoDB Atlas...")
        uri = 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority'
        client = MongoClient(uri, serverSelectionTimeoutMS=10000)

        # Step 3: Verify connection
        print("[3/5] Verificando conexao...")
        client.admin.command('ping')
        print("  OK - Conectado!")

        db = client['forte_solar']

        # Step 4: Migrate collections
        print("\n[4/5] Importando colecoes...")
        collections = ['clientes', 'projetos_ev', 'projetos_fv', 'equipamentos', 'configuracoes']
        total_inserted = 0

        for coll_name in collections:
            items = data['collections'].get(coll_name, [])
            if items:
                collection = db[coll_name]
                collection.delete_many({})
                result = collection.insert_many(items)
                count = len(result.inserted_ids)
                total_inserted += count
                print(f"  - {coll_name}: {count} registros OK")
            else:
                print(f"  - {coll_name}: vazio (pulado)")

        # Step 5: Create indexes
        print("\n[5/5] Criando indices...")
        try:
            db['clientes'].create_index('email')
            db['projetos_ev'].create_index('clienteId')
            db['projetos_fv'].create_index('clienteId')
            print("  OK - Indices criados")
        except:
            print("  OK - Indices ja existem")

        # Final stats
        print("\n" + "="*70)
        print("MIGRACAO CONCLUIDA COM SUCESSO!")
        print("="*70)
        print(f"\nTotal de registros importados: {total_inserted}")
        print("Banco de dados: MongoDB Atlas (forte_solar)")
        print("Status: ONLINE - Pronto para testes")
        print("\nDados espelhados com sucesso para:")
        print("  mongodb+srv://forte-solar:***@cluster0.mongodb.net/forte_solar")
        print("\n" + "="*70)

        client.close()
        return True

    except Exception as e:
        print(f"\nERRO: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
