import React, { useState, useRef, useEffect } from 'react';
import { Send, MapPin, Clock, Utensils, ShoppingBag, Palmtree, Landmark, Settings, ArrowRight } from 'lucide-react';
import { ChatConfig, ChatMessage } from '../types';
import { supabase } from '../lib/supabase';

const translations: Record<string, any> = {
  'Español': {
    title: 'Asistente Vigo',
    subtitle: 'Tu guía local interactiva',
    timeLabel: 'Tiempo disponible',
    times: {
      'Pocas horas': 'Pocas horas',
      'Medio día': 'Medio día',
      'Día completo': 'Día completo'
    },
    interestsLabel: 'Tus intereses',
    interests: {
      'Comida': 'Comida',
      'Vistas': 'Vistas',
      'Compras': 'Compras',
      'Historia': 'Historia',
      'Playa': 'Playa'
    },
    languageLabel: 'Idioma / Language',
    startBtn: 'Comenzar a explorar',
    initialGreeting: '¡Hola! Soy tu asistente local de Vigo. ¿En qué te puedo ayudar hoy?'
  },
  'English': {
    title: 'Vigo Assistant',
    subtitle: 'Your interactive local guide',
    timeLabel: 'Available time',
    times: {
      'Pocas horas': 'A few hours',
      'Medio día': 'Half day',
      'Día completo': 'Full day'
    },
    interestsLabel: 'Your interests',
    interests: {
      'Comida': 'Food',
      'Vistas': 'Sights',
      'Compras': 'Shopping',
      'Historia': 'History',
      'Playa': 'Beaches'
    },
    languageLabel: 'Language',
    startBtn: 'Start exploring',
    initialGreeting: 'Hello! I am your local assistant from Vigo. How can I help you today?'
  },
  'Deutsch': {
    title: 'Vigo Assistent',
    subtitle: 'Dein interaktiver Reiseführer',
    timeLabel: 'Verfügbare Zeit',
    times: {
      'Pocas horas': 'Ein paar Stunden',
      'Medio día': 'Halber Tag',
      'Día completo': 'Ganzer Tag'
    },
    interestsLabel: 'Deine Interessen',
    interests: {
      'Comida': 'Essen',
      'Vistas': 'Aussichten',
      'Compras': 'Einkaufen',
      'Historia': 'Geschichte',
      'Playa': 'Strand'
    },
    languageLabel: 'Sprache / Language',
    startBtn: 'Erkundung beginnen',
    initialGreeting: 'Hallo! Ich bin dein lokaler Assistent aus Vigo. Wie kann ich dir heute helfen?'
  },
  'Français': {
    title: 'Assistant Vigo',
    subtitle: 'Votre guide local interactif',
    timeLabel: 'Temps disponible',
    times: {
      'Pocas horas': 'Quelques heures',
      'Medio día': 'Demi-journée',
      'Día completo': 'Journée entière'
    },
    interestsLabel: 'Vos intérêts',
    interests: {
      'Comida': 'Nourriture',
      'Vistas': 'Vues',
      'Compras': 'Shopping',
      'Historia': 'Histoire',
      'Playa': 'Plage'
    },
    languageLabel: 'Langue / Language',
    startBtn: 'Commencer à explorer',
    initialGreeting: 'Bonjour ! Je suis votre assistant local de Vigo. Comment puis-je vous aider aujourd\'hui ?'
  },
  'Português': {
    title: 'Assistente Vigo',
    subtitle: 'Seu guia local interativo',
    timeLabel: 'Tempo disponível',
    times: {
      'Pocas horas': 'Poucas horas',
      'Medio día': 'Meio dia',
      'Día completo': 'Dia inteiro'
    },
    interestsLabel: 'Seus interesses',
    interests: {
      'Comida': 'Comida',
      'Vistas': 'Vistas',
      'Compras': 'Compras',
      'Historia': 'História',
      'Playa': 'Praia'
    },
    languageLabel: 'Idioma / Language',
    startBtn: 'Começar a explorar',
    initialGreeting: 'Olá! Sou o seu assistente local de Vigo. Como posso ajudá-lo hoje?'
  }
};

export default function Chat() {
  const [step, setStep] = useState<'config' | 'chat'>('config');
  const [config, setConfig] = useState<ChatConfig>({
    timeAvailable: '',
    interests: [],
    language: 'Español'
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleInterest = (interest: string) => {
    setConfig(prev => ({
      ...prev,
      interests: prev.interests.includes(interest) 
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const startChat = async () => {
    setStep('chat');
    
    // Generar un ID de sesión simple
    const sessionId = Date.now().toString();

    // Add initial greeting based on config
    const t = translations[config.language] || translations['Español'];
    const initialGreeting = t.initialGreeting;
      
    setMessages([{ id: sessionId, text: initialGreeting, isBot: true }]);

    // Guardar métrica de la conversación en Supabase
    try {
      await supabase.from('conversations').insert({
        session_id: sessionId,
        language: config.language,
        time_available: config.timeAvailable,
        interests: config.interests
      });
    } catch (err) {
      console.error("Error al registrar conversación:", err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), text: input, isBot: false };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          config
        })
      });
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { id: Date.now().toString(), text: data.text, isBot: true }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Lo siento, ha ocurrido un error al conectar con el servidor.", isBot: true }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (step === 'config') {
    const t = translations[config.language] || translations['Español'];
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="p-8 text-center bg-blue-600 text-white">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">{t.title}</h1>
            <p className="text-blue-100 font-medium">{t.subtitle}</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">{t.timeLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {['Pocas horas', 'Medio día', 'Día completo'].map(time => (
                  <button 
                    key={time}
                    onClick={() => setConfig({...config, timeAvailable: time})}
                    className={`p-2 text-sm rounded-lg border transition-all ${config.timeAvailable === time ? 'bg-blue-50 border-blue-600 text-blue-700 font-medium shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    {t.times[time]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">{t.interestsLabel}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'Comida', icon: <Utensils size={14} className="mr-1" /> },
                  { id: 'Vistas', icon: <MapPin size={14} className="mr-1" /> },
                  { id: 'Compras', icon: <ShoppingBag size={14} className="mr-1" /> },
                  { id: 'Historia', icon: <Landmark size={14} className="mr-1" /> },
                  { id: 'Playa', icon: <Palmtree size={14} className="mr-1" /> }
                ].map(interest => (
                  <button 
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`flex items-center px-3 py-1.5 text-sm rounded-full border transition-all ${config.interests.includes(interest.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    {interest.icon} {t.interests[interest.id]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">{t.languageLabel}</label>
              <select 
                value={config.language} 
                onChange={(e) => setConfig({...config, language: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                {['Español', 'English', 'Deutsch', 'Français', 'Português'].map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={startChat}
              className="w-full flex items-center justify-center py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all shadow-md mt-4 group"
            >
              {t.startBtn}
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans">
      <header className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            V
          </div>
          <h1 className="text-lg font-bold text-slate-800">Asistente Vigo</h1>
        </div>
        <button 
          onClick={() => setStep('config')} 
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm leading-relaxed ${
                msg.isBot 
                  ? 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm' 
                  : 'bg-blue-600 text-white rounded-tr-sm shadow-blue-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-500 px-5 py-4 rounded-2xl border border-slate-200 rounded-tl-sm shadow-sm flex space-x-2 items-center">
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-4xl mx-auto relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..." 
            className="flex-1 pl-4 pr-12 py-3.5 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 shadow-sm"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
