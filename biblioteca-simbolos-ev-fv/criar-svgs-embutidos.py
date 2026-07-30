# -*- coding: utf-8 -*-
"""
Converter PNGs limpos em SVGs com imagem embutida (base64)
Estratégia: SVG com <image> tag contendo o PNG em base64

Vantagem: Escalável, sem dependência de Potrace, pronto para usar no unifilar
"""
import os
import sys
import base64
from PIL import Image

# Força UTF-8 no output
sys.stdout.reconfigure(encoding='utf-8')

def criar_svg_com_png_embutido(png_path, svg_path):
    """Cria SVG que embutir o PNG como base64"""

    # Ler PNG
    with open(png_path, 'rb') as f:
        png_data = f.read()

    # Converter para base64
    b64_data = base64.b64encode(png_data).decode('ascii')

    # Obter dimensões do PNG
    img = Image.open(png_path)
    width, height = img.size

    # Criar SVG
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <!-- {os.path.basename(png_path)} - Símbolo elétrico limpo para unifilar (EV/FV) -->
  <image x="0" y="0" width="{width}" height="{height}"
         xlink:href="data:image/png;base64,{b64_data}"/>
</svg>'''

    # Salvar SVG
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print(f'✓ SVG: {os.path.basename(png_path):35} → {os.path.basename(svg_path)}')

# ============================================================================

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    # Listar arquivos CLEAN
    clean_dir = 'CLEAN'
    svg_dir = 'SVG'

    if not os.path.exists(clean_dir):
        print(f'Pasta {clean_dir} não encontrada. Execute limpar-vetorizar.py primeiro.')
        exit(1)

    os.makedirs(svg_dir, exist_ok=True)

    print("=" * 80)
    print("CRIANDO SVGs COM PNGs EMBUTIDOS (base64)")
    print("=" * 80)

    png_files = sorted([f for f in os.listdir(clean_dir) if f.endswith('.png')])

    for png_file in png_files:
        png_path = os.path.join(clean_dir, png_file)
        svg_file = png_file.replace('.png', '.svg')
        svg_path = os.path.join(svg_dir, svg_file)

        criar_svg_com_png_embutido(png_path, svg_path)

    print("\n" + "=" * 80)
    print("RESUMO")
    print("=" * 80)
    print(f'✓ {len(png_files)} SVGs criados em SVG/')
    print(f'✓ Cada SVG embutir a imagem PNG limpa em base64 (escalável, reutilizável)')
    print(f'\nPróximo: Integrar os SVGs no DiagramEngine/adapter EV')
