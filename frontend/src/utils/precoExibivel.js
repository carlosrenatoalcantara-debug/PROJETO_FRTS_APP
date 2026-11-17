/** Preço só é exibido quando é um número finito > 0. Nulo, zero ou texto = não mostrar (nunca "R$ 0"). */
export function precoExibivel(valor) {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) && n > 0 ? n : null
}
