/**
 * ResumoNecessidadeComposicao.jsx — F-05.
 *
 * ── O defeito que este componente fecha ──────────────────────────────────────
 * O bloco "Dados do Sistema" do unifilar e o "Dimensionamento" da tela de
 * detalhes descreviam o SISTEMA lendo `dimensionamento` — que é a NECESSIDADE,
 * não a composição. Um projeto cuja etapa de dimensionamento estimou 5,78 kWp /
 * 10 módulos e cujo arranjo foi montado com 14 módulos / 8,19 kWp aparecia como
 * "10 módulos" ao lado de um diagrama de 14.
 *
 * Havia um segundo erro por cima do primeiro: os dois liam `potenciaArredondada`
 * e `numPaineis`, nomes em camelCase que existem no CONTEXTO do wizard e não no
 * documento persistido (`potencia_kwp`, `num_paineis`). Contra o documento, os
 * campos vinham `undefined` e os cartões apareciam vazios — o que escondeu o
 * erro conceitual atrás de um erro de nome.
 *
 * ── As três grandezas, que a FV-DOM-052 já nomeou ────────────────────────────
 *   NECESSIDADE  quanta potência o CONSUMO exige     `dimensionamento`
 *   COMPRADA     quanta potência foi ESCOLHIDA       `arranjos[]` → `totais`
 *   INSTALADA    quanta potência está LIGADA         `mppts[] × Pmpp`
 *
 * Elas não são versões imprecisas umas das outras e PODEM divergir com razão:
 * comprar 8,19 kWp para uma necessidade de 5,78 kWp é decisão de projeto, não
 * inconsistência. Este componente mostra as duas lado a lado, cada uma com o
 * seu nome, em vez de trocar uma pela outra.
 *
 * ── Onde busca cada número ───────────────────────────────────────────────────
 * `projeto.totais` é derivado pelo Core (`obterTopologiaProjeto`) e já vem no
 * `GET /projetos-fv/:id`. Nada é recalculado aqui: somar módulos por conta
 * própria seria a quarta verdade que a F-01 acabou de remover.
 *
 * Sem composição, o componente DIZ que o sistema não foi configurado. Não
 * apresenta a necessidade como se fossem equipamentos escolhidos.
 */

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Composição REAL do projeto — o que foi escolhido.
 * Deriva de `totais`, que o Core calcula a partir de `arranjos[]`.
 */
export function composicaoDoProjeto(projeto) {
  const t = projeto?.totais ?? null
  const modulos = num(t?.n_modulos_total)
  const potencia = num(t?.potencia_total_kwp)
  const inversores = num(t?.n_inversores_total)
  if (!modulos && !potencia) return null
  return { modulos, potencia_kwp: potencia, inversores }
}

/**
 * Necessidade técnica — o que o consumo exige. Lê o documento PERSISTIDO
 * (snake_case); `potenciaArredondada`/`numPaineis` são do contexto do wizard e
 * nunca chegam aqui.
 */
export function necessidadeDoProjeto(projeto) {
  const d = projeto?.dimensionamento ?? null
  const potencia = num(d?.potencia_kwp)
  const modulos = num(d?.num_paineis)
  if (potencia === null && modulos === null) return null
  return { potencia_kwp: potencia, modulos }
}

/**
 * Strings LIGADAS, da topologia canônica (F-04: `engenharia_eletrica.arranjo`).
 * Soma `strings_paralelo` por MPPT — a contagem real, nunca um produto.
 */
export function stringsDoProjeto(projeto) {
  const mppts = projeto?.engenharia_eletrica?.arranjo?.mppts
  if (!Array.isArray(mppts) || mppts.length === 0) return null
  return mppts.reduce((s, m) => s + (num(m?.strings_paralelo) ?? 0), 0)
}

function Numero({ rotulo, valor, unidade = '', destaque = false }) {
  return (
    <div className="text-center">
      <p className="text-sm text-slate-600">{rotulo}</p>
      <p className={`text-2xl font-bold ${destaque ? 'text-blue-600' : 'text-slate-700'}`}>
        {valor === null || valor === undefined ? '—' : `${valor}${unidade}`}
      </p>
    </div>
  )
}

/**
 * @param {object}  projeto   documento vindo de `GET /projetos-fv/:id`
 * @param {boolean} [ehMicro] topologia de microinversor (rótulo da última coluna)
 */
export default function ResumoNecessidadeComposicao({ projeto, ehMicro = false }) {
  const composicao = composicaoDoProjeto(projeto)
  const necessidade = necessidadeDoProjeto(projeto)
  const strings = stringsDoProjeto(projeto)

  if (!composicao && !necessidade) return null

  return (
    <div className="space-y-3">
      {composicao ? (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Sistema configurado
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Numero rotulo="Potência" valor={composicao.potencia_kwp} unidade=" kWp" destaque />
            <Numero rotulo="Painéis" valor={composicao.modulos} destaque />
            <Numero rotulo="Inversores" valor={composicao.inversores} destaque />
            <Numero rotulo={ehMicro ? 'Microinversores' : 'Strings'}
              valor={ehMicro ? composicao.inversores : strings} destaque />
          </div>
        </div>
      ) : (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Sistema ainda não configurado — nenhum equipamento foi escolhido para o
          arranjo. Os números abaixo são a estimativa do dimensionamento, não uma
          composição.
        </p>
      )}

      {necessidade && (
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Necessidade estimada <span className="normal-case font-normal">(pelo consumo)</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Numero rotulo="Potência" valor={necessidade.potencia_kwp} unidade=" kWp" />
            <Numero rotulo="Painéis" valor={necessidade.modulos} />
          </div>
          {composicao && necessidade.potencia_kwp !== null
            && composicao.potencia_kwp !== null
            && composicao.potencia_kwp !== necessidade.potencia_kwp && (
            <p className="text-[11px] text-slate-500 mt-2">
              O sistema configurado difere da necessidade estimada. Isso é
              esperado: a composição depende do módulo disponível, do inversor e
              da decisão comercial.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
