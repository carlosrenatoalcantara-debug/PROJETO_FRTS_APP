# 📚 Como Adicionar Seus Próprios Datasheets

Você pode indicar datasheets de qualquer equipamento solar (módulos, inversores, carregadores) de diferentes formas:

## Opção 1: Adicionar Dados Manualmente (Recomendado)

### 1.1 Módulos Solares

Edite o arquivo: `backend/src/data/equipamentosDatabase.js`

Procure pela seção `modulos` e adicione sua marca:

```javascript
'Sua Marca': {
  '600-620': {
    modelo: 'SEU-MODELO-610',
    potencia_wp: 610,
    voc: 51.8,              // Tensão de circuito aberto
    isc: 14.9,              // Corrente de curto-circuito
    vmp: 42.0,              // Tensão máxima de potência
    imp: 14.52,             // Corrente máxima de potência
    eficiencia_pct: 21.2,
    garantia_anos: 12,
    tipo: 'monocristalino',  // ou bifacial, policristalino, etc
  }
}
```

**Onde encontrar esses dados no datasheet:**
- Seção "Electrical Specifications" ou "Especificações Elétricas"
- Procure pelos termos: Voc, Isc, Vmp, Imp, Pmax

### 1.2 Inversores

Edite: `backend/src/data/equipamentosDatabase.js`

Procure pela seção `inversores` e adicione:

```javascript
'Sua Marca': {
  monofasico: {  // ou trifasico
    '5-10kW': {
      '8': {
        modelo: 'SEU-INVERSOR-8KW',
        potencia_kw: 8,
        fases: 1,           // 1 ou 3
        mppts: 2,           // Número de rastreadores MPPT
        tensao_min_v: 160,  // Tensão mínima entrada DC
        tensao_max_v: 700,  // Tensão máxima entrada DC
      }
    }
  }
}
```

**Onde encontrar no datasheet do inversor:**
- "Input Specifications" para Vmin/Vmax
- "Number of MPPT trackers"
- "Rated Power" para potência

### 1.3 Carregadores

Edite: `backend/src/data/equipamentosDatabase.js`

Procure pela seção `carregadores`:

```javascript
'Sua Marca': {
  DC: {  // ou AC para carregadores híbridos
    'Seu Modelo': {
      tipo: 'DC',
      entrada_v_max: 150,    // Tensão máxima entrada
      saida_a: 80,           // Corrente de saída máxima
      compativel_bateria: ['12V', '24V', '48V'],  // Compatibilidade
      eficiencia_pct: 97,
    }
  }
}
```

---

## Opção 2: Enviar PDFs de Datasheets

Se você tiver PDFs, pode fazer upload diretamente na aplicação:

1. Acesse: **https://projeto-frts-app.vercel.app**
2. Vá em: **Equipamentos → Novo Módulo** ou **Novo Inversor**
3. Clique em **"Upload PDF"**
4. Selecione o datasheet
5. O sistema extrai automaticamente os dados

> ℹ️ **Nota**: O sistema usa OCR para PDFs scaneados (em desenvolvimento)

---

## Opção 3: Compartilhar via GitHub

Se você mantém seus próprios datasheets em um repositório:

1. Fork o repositório: `carlosrenatoalcantara-debug/PROJETO_FRTS_APP`
2. Adicione arquivos em: `backend/src/data/datasheets-customizados/`
3. Crie um Pull Request
4. Será feito merge automático

**Formato esperado**: JSON ou JavaScript

```javascript
// Exemplo: backend/src/data/datasheets-customizados/meus-modulos.js
export const meusModulos = {
  'Marca X': {
    '500-520': {
      modelo: 'MODELO-XYZ-510',
      potencia_wp: 510,
      // ... dados completos
    }
  }
}
```

---

## Opção 4: Integração com Rede/Servidor Local

Se você tem datasheets em um servidor da sua rede:

### 4.1 Servidor HTTP/API

Configure a URL no backend:

```javascript
// backend/src/config/datasheets.js
export const DATASHEETS_URLs = {
  'https://seu-servidor.local/datasheets/modulos.json': 'modulos',
  'https://seu-servidor.local/datasheets/inversores.json': 'inversores',
}
```

### 4.2 Compartilhamento SMB/NFS

Coloque os JSONs em: `\\seu-servidor\solar\datasheets\`

E sincronize com script:

```bash
# Copiar datasheets da rede
cp /mnt/rede-solar/datasheets/* backend/src/data/datasheets-customizados/

# Ou mapeá-lo diretamente (Linux/Mac)
ln -s /mnt/rede-solar/datasheets backend/src/data/datasheets-rede
```

---

## Estrutura de Dados Esperada

### Módulo Completo
```javascript
{
  modelo: 'MARCA-MODELO-POT',          // ID único
  potencia_wp: 610,                    // Watts pico
  voc: 51.8,                           // Volts circuito aberto
  isc: 14.9,                           // Amperes curto-circuito
  vmp: 42.0,                           // Volts máx potência
  imp: 14.52,                          // Amperes máx potência
  eficiencia_pct: 21.2,                // Percentual
  garantia_anos: 12,
  tipo: 'monocristalino',              // Tipo de célula
  area_m2: 2.18,                       // Área (opcional)
  peso_kg: 22.5,                       // Peso (opcional)
  temperatura_coef_pmax_pct_c: -0.38,  // Coef temp (opcional)
  data_datasheet: '2024-01-15',
  fonte_url: 'https://...',            // Origem do dado
}
```

### Inversor Completo
```javascript
{
  modelo: 'MARCA-INVERSOR-8KW',
  potencia_kw: 8,
  fases: 3,                      // 1 ou 3
  mppts: 2,                      // Número de trackers
  tensao_min_v: 160,
  tensao_max_v: 700,
  corrente_entrada_max_a: 30,
  corrente_saida_ac_max_a: 12,  // Em monofásico
  eficiencia_max_pct: 98.3,
  peso_kg: 28,
  dimensoes_hxlxp_cm: '60x80x30',
  temperatura_operacao_min_c: -20,
  temperatura_operacao_max_c: 60,
  data_datasheet: '2024-01-15',
  fonte_url: 'https://...',
}
```

---

## Checklist para Adicionar Datasheet

- [ ] Tenho o PDF ou dados do equipamento
- [ ] Identifiquei: Marca, Modelo, Potência nominal
- [ ] Extraí especificações elétricas (V, A, W, eficiência)
- [ ] Classifiquei corretamente (módulo/inversor/carregador)
- [ ] Organizei conforme estrutura esperada
- [ ] Testei no formulário da aplicação
- [ ] Verifiquei se não há erros de digitação

---

## Suporte

**Dúvidas sobre um datasheet?**
- Procure por "Electrical Specifications" ou "Especificações Técnicas"
- Se o PDF é escaneado, use ferramenta OCR: https://ocr.space/

**Seu equipamento não está na lista?**
- Abra uma issue no GitHub
- Compartilhe o PDF/link do datasheet
- Será adicionado na próxima versão

---

## Exemplos de Datasheets Públicos

| Marca | Link |
|-------|------|
| JA Solar | https://www.jasolar.com/index.php?m=content&c=index&a=lists&catid=67 |
| Trina Solar | https://www.trinasolar.com/en/product |
| Canadian Solar | https://www.canadiansolar.com/product-support |
| Huawei | https://solar.huawei.com/en/download |
| Fronius | https://www.fronius.com/en/solar-energy/installers-partners/service-support/documentation |
| Growatt | https://en.growatt.com/support/download |
| Victron Energy | https://www.victronenergy.com/solar-charge-controllers |

