/**
 * Serviço centralizado de IA
 * Integra com Gemini, OpenAI GPT e Anthropic Claude
 */

const API_PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  CLAUDE: 'claude',
}

export async function consultarIA(pergunta, contexto = {}) {
  const iaAtiva = localStorage.getItem('iaAtiva')

  // Se houver IA ativa, usar apenas ela
  if (iaAtiva === 'googleGemini') {
    const key = localStorage.getItem('geminiApiKey')
    if (key?.trim()) return consultarGemini(pergunta, contexto, key)
  }

  if (iaAtiva === 'openaiGPT') {
    const key = localStorage.getItem('openaiApiKey')
    if (key?.trim()) return consultarOpenAI(pergunta, contexto, key)
  }

  if (iaAtiva === 'claudeAI') {
    const key = localStorage.getItem('claudeApiKey')
    if (key?.trim()) return consultarClaude(pergunta, contexto, key)
  }

  // Fallback: tentar em ordem de prioridade se nenhuma está explicitamente ativa
  const geminiKey = localStorage.getItem('geminiApiKey')
  const openaiKey = localStorage.getItem('openaiApiKey')
  const claudeKey = localStorage.getItem('claudeApiKey')

  if (geminiKey?.trim()) {
    return consultarGemini(pergunta, contexto, geminiKey)
  }

  if (openaiKey?.trim()) {
    return consultarOpenAI(pergunta, contexto, openaiKey)
  }

  if (claudeKey?.trim()) {
    return consultarClaude(pergunta, contexto, claudeKey)
  }

  throw new Error('Nenhuma API de IA ativada. Configure e ative uma em Configurações.')
}

async function consultarGemini(pergunta, contexto, apiKey) {
  const prompt = construirPrompt(pergunta, contexto)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (!res.ok) {
      throw new Error(`Erro Gemini: ${res.status}`)
    }

    const data = await res.json()
    return {
      resposta: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta',
      provider: 'Google Gemini',
    }
  } catch (err) {
    console.error('Erro ao consultar Gemini:', err)
    throw err
  }
}

async function consultarOpenAI(pergunta, contexto, apiKey) {
  const prompt = construirPrompt(pergunta, contexto)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em projetos de energia solar (FV) e veículos elétricos (EV). Analise dados técnicos e responda com precisão.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      throw new Error(`Erro OpenAI: ${res.status}`)
    }

    const data = await res.json()
    return {
      resposta: data.choices?.[0]?.message?.content || 'Sem resposta',
      provider: 'OpenAI GPT',
    }
  } catch (err) {
    console.error('Erro ao consultar OpenAI:', err)
    throw err
  }
}

async function consultarClaude(pergunta, contexto, apiKey) {
  const prompt = construirPrompt(pergunta, contexto)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        system: 'Você é um especialista em projetos de energia solar (FV) e veículos elétricos (EV). Analise dados técnicos e responda com precisão.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`Erro Claude: ${res.status}`)
    }

    const data = await res.json()
    return {
      resposta: data.content?.[0]?.text || 'Sem resposta',
      provider: 'Anthropic Claude',
    }
  } catch (err) {
    console.error('Erro ao consultar Claude:', err)
    throw err
  }
}

function construirPrompt(pergunta, contexto) {
  let prompt = pergunta

  if (contexto.projeto) {
    prompt += `\n\n📋 Contexto do Projeto:\n${JSON.stringify(contexto.projeto, null, 2)}`
  }

  if (contexto.tipo === 'fv') {
    prompt += '\n\nℹ️ Este é um projeto de Energia Solar (Fotovoltaico).'
  } else if (contexto.tipo === 'ev') {
    prompt += '\n\nℹ️ Este é um projeto de Veículo Elétrico (EV).'
  }

  prompt += '\n\nResponda de forma concisa e técnica.'

  return prompt
}

export function obterApiConfigurada() {
  const iaAtiva = localStorage.getItem('iaAtiva')

  if (iaAtiva === 'googleGemini') {
    const key = localStorage.getItem('geminiApiKey')
    if (key?.trim()) return API_PROVIDERS.GEMINI
  }

  if (iaAtiva === 'openaiGPT') {
    const key = localStorage.getItem('openaiApiKey')
    if (key?.trim()) return API_PROVIDERS.OPENAI
  }

  if (iaAtiva === 'claudeAI') {
    const key = localStorage.getItem('claudeApiKey')
    if (key?.trim()) return API_PROVIDERS.CLAUDE
  }

  return null
}
