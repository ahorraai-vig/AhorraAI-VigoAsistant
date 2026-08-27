import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, MapPin, Clock, Utensils, ShoppingBag, Palmtree, Landmark, Settings, Shield, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatConfig, ChatMessage } from '../types';
import { supabase } from '../lib/supabase';

const translations: Record<string, any> = {
  'Español': {
    title: 'Asistente Vigo',
    subtitle: 'Tu guía local',
    userTypeTitle: '¿Quién eres?',
    userTypeTourist: 'Visita',
    userTypeLocal: 'Soy de aquí',
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
    languageLabel: 'Idioma',
    languageTitle: 'Selecciona tu idioma',
    startBtn: 'Continuar',
    skipBtn: 'Prefiero escribir lo que busco',
    initialGreeting: '¡Hola! Soy tu asistente local de Vigo. ¿En qué te puedo ayudar hoy?'
  },
  'Galego': {
    title: 'Asistente Vigo',
    subtitle: 'A túa guía local',
    userTypeTitle: 'Quen es?',
    userTypeTourist: 'Visita',
    userTypeLocal: 'Son de aquí',
    timeLabel: 'Tempo dispoñible',
    times: {
      'Pocas horas': 'Poucas horas',
      'Medio día': 'Medio día',
      'Día completo': 'Día completo'
    },
    interestsLabel: 'Os teus intereses',
    interests: {
      'Comida': 'Comida',
      'Vistas': 'Vistas',
      'Compras': 'Compras',
      'Historia': 'Historia',
      'Playa': 'Praia'
    },
    languageLabel: 'Idioma',
    languageTitle: 'Selecciona o teu idioma',
    startBtn: 'Continuar',
    skipBtn: 'Prefiro escribir o que busco',
    initialGreeting: 'Ola! Son o teu asistente local de Vigo. En que te podo axudar hoxe?'
  },
  'English': {
    title: 'Vigo Assistant',
    subtitle: 'Your local guide',
    userTypeTitle: 'Who are you?',
    userTypeTourist: 'Tourist',
    userTypeLocal: 'Local',
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
    languageTitle: 'Select your language',
    startBtn: 'Continue',
    skipBtn: 'I prefer to type what I need',
    initialGreeting: 'Hello! I am your local assistant from Vigo. How can I help you today?'
  },
  'Deutsch': {
    title: 'Vigo Assistent',
    subtitle: 'Dein Reiseführer',
    userTypeTitle: 'Wer bist du?',
    userTypeTourist: 'Besucher',
    userTypeLocal: 'Einheimischer',
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
    languageLabel: 'Sprache',
    languageTitle: 'Wähle deine Sprache',
    startBtn: 'Weiter',
    skipBtn: 'Ich tippe lieber, was ich suche',
    initialGreeting: 'Hallo! Ich bin dein lokaler Assistent aus Vigo. Wie kann ich dir heute helfen?'
  },
  'Français': {
    title: 'Assistant Vigo',
    subtitle: 'Votre guide local',
    userTypeTitle: 'Qui êtes-vous ?',
    userTypeTourist: 'Visiteur',
    userTypeLocal: 'Local',
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
    languageLabel: 'Langue',
    languageTitle: 'Sélectionnez votre langue',
    startBtn: 'Continuer',
    skipBtn: 'Je préfère écrire ce que je cherche',
    initialGreeting: 'Bonjour ! Je suis votre assistant local de Vigo. Comment puis-je vous aider aujourd\'hui ?'
  },
  'Português': {
    title: 'Assistente Vigo',
    subtitle: 'Seu guia local',
    userTypeTitle: 'Quem é você?',
    userTypeTourist: 'Visitante',
    userTypeLocal: 'Local',
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
    languageLabel: 'Idioma',
    languageTitle: 'Selecione seu idioma',
    startBtn: 'Continuar',
    skipBtn: 'Prefiro digitar o que procuro',
    initialGreeting: 'Olá! Sou o seu assistente local de Vigo. Como posso ajudá-lo hoje?'
  },
  'Italiano': {
    title: 'Assistente Vigo',
    subtitle: 'La tua guida locale',
    userTypeTitle: 'Chi sei?',
    userTypeTourist: 'Visitatore',
    userTypeLocal: 'Locale',
    timeLabel: 'Tempo a disposizione',
    times: {
      'Pocas horas': 'Poche ore',
      'Medio día': 'Mezza giornata',
      'Día completo': 'Giornata intera'
    },
    interestsLabel: 'I tuoi interessi',
    interests: {
      'Comida': 'Cibo',
      'Vistas': 'Panorami',
      'Compras': 'Shopping',
      'Historia': 'Storia',
      'Playa': 'Spiaggia'
    },
    languageLabel: 'Lingua',
    languageTitle: 'Seleziona la tua lingua',
    startBtn: 'Continua',
    skipBtn: 'Preferisco scrivere cosa cerco',
    initialGreeting: 'Ciao! Sono il tuo assistente locale di Vigo. Come posso aiutarti oggi?'
  }
};

