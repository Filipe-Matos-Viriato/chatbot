import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Send } from 'lucide-react';

import './index.css';

function App() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [externalContext, setExternalContext] = useState(null);
  const contextRef = useRef(null);
  const [visitorId, setVisitorId] = useState(null);
  const scrollAreaRef = useRef(null);

  useEffect(() => {
    // Scroll to the bottom of the chat history when it updates
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory]);
  
  // Visitor ID Management and other useEffects...
  // (Your existing useEffect hooks for visitorId and message handling go here)
  useEffect(() => {
    const initializeVisitor = async () => {
      let currentVisitorId = localStorage.getItem('visitor_id');

      const urlParams = new URLSearchParams(window.location.search);
      const urlVisitorId = urlParams.get('visitor_id');
      if (urlVisitorId) {
        currentVisitorId = urlVisitorId;
        localStorage.setItem('visitor_id', urlVisitorId);
      }

      if (!currentVisitorId) {
        try {
          const response = await fetch('http://localhost:3006/v1/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clientId: 'client-abc' }),
          });
          const data = await response.json();
          currentVisitorId = data.visitor_id;
          localStorage.setItem('visitor_id', currentVisitorId);
        } catch (error) {
          console.error('Failed to create visitor session:', error);
        }
      }
      setVisitorId(currentVisitorId);
    };

    initializeVisitor();
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'SET_CHATBOT_CONTEXT') {
        setExternalContext(event.data.payload);
        contextRef.current = event.data.payload;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = { sender: 'user', text: message };
    setChatHistory((prev) => [...prev, userMessage]);
    setMessage('');

    // Track event logic...
    // (Your existing trackEvent logic goes here)

    try {
      const response = await fetch('http://localhost:3006/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': 'client-abc',
        },
        body: JSON.stringify({ query: message, context: contextRef.current }),
      });
      const data = await response.json();
      const botMessage = { sender: 'bot', text: data.response };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        sender: 'bot',
        text: 'Sorry, I am having trouble connecting.',
      };
      setChatHistory((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-lg flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="Chatbot" />
              <AvatarFallback>CB</AvatarFallback>
            </Avatar>
            Real Estate Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="space-y-4 pr-4">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    msg.sender === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {msg.sender === 'bot' && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage src="https://github.com/shadcn.png" alt="Bot" />
                      <AvatarFallback>B</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 max-w-xs ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.sender === 'user' && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage src="https://github.com/identicons/user.png" alt="User" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form onSubmit={sendMessage} className="flex w-full items-center space-x-2">
            <Input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

export default App;