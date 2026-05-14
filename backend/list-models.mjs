const apiKey = 'AIzaSyAHEzC-JqmipKOswZBpk3QZlJp2BLeNNSs'

console.log('📋 Listando modelos disponíveis...\n')

const urls = [
  'https://generativelanguage.googleapis.com/v1/models?key=' + apiKey,
  'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
]

for (const url of urls) {
  console.log('Tentando:', url.split('?')[0])
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.models) {
      console.log(`✅ Encontrados ${data.models.length} modelos:\n`)
      data.models.forEach(m => {
        console.log(`  • ${m.name}`)
        if (m.supportedGenerationMethods) {
          console.log(`    Métodos: ${m.supportedGenerationMethods.join(', ')}`)
        }
      })
    } else {
      console.log('Erro:', data.error?.message || JSON.stringify(data))
    }
  } catch (e) {
    console.log('❌ Erro:', e.message)
  }
  console.log()
}