const greetings = [
  { text: 'Bienvenido a Vigo', lang: 'Español' },
  { text: 'Benvido a Vigo', lang: 'Galego' },
  { text: 'Welcome to Vigo', lang: 'English' },
  { text: 'Bienvenue à Vigo', lang: 'Français' },
  { text: 'Willkommen in Vigo', lang: 'Deutsch' },
  { text: 'Bem-vindo a Vigo', lang: 'Português' },
  { text: 'Benvenuto a Vigo', lang: 'Italiano' }
];

export default function Chat() {
  const [step, setStep] = useState<'welcome' | 'language' | 'userType' | 'config' | 'chat'>('welcome');
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [langTitleIndex, setLangTitleIndex] = useState(0);
  const [config, setConfig] = useState<ChatConfig>({
    timeAvailable: '',
    interests: [],
    language: 'Español'
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 'welcome') {
      const interval = setInterval(() => {
        setGreetingIndex((prev) => (prev + 1) % greetings.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'language') {
      const interval = setInterval(() => {
        setLangTitleIndex((prev) => (prev + 1) % Object.keys(translations).length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [step]);

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
    
    const sessionId = Date.now().toString();
    const t = translations[config.language] || translations['Español'];
    const initialGreeting = t.initialGreeting;
      
    setMessages([{ id: sessionId, text: initialGreeting, isBot: true }]);

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

  const renderContent = () => {
    if (step === 'welcome') {
      return (
        <div 
          className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative cursor-pointer selection:bg-transparent"
          onClick={() => setStep('language')}
        >
          <div className="flex-1 flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              <motion.h1
                key={greetingIndex}
                initial={{ opacity: 0, filter: 'blur(10px)', y: 10 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0, filter: 'blur(10px)', y: -10 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl md:text-6xl font-light tracking-tight text-center"
              >
                {greetings[greetingIndex].text}
              </motion.h1>
            </AnimatePresence>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="pb-12"
          >
            <p className="text-sm font-medium tracking-widest uppercase text-white/50 animate-pulse">
              Toca para continuar
            </p>
          </motion.div>
        </div>
      );
    }

    if (step === 'language') {
      const languages = Object.keys(translations);
      const currentLang = languages[langTitleIndex];
      const currentTitle = translations[currentLang].languageTitle;
      
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-black flex flex-col p-6 font-sans text-white items-center justify-center"
        >
          <div className="w-full max-w-sm flex-1 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentLang}
                initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center w-full"
              >
                <h2 className="text-3xl font-light tracking-tight text-center mb-10 text-white/80">
                  {currentTitle}
                </h2>
                
                <button
                  onClick={() => {
                    setConfig({...config, language: currentLang});
                    setStep('userType');
                  }}
                  className="w-full py-5 px-8 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-all text-xl font-semibold text-center shadow-lg border border-white/10 text-white"
                >
                  {currentLang}
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      );
    }
    if (step === 'userType') {
      const t = translations[config.language] || translations['Español'];
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-black flex flex-col p-6 font-sans text-white items-center justify-center"
        >
          <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="text-2xl font-light tracking-tight text-center mb-10 text-white/80"
            >
              {t.userTypeTitle}
            </motion.h2>
            
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center justify-center">
              <motion.button
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                onClick={() => {
                  setConfig({...config, userType: 'tourist'});
                  setStep('config');
                }}
                className="w-44 h-44 md:w-52 md:h-52 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-colors flex flex-col items-center justify-center text-xl font-medium shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10"
              >
                <Palmtree size={32} className="mb-3 opacity-70" />
                {t.userTypeTourist}
              </motion.button>
              
              <motion.button
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
                onClick={() => {
                  setConfig({...config, userType: 'local'});
                  setStep('config');
                }}
                className="w-44 h-44 md:w-52 md:h-52 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-colors flex flex-col items-center justify-center text-xl font-medium shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10"
              >
                <MapPin size={32} className="mb-3 opacity-70" />
                {t.userTypeLocal}
              </motion.button>
            </div>
          </div>
        </motion.div>
      );
    }

    if (step === 'config') {
      const t = translations[config.language] || translations['Español'];
      
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-black flex flex-col p-4 md:p-8 font-sans text-white"
        >
          <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
            
            <div className="text-center mt-8 mb-10">
              <h1 className="text-3xl font-semibold tracking-tight text-white">{t.title}</h1>
              <p className="text-white/50 mt-1">{t.subtitle}</p>
            </div>
            
            <div className="flex-1 space-y-8 mb-8 flex flex-col items-center">
              
              {config.userType === 'tourist' && (
                <motion.div 
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                  className="bg-[#1C1C1E] rounded-[48px] p-8 shadow-xl w-full max-w-sm border border-white/5 flex flex-col items-center"
                >
                  <label className="block text-sm font-medium text-white/70 uppercase tracking-widest mb-6 text-center">{t.timeLabel}</label>
                  <div className="flex flex-col gap-3 w-full items-center">
                    {['Pocas horas', 'Medio día', 'Día completo'].map((time, idx) => (
                      <motion.button 
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: idx * 0.5 }}
                        key={time}
                        onClick={() => setConfig({...config, timeAvailable: time})}
                        className={`w-[85%] py-4 rounded-full text-center font-medium transition-colors ${
                          config.timeAvailable === time 
                            ? 'bg-white text-black shadow-md' 
                            : 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                        }`}
                      >
                        {t.times[time]}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.div 
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 2.5 }}
                className="bg-[#1C1C1E] rounded-[48px] p-8 shadow-xl w-full max-w-sm border border-white/5 flex flex-col items-center"
              >
                <label className="block text-sm font-medium text-white/70 uppercase tracking-widest mb-6 text-center">{t.interestsLabel}</label>
                <div className="flex flex-wrap gap-3 justify-center">
                  {[
                    { id: 'Comida', icon: <Utensils size={16} className="mr-2 opacity-70" /> },
                    { id: 'Vistas', icon: <MapPin size={16} className="mr-2 opacity-70" /> },
                    { id: 'Compras', icon: <ShoppingBag size={16} className="mr-2 opacity-70" /> },
                    { id: 'Historia', icon: <Landmark size={16} className="mr-2 opacity-70" /> },
                    { id: 'Playa', icon: <Palmtree size={16} className="mr-2 opacity-70" /> }
                  ].map((interest, idx) => (
                    <motion.button 
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: idx * 0.3 }}
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      className={`flex items-center px-5 py-3 rounded-full font-medium transition-colors ${
                        config.interests.includes(interest.id) 
                          ? 'bg-white text-black shadow-md' 
                          : 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                      }`}
                    >
                      {interest.icon} {t.interests[interest.id]}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

            </div>

            <div className="mt-auto mb-4 flex flex-col gap-2">
              <button 
                onClick={startChat}
                className="w-full flex items-center justify-center py-4 px-6 bg-white hover:bg-gray-200 active:scale-[0.98] text-black font-semibold rounded-full transition-all shadow-lg group"
              >
                {t.startBtn}
              </button>
              <button 
                onClick={startChat}
                className="w-full flex items-center justify-center py-4 px-6 bg-transparent hover:bg-white/5 active:scale-[0.98] text-white/60 hover:text-white font-medium rounded-full transition-all"
              >
                {t.skipBtn}
              </button>
            </div>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-[100dvh] bg-black font-sans text-white"
      >
      <header className="flex items-center justify-between p-4 bg-[#1C1C1E]/80 backdrop-blur-md border-b border-white/10 shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black font-bold">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Asistente Vigo</h1>
        </div>
        <button 
          onClick={() => setStep('config')} 
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
            <div 
              className={`max-w-[85%] rounded-[20px] px-5 py-3.5 shadow-sm leading-relaxed ${
                msg.isBot 
                  ? 'bg-[#1C1C1E] text-[#EBEBF5] border border-white/5 rounded-tl-sm' 
                  : 'bg-[#0A84FF] text-white rounded-tr-sm shadow-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1C1C1E] text-white/50 px-5 py-4 rounded-[20px] border border-white/5 rounded-tl-sm shadow-sm flex space-x-2 items-center">
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-white/50 rounded-full"></motion.div>
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-white/50 rounded-full"></motion.div>
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-white/50 rounded-full"></motion.div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-[#1C1C1E]/80 backdrop-blur-md border-t border-white/10">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-4xl mx-auto relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..." 
            className="flex-1 pl-5 pr-14 py-4 bg-black border border-white/10 rounded-full focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all text-white shadow-inner-sm placeholder:text-white/40"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-white text-black rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-md active:scale-95"
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </form>
      </footer>
    </motion.div>
    );
  };

  return (
    <>
      {renderContent()}
      <Link 
        to="/admin" 
        className="fixed bottom-6 right-6 p-3 text-white/30 hover:text-white bg-white/10 hover:bg-white/20 rounded-full shadow-lg backdrop-blur-xl transition-all z-50 border border-white/10"
        title="Admin Panel"
      >
        <Shield size={20} />
      </Link>
    </>
  );
}
