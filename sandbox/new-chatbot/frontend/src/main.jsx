import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [messages, setMessages] = React.useState([{ from: 'bot', text: 'Olá! Como posso ajudar?' }])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const send = async () => {
    if (!input.trim()) return
    const user = { from: 'user', text: input }
    setMessages(m => [...m, user])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('http://localhost:4107/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: user.text })
      })
      const data = await res.json()
      setMessages(m => [...m, { from: 'bot', text: data.response || 'No response' }])
    } catch (e) {
      setMessages(m => [...m, { from: 'bot', text: 'Erro de ligação ao backend.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>New Chatbot Sandbox</h1>
      <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, minHeight: 300 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
              margin: '8px 0'
            }}
          >
            <div
              style={{
                background: m.from === 'user' ? '#dbeafe' : '#f3f4f6',
                padding: '8px 12px',
                borderRadius: 12,
                maxWidth: '80%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                display: 'inline-block'
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1, padding: 8 }} placeholder="Escreva a sua pergunta..." />
        <button onClick={send} disabled={loading}>Enviar</button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)


