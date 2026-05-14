#!/usr/bin/env python3
"""
Analyze Parecer de Acesso PDFs to understand their structure and extract key information patterns
"""

import pdfplumber
import json
from pathlib import Path

# PDF file paths
parecer_files = [
    r"C:\Users\Forte Solar\OneDrive\Forte Solar\4 - Instalados\2024\206 - Sarah Rodrigues Brasil\Cosern\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2409118802.pdf",
    r"C:\Users\Forte Solar\OneDrive\Forte Solar\3 - Projetos\196 - Colégio Pinheiro\Cosern\Cosern - antigo\Cosern - 2409116390 - Fora do prazo\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2409116390.pdf",
    r"C:\Users\Forte Solar\OneDrive\Forte Solar\4 - Instalados\2024\200 - Projeto Pipa (Rafael Heider)\Cosern\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2409038083.pdf",
    r"C:\Users\Forte Solar\OneDrive\Forte Solar\4 - Instalados\2024\199 - Nancy Lamartine\Cosern\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2408297565.pdf",
    r"C:\Users\Forte Solar\OneDrive\Forte Solar\3 - Projetos\132 - Fazenda Alice\132.3 - Faz Alice A - 7015263029\Cosern - 2301040659\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2301040659.pdf",
]

def analyze_parecer(pdf_path):
    """Extract and analyze text from a Parecer PDF"""

    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"\n{'='*80}")
            print(f"FILE: {Path(pdf_path).name}")
            print(f"{'='*80}")
            print(f"Total Pages: {len(pdf.pages)}\n")

            # Extract first 2 pages
            for page_num in range(min(2, len(pdf.pages))):
                page = pdf.pages[page_num]
                text = page.extract_text()

                print(f"\n{'─'*80}")
                print(f"PAGE {page_num + 1} TEXT:")
                print(f"{'─'*80}")
                print(text)

                # Try to extract tables if present
                tables = page.extract_tables()
                if tables:
                    print(f"\nTABLES FOUND ON PAGE {page_num + 1}:")
                    for i, table in enumerate(tables):
                        print(f"\nTable {i+1}:")
                        for row in table:
                            print(row)

    except Exception as e:
        print(f"ERROR processing {pdf_path}: {str(e)}")

def main():
    """Process all Parecer files"""
    print("\n" + "="*80)
    print("PARECER DE ACESSO DOCUMENT ANALYSIS")
    print("="*80)

    for pdf_file in parecer_files:
        if Path(pdf_file).exists():
            analyze_parecer(pdf_file)
        else:
            print(f"\nWARNING: File not found - {pdf_file}")

    print("\n\n" + "="*80)
    print("ANALYSIS COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
