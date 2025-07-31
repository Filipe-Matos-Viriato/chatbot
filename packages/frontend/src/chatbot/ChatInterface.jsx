import { useState, useEffect, useRef } from 'react';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Hello! How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [visitorId, setVisitorId] = useState('placeholder_visitor_id'); // This should be dynamic in a real app

  useEffect(() => {
    setSessionId(generateUUID());
  }, []);

  const handleSend = async () => {
    if (input.trim()) {
      const userMessage = { from: 'user', text: input };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const response = await fetch('http://localhost:3006/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'client-abc' // This should be dynamic in a real app
          },
          body: JSON.stringify({ query: input, context: null, session_id: sessionId, visitor_id: visitorId }), // Add context if needed
        });

        const data = await response.json();
        const botMessage = { from: 'bot', text: data.response };
        setMessages(prev => [...prev, botMessage]);
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage = { from: 'bot', text: 'Sorry, I am having trouble connecting.' };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <Card className="w-[440px] h-[700px] grid grid-rows-[auto,1fr,auto]">
        <CardHeader>
          <CardTitle>Chatbot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-end gap-2 ${message.from === 'user' ? 'justify-end' : ''}`}>
              {message.from === 'bot' && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback>CB</AvatarFallback>
                </Avatar>
              )}
              <div className={`rounded-lg px-3 py-2 ${message.from === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
                <p className="text-sm">{message.text}</p>
              </div>
              {message.from === 'user' && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback>YOU</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-end gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>CB</AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-3 py-2 bg-gray-200 text-gray-900">
                <p className="text-sm">...</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center gap-2">
          <Input 
            placeholder="Type your message..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading}>Send</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ChatInterface; 