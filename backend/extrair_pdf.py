#!/usr/bin/env python3
"""
Extract data from PDF energy bill
"""
import sys

try:
    import PyPDF2

    pdf_path = "C:\\Users\\Forte Solar\\Downloads\\Thiago - casa de farinha.pdf"

    with open(pdf_path, "rb") as pdf:
        reader = PyPDF2.PdfReader(pdf)
        print(f"📄 Número de páginas: {len(reader.pages)}\n")

        all_text = ""
        for page_num, page in enumerate(reader.pages):
            print(f"--- PÁGINA {page_num + 1} ---")
            page_text = page.extract_text()
            if page_text:
                print(page_text)
                all_text += page_text + "\n"
            else:
                print("(Sem texto extraível)")
            print()

        # Salvar em arquivo para referência
        with open("dados_energia.txt", "w", encoding="utf-8") as f:
            f.write(all_text)
        print("✅ Dados salvos em dados_energia.txt")

except ImportError:
    print("❌ PyPDF2 não está instalado")
    print("Execute: pip install PyPDF2")
    sys.exit(1)
except FileNotFoundError:
    print("❌ Arquivo PDF não encontrado")
    sys.exit(1)
except Exception as e:
    print(f"❌ Erro: {e}")
    sys.exit(1)
