#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Limpar valores hardcoded dos PNGs e preparar para vetorização (SVG)
Remove textos como "10A", "50mA", "400V", "30mA", etc.
"""
import os
import sys
from PIL import Image, ImageDraw
import subprocess

# Força UTF-8 no output
sys.stdout.reconfigure(encoding='utf-8')

def limpar_disjuntor_idr(input_path, output_path):
    """Remove texto dos disjuntores/IDRs (que está acima dos símbolos)"""
    img = Image.open(input_path)
    width, height = img.size

    # Estratégia: substituir a área do texto por branco
    # O texto fica na parte superior (primeiros ~150 pixels dependendo da altura)
    # Mas sem quebrar os símbolos. Vou ser mais preciso:
    # - Disjuntor: texto está ~30px acima do símbolo, remove a faixa onde há "10A"
    # - IDR: texto está no meio/acima, remove a faixa

    # Abordagem simples: converter para RGB, detectar áreas muito claras (texto em branco)
    # e substituir por branco puro, depois remover linhas de texto via crop inteligente

    img_copy = img.convert('RGB')
    pixels = img_copy.load()

    # Remover área de texto: procurar por linha de pixels que é quase toda branca
    # e remover tudo acima/ao redor
    # Estratégia: remover uma faixa na área onde esperamos texto

    # Para disjuntor: remove os primeiros 60 pixels (onde está "10A")
    # Para IDR: remove os primeiros 80 pixels (onde está "10A / 50mA")
    crop_top = 80

    # Criar imagem branca nos pixels de texto
    draw = ImageDraw.Draw(img_copy)
    draw.rectangle([0, 0, width, crop_top], fill=(255, 255, 255))

    img_copy.save(output_path, quality=95)
    print(f"✓ Limpado: {os.path.basename(input_path)} → {os.path.basename(output_path)}")

def limpar_dps(input_path, output_path):
    """Remove texto dos DPS (valores UC, In, Up)"""
    img = Image.open(input_path)
    width, height = img.size

    img_copy = img.convert('RGB')
    draw = ImageDraw.Draw(img_copy)

    # DPS tem texto em caixas no meio/inferior
    # Remover área onde está o texto (caixa branca com specs)
    # Estratégia: remover os primeiros 120 pixels
    draw.rectangle([0, 0, width, 120], fill=(255, 255, 255))

    img_copy.save(output_path, quality=95)
    print(f"✓ Limpado: {os.path.basename(input_path)} → {os.path.basename(output_path)}")

def copiar_sem_texto(input_path, output_path, component_type):
    """Para componentes que já não têm valores (barramento, condutores)"""
    img = Image.open(input_path)
    img.save(output_path, quality=95)
    print(f"✓ Copiado (sem texto): {os.path.basename(input_path)} → {os.path.basename(output_path)}")

def vetorizar_com_potrace(png_path, svg_path):
    """Converter PNG para SVG com Potrace"""
    try:
        # Verificar se potrace está instalado
        subprocess.run(['potrace', '--version'], capture_output=True, check=True)

        # Executar potrace
        cmd = [
            'potrace',
            '-s',  # SVG output
            '-o', svg_path,
            png_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            print(f"✓ Vetorizado: {os.path.basename(png_path)} → {os.path.basename(svg_path)}")
            return True
        else:
            print(f"⚠ Erro Potrace: {result.stderr}")
            return False
    except FileNotFoundError:
        print("⚠ Potrace não instalado. Pulando vetorização.")
        return False

# ============================================================================

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    # Definir transformações
    transformacoes = [
        ('1-disjuntor-simbolos.png', 'CLEAN/1-disjuntor-simbolos.png', 'disjuntor'),
        ('1-disjuntor-modelo.png', 'CLEAN/1-disjuntor-modelo.png', 'disjuntor'),
        ('2-idr-simbolos.png', 'CLEAN/2-idr-simbolos.png', 'idr'),
        ('3-dps-multiplo.png', 'CLEAN/3-dps-multiplo.png', 'dps'),
        ('4-barramento-acessorios.png', 'CLEAN/4-barramento-acessorios.png', 'barramento'),
        ('5-barramento-bifasico.png', 'CLEAN/5-barramento-bifasico.png', 'barramento'),
        ('6-barramento-trifasico.png', 'CLEAN/6-barramento-trifasico.png', 'barramento'),
        ('7-condutores-simbolos.png', 'CLEAN/7-condutores-simbolos.png', 'condutores'),
    ]

    # Criar pasta CLEAN
    os.makedirs('CLEAN', exist_ok=True)
    os.makedirs('SVG', exist_ok=True)

    print("=" * 70)
    print("LIMPANDO VALORES HARDCODED (PNG → PNG limpo)")
    print("=" * 70)

    for input_file, output_file, comp_type in transformacoes:
        if not os.path.exists(input_file):
            print(f"✗ Não encontrado: {input_file}")
            continue

        if comp_type in ('disjuntor', 'idr'):
            limpar_disjuntor_idr(input_file, output_file)
        elif comp_type == 'dps':
            limpar_dps(input_file, output_file)
        else:
            copiar_sem_texto(input_file, output_file, comp_type)

    print("\n" + "=" * 70)
    print("VETORIZANDO (PNG → SVG com Potrace)")
    print("=" * 70)

    for input_file, output_file, _ in transformacoes:
        clean_file = output_file
        svg_file = output_file.replace('CLEAN/', 'SVG/').replace('.png', '.svg')

        if os.path.exists(clean_file):
            vetorizar_com_potrace(clean_file, svg_file)

    print("\n" + "=" * 70)
    print("RESUMO")
    print("=" * 70)
    print(f"✓ CLEAN/  — PNGs limpos (sem valores hardcoded)")
    print(f"✓ SVG/    — SVGs vetorizados (pronto para integração)")
    print("\nPróximo: integrar os SVGs no DiagramEngine")
