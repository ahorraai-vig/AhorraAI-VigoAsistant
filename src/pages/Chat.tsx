import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, MapPin, Utensils, ShoppingBag, Palmtree, Landmark, Settings, Shield, Store, MessageSquare, ExternalLink, Handshake, Key, Plus, ChevronLeft, ChevronRight, Mic, MicOff, Camera, Paperclip, X, Ear, EarOff } from 'lucide-react';
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
    userTypeBusiness: 'Soy un negocio',
    businessModalTitle: 'Comercio Local de Vigo',
    businessModalDesc: 'Únete al ecosistema colaborativo de Vigo, optimiza tus horas valle y cruza datos con otros comercios para generar sinergias.',
    businessGraphBtn: 'Grafo de Comercio Colaborativo',
    businessOnboardingBtn: 'Registrar Ficha & Oportunidades',
    businessChatBtn: 'Continuar como negocio',
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
    userTypeBusiness: 'Son un negocio',
    businessModalTitle: 'Comercio Local de Vigo',
    businessModalDesc: 'Únete á rede colaborativa de Vigo, optimiza as túas horas val e cruza datos con outros comercios para crear sinerxías.',
    businessGraphBtn: 'Grafo de Comercio Colaborativo',
    businessOnboardingBtn: 'Rexistrar Ficha & Oportunidades',
    businessChatBtn: 'Continuar como negocio',
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
    userTypeBusiness: 'I am a business',
    businessModalTitle: 'Local Vigo Business',
    businessModalDesc: 'Join the Vigo collaborative network, optimize your off-peak hours and discover business synergies with AI.',
    businessGraphBtn: 'Collaborative Commerce Graph',
    businessOnboardingBtn: 'Register Business Profile & Synergies',
    businessChatBtn: 'Continue as business',
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
    userTypeBusiness: 'Ich bin ein Geschäft',
    businessModalTitle: 'Lokales Unternehmen in Vigo',
    businessModalDesc: 'Verwalte dein Unternehmen im genossenschaftlichen Netzwerk.',
    businessLoginBtn: 'Zum Unternehmensbereich',
    businessChatBtn: 'Als Geschäft fortfahren',
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
    userTypeBusiness: 'Je suis un commerce',
    businessModalTitle: 'Commerce Local de Vigo',
    businessModalDesc: 'Gérez la présence de votre établissement dans le réseau coopératif.',
    businessLoginBtn: 'Accéder à l\'espace Pro',
    businessChatBtn: 'Continuer en tant que commerce',
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
    userTypeBusiness: 'Sou um negócio',
    businessModalTitle: 'Comércio Local de Vigo',
    businessModalDesc: 'Gerencie a presença do seu negócio na rede cooperativa local.',
    businessLoginBtn: 'Acessar Painel de Negócios',
    businessChatBtn: 'Continuar como negócio',
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
    userTypeBusiness: 'Sono un\'attività',
    businessModalTitle: 'Attività Locale di Vigo',
    businessModalDesc: 'Gestisci la tua presenza nella rete cooperativa o consulta sinergie.',
    businessLoginBtn: 'Area Commercianti',
    businessChatBtn: 'Continua come attività',
    timeLabel: 'Tempo a disposizione',
    times: {
      'Pocas horas': 'Poche ore',
      'Medio día': 'Mezza giornata',
      'Día completo': 'Giornata intera'
    },
    interestsLabel: 'I tuoi intereses',
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
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [telegramInfo, setTelegramInfo] = useState<{ configured: boolean; username: string | null; url: string | null }>({
    configured: false,
    username: null,
    url: null
  });

  const [config, setConfig] = useState<ChatConfig>({
    timeAvailable: '',
    interests: [],
    language: 'Español'
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/telegram/info')
      .then(res => res.json())
      .then(data => {
        if (data && (data.configured || data.url)) {
          setTelegramInfo(data);
        }
      })
      .catch(err => console.error("Error fetching telegram info:", err));
  }, []);

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

  const handlePrevLang = () => {
    const languages = Object.keys(translations);
    setLangTitleIndex((prev) => (prev - 1 + languages.length) % languages.length);
  };

  const handleNextLang = () => {
    const languages = Object.keys(translations);
    setLangTitleIndex((prev) => (prev + 1) % languages.length);
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setInput(transcript);
    };
    
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const speakText = (text: string) => {
    if (!accessibilityMode || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !attachedImage) || loading) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), text: input, isBot: false, image: attachedImage || undefined };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setAttachedImage(null);
    setLoading(true);

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

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

      const botMessage: ChatMessage = { 
        id: Date.now().toString(), 
        text: data.text, 
        isBot: true,
        sourcesUsed: data.sourcesUsed,
        debugTrace: data.debugTrace
      };

      setMessages(prev => [...prev, botMessage]);
      speakText(data.text);
    } catch (err: any) {
      console.error(err);
      const errorMessage: ChatMessage = { 
        id: Date.now().toString(), 
        text: "Lo siento, ha ocurrido un error al conectar con el asistente. Inténtalo de nuevo en unos segundos.", 
        isBot: true 
      };
      setMessages(prev => [...prev, errorMessage]);
      speakText(errorMessage.text);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleOpenTelegram = () => {
    const tgUrl = telegramInfo.url || (telegramInfo.username ? `https://t.me/${telegramInfo.username}` : 'https://t.me');
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  const renderContent = () => {
    if (step === 'welcome') {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="min-h-screen bg-vigo-ria text-white flex flex-col items-center justify-center p-6 relative cursor-pointer selection:bg-transparent"
          onClick={() => setStep('language')}
        >
          
          <div className="flex-1 flex items-center justify-center w-full z-10">
            <AnimatePresence mode="wait">
              <motion.h1
                key={greetingIndex}
                initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0, filter: 'blur(10px)', y: -20 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="text-5xl md:text-7xl font-light tracking-tight text-center" style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
              >
                {greetings[greetingIndex].text}
              </motion.h1>
            </AnimatePresence>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="pb-12 flex flex-col items-center gap-3 z-10"
          >
            <motion.p 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="text-xs font-semibold tracking-[0.2em] uppercase text-white/70"
            >
              Toca para continuar
            </motion.p>
          </motion.div>
        </motion.div>
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
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="min-h-screen bg-vigo-sireno flex flex-col p-6 font-sans text-white items-center justify-center relative select-none"
        >
          <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentLang}
                initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center w-full"
              >
                <h2 className="text-2xl md:text-3xl font-light tracking-tight text-center mb-12 text-white">
                  {currentTitle}
                </h2>
                
                {/* Selector de idioma con flechas laterales de navegación */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 w-full">
                  <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevLang();
                    }}
                    aria-label="Idioma anterior"
                    className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors shadow-lg cursor-pointer"
                  >
                    <ChevronLeft size={24} className="stroke-[2.2]" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)", boxShadow: "0 10px 30px -10px rgba(255,255,255,0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => {
                      setConfig({...config, language: currentLang});
                      setStep('userType');
                    }}
                    className="flex-1 py-4 sm:py-5 px-6 rounded-3xl bg-black/40 backdrop-blur-md text-xl font-medium text-center shadow-lg border border-white/10 text-white tracking-wide cursor-pointer transition-colors"
                  >
                    {currentLang}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextLang();
                    }}
                    aria-label="Idioma siguiente"
                    className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors shadow-lg cursor-pointer"
                  >
                    <ChevronRight size={24} className="stroke-[2.2]" />
                  </motion.button>
                </div>
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="min-h-screen bg-vigo-caballos flex flex-col p-6 font-sans text-white items-center justify-center relative"
        >
          <div className="w-full max-w-[1400px] flex-1 flex flex-col justify-center items-center z-10 relative">
            {/* 3 Burbujas orgánicas: Turista, Local, Soy un negocio */}
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
              }}
              className="flex justify-between items-center w-full px-4 sm:px-12 md:px-32 lg:px-48 mb-[10vh] md:mb-[15vh]"
            >
              <motion.button
                variants={{
                  hidden: { opacity: 0, x: -50 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                }}
                whileHover={{ y: -5, scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setConfig({...config, userType: 'tourist'});
                  setStep('config');
                }}
                className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[40px] bg-black/40 backdrop-blur-xl border border-white/10 transition-colors flex flex-col items-center justify-center text-sm sm:text-base md:text-lg font-medium shadow-lg"
              >
                <Palmtree size={28} strokeWidth={1.5} className="mb-2 md:mb-3 text-emerald-400 opacity-90 sm:w-8 sm:h-8" />
                <span className="text-white/90">{t.userTypeTourist}</span>
              </motion.button>
              
              <motion.button
                variants={{
                  hidden: { opacity: 0, x: 50 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                }}
                whileHover={{ y: -5, scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setConfig({...config, userType: 'local'});
                  setStep('config');
                }}
                className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[40px] bg-black/40 backdrop-blur-xl border border-white/10 transition-colors flex flex-col items-center justify-center text-sm sm:text-base md:text-lg font-medium shadow-lg"
              >
                <MapPin size={28} strokeWidth={1.5} className="mb-2 md:mb-3 text-blue-400 opacity-90 sm:w-8 sm:h-8" />
                <span className="text-white/90">{t.userTypeLocal}</span>
              </motion.button>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] } }
              }}
              className="absolute bottom-8 sm:bottom-12 md:bottom-16 left-0 right-0 flex justify-center w-full"
            >
              <motion.button
                whileHover={{ y: -5, scale: 1.05, backgroundColor: "rgba(255,255,255,0.15)", boxShadow: "0 20px 40px -10px rgba(245, 158, 11, 0.15)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowBusinessModal(true);
                }}
                className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[40px] bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-xl border border-amber-500/30 transition-all flex flex-col items-center justify-center text-center p-2 text-sm sm:text-base md:text-lg font-medium shadow-lg relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                <Store size={28} strokeWidth={1.5} className="mb-2 md:mb-3 text-amber-400 opacity-90 sm:w-8 sm:h-8" />
                <span className="leading-tight px-2 text-white/90">{t.userTypeBusiness}</span>
              </motion.button>
            </motion.div>
          </div>

          {/* Modal / Dialog para Comercios */}
          <AnimatePresence>
            {showBusinessModal && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setShowBusinessModal(false)}
              >
                <motion.div 
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  className="bg-[#1C1C1E] border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                    <Store size={32} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2">{t.businessModalTitle}</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">{t.businessModalDesc}</p>
                  
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/cooperacion"
                      className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg text-sm"
                    >
                      <Handshake size={18} className="text-amber-300" />
                      <span>{t.businessGraphBtn || 'Grafo de Comercio Colaborativo'}</span>
                    </Link>

                    <Link
                      to="/alta-negocio"
                      className="w-full py-3.5 px-6 bg-white hover:bg-gray-100 text-black font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md text-sm"
                    >
                      <Plus size={18} className="text-emerald-600" />
                      <span>{t.businessOnboardingBtn || 'Registrar Ficha de Negocio & Sinergias'}</span>
                    </Link>

                    <button
                      onClick={() => {
                        setShowBusinessModal(false);
                        setConfig({...config, userType: 'business'});
                        setStep('config');
                      }}
                      className="w-full py-2.5 px-4 text-xs text-white/50 hover:text-white transition-colors text-center"
                    >
                      {t.businessChatDirectBtn || 'O continuar al chat como negocio'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      );
    }

    if (step === 'config') {
      const t = translations[config.language] || translations['Español'];
      
      const isReady = (config.userType === 'tourist' ? config.timeAvailable !== '' : true) && config.interests.length > 0;
      
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="min-h-screen bg-vigo-rande flex flex-col p-4 md:p-8 font-sans text-white relative"
        >
          <div className="w-full max-w-[1800px] mx-auto flex-1 flex flex-col z-10 relative">
            
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mt-8 mb-10"
            >
              <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white mb-2">{t.title}</h1>
              <p className="text-white/60 text-sm md:text-base font-medium">{t.subtitle}</p>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } }
              }}
              className={`flex-1 w-full flex flex-col md:flex-row items-center px-2 sm:px-4 md:px-12 lg:px-20 mb-[5vh] space-y-6 md:space-y-0 ${config.userType === 'tourist' ? 'md:justify-between' : 'md:justify-center'}`}
            >
              
              {config.userType === 'tourist' && (
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: -50 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                  }}
                  className="bg-black/40 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-2xl w-full max-w-sm border border-white/10 flex flex-col items-center"
                >
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-[0.2em] mb-6 text-center">{t.timeLabel}</label>
                  <div className="flex flex-col gap-3 w-full items-center">
                    {['Pocas horas', 'Medio día', 'Día completo'].map((time) => {
                      const isSelected = config.timeAvailable === time;
                      return (
                        <motion.button 
                          key={time}
                          whileHover={{ scale: 1.02, backgroundColor: isSelected ? "#ffffff" : "rgba(255,255,255,0.1)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setConfig({...config, timeAvailable: time})}
                          className={`w-[90%] py-3.5 rounded-2xl text-center font-medium transition-all duration-300 ${
                            isSelected
                              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] border border-transparent' 
                              : 'bg-transparent text-white/80 border border-white/10 hover:text-white'
                          }`}
                        >
                          {t.times[time]}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              <motion.div 
                variants={{
                  hidden: { opacity: 0, x: config.userType === 'tourist' ? 50 : 0, y: config.userType === 'tourist' ? 0 : 20 },
                  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                }}
                className="bg-black/40 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-2xl w-full max-w-sm border border-white/10 flex flex-col items-center"
              >
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-[0.2em] mb-6 text-center">{t.interestsLabel}</label>
                <div className="flex flex-wrap gap-2.5 justify-center">
                  {[
                    { id: 'Comida', icon: <Utensils size={14} className="mr-2" /> },
                    { id: 'Vistas', icon: <MapPin size={14} className="mr-2" /> },
                    { id: 'Compras', icon: <ShoppingBag size={14} className="mr-2" /> },
                    { id: 'Historia', icon: <Landmark size={14} className="mr-2" /> },
                    { id: 'Playa', icon: <Palmtree size={14} className="mr-2" /> }
                  ].map((interest) => {
                    const isSelected = config.interests.includes(interest.id);
                    return (
                      <motion.button 
                        key={interest.id}
                        whileHover={{ scale: 1.05, backgroundColor: isSelected ? "#ffffff" : "rgba(255,255,255,0.1)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleInterest(interest.id)}
                        className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                          isSelected 
                            ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)] border border-transparent' 
                            : 'bg-transparent text-white/70 border border-white/10 hover:text-white'
                        }`}
                      >
                        <span className={isSelected ? "opacity-100" : "opacity-70"}>{interest.icon}</span> 
                        {t.interests[interest.id]}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-auto mb-6 flex flex-col gap-3 items-center w-full max-w-sm mx-auto"
            >
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={isReady ? { 
                  boxShadow: ["0px 0px 0px rgba(255,255,255,0)", "0px 0px 20px rgba(255,255,255,0.4)", "0px 0px 0px rgba(255,255,255,0)"] 
                } : {}}
                transition={{ repeat: isReady ? Infinity : 0, duration: 2 }}
                onClick={startChat}
                className={`w-[90%] flex items-center justify-center py-4 px-6 font-semibold rounded-2xl transition-all duration-500 ${
                  isReady 
                    ? 'bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_8px_40px_rgba(255,255,255,0.4)]' 
                    : 'bg-white/10 text-white/40 backdrop-blur-md border border-white/5'
                }`}
              >
                {t.startBtn}
              </motion.button>
              
              <button 
                onClick={startChat}
                className="w-[90%] flex items-center justify-center py-3 px-6 text-sm text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
              >
                {t.skipBtn}
              </button>
            </motion.div>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-[100dvh] bg-grunge font-sans text-white"
      >
      <header className="flex items-center justify-between p-3.5 md:p-4 bg-[#1C1C1E]/90 backdrop-blur-md border-b border-white/10 shadow-sm sticky top-0 z-30">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black font-bold shadow-sm">
            V
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold tracking-tight text-white leading-tight">Asistente Vigo</h1>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> En línea
            </span>
          </div>
        </div>

        {/* Barra de Acciones Superior Derecha */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => setAccessibilityMode(!accessibilityMode)}
            className={`p-2 rounded-full transition-colors ${accessibilityMode ? 'bg-amber-500/20 text-amber-400' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            title={accessibilityMode ? "Desactivar modo voz" : "Activar modo voz (Accesibilidad)"}
          >
            {accessibilityMode ? <Ear size={18} /> : <EarOff size={18} />}
          </button>

          {/* Botón de Acceso a Telegram */}
          <button
            onClick={handleOpenTelegram}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-full transition-all active:scale-95 shadow-sm"
            title="Abrir bot en Telegram"
          >
            <Send size={13} className="-rotate-12" />
            <span className="hidden sm:inline">Telegram</span>
          </button>

          {/* Botón Ajustes */}
          <button 
            onClick={() => setStep('config')} 
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Ajustes y Preferencias"
          >
            <Settings size={18} />
          </button>

          {/* Botón Admin Panel en la esquina superior derecha */}
          <Link 
            to="/admin" 
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Panel de Administración"
          >
            <Shield size={18} />
          </Link>
        </div>
      </header>

      {accessibilityMode && (
        <div 
          onClick={() => {
            if (isRecording) {
              toggleRecording();
              // In a real app we'd wait for state to settle, but for now we trust the user will hit send or we could auto-send.
              // To auto-send, we can call a form submission or a separate handler.
              // We'll leave it as push-to-talk for now and let the footer button be used, or they can tap again.
            } else {
              toggleRecording();
            }
          }}
          className={`absolute inset-0 z-40 flex flex-col items-center justify-center cursor-pointer transition-colors ${isRecording ? 'bg-red-500/95' : 'bg-[#1C1C1E]/95 backdrop-blur-xl'}`}
          style={{ top: '64px' /* header height */ }}
        >
          {isRecording ? (
            <>
              <Mic size={100} className="text-white animate-pulse mb-8" />
              <p className="text-white text-4xl font-bold text-center px-6">Escuchando...</p>
              <p className="text-white/80 text-2xl text-center px-6 mt-6">Toca para detener y preparar tu mensaje</p>
            </>
          ) : (
            <>
              <Ear size={100} className="text-amber-400 mb-8" />
              <p className="text-white text-4xl font-bold text-center px-6">Modo Voz Activado</p>
              <p className="text-white/80 text-2xl text-center px-6 mt-6">
                Toca cualquier parte de esta pantalla para dictar tu mensaje.
                <br/><br/>
                La pantalla leerá en voz alta las respuestas.
              </p>
              
              <button 
                onClick={(e) => { e.stopPropagation(); setAccessibilityMode(false); }}
                className="mt-16 px-8 py-4 bg-white/10 rounded-full text-white font-semibold hover:bg-white/20 active:scale-95 transition-all text-xl"
              >
                Cerrar modo voz
              </button>
            </>
          )}
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => {
          const sourceBadgeMap: Record<string, string> = {
            'supabase_business_db': '🏪 Comercios Locales (AhorraAI)',
            'vigo_official_weather': '⛅ Previsión Meteorológica',
            'vigo_realtime_parking': '🅿️ Sensores Parking (Concello)',
            'vigo_realtime_traffic': '🚦 Tráfico y Avisos (Concello)',
            'vigo_events_agenda': '🏛️ Agenda Cultural Oficial',
            'vigo_historical_memory': '📜 Memoria Histórica',
            'vigo_verified_context': '🗺️ Geografía y Patrimonio',
            'external_serpapi': '🌐 Google Maps / Web'
          };

          return (
            <div key={msg.id} className={`flex flex-col ${msg.isBot ? 'items-start' : 'items-end'}`}>
              <div 
                className={`max-w-[85%] rounded-[20px] px-5 py-3.5 shadow-sm leading-relaxed ${
                  msg.isBot 
                    ? 'bg-[#1C1C1E] text-[#EBEBF5] border border-white/5 rounded-tl-sm' 
                    : 'bg-[#0A84FF] text-white rounded-tr-sm shadow-md'
                }`}
              >
                {msg.image && (
                  <img src={msg.image} alt="Attachment" className="max-w-full h-auto rounded-lg mb-2" />
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>

              {/* Badges de Fuentes Verificadas */}
              {msg.isBot && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-1 max-w-[85%]">
                  {msg.sourcesUsed.map((srcKey) => (
                    <span 
                      key={srcKey}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-white/70 border border-white/10"
                    >
                      {sourceBadgeMap[srcKey] || srcKey}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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

      <footer className="p-3 md:p-4 bg-[#1C1C1E]/80 backdrop-blur-md border-t border-white/10 flex flex-col gap-2">
        {attachedImage && (
          <div className="max-w-4xl mx-auto w-full flex">
            <div className="relative inline-block">
              <img src={attachedImage} alt="Attachment" className="h-20 w-20 object-cover rounded-xl border border-white/20" />
              <button 
                type="button"
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex gap-1.5 md:gap-2 max-w-4xl mx-auto relative w-full items-center">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            aria-hidden="true"
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Adjuntar imagen o tomar foto"
            aria-label="Adjuntar imagen o tomar foto"
          >
            <Camera size={20} />
          </button>

          <div className="relative flex-1 flex">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..." 
              className="flex-1 pl-4 md:pl-5 pr-[84px] py-3.5 md:py-4 bg-black border border-white/10 rounded-full focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all text-white shadow-inner-sm placeholder:text-white/40 text-sm md:text-base"
              disabled={loading || isRecording}
            />
            
            <div className="absolute right-1.5 top-1.5 bottom-1.5 flex gap-1">
              <button 
                type="button"
                onClick={toggleRecording}
                className={`aspect-square flex items-center justify-center rounded-full transition-all cursor-pointer ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-transparent text-white/60 hover:text-white hover:bg-white/10'}`}
                title={isRecording ? 'Detener grabación' : 'Dictar mensaje'}
                aria-label={isRecording ? 'Detener grabación' : 'Dictar mensaje'}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              
              <button 
                type="submit" 
                disabled={(!input.trim() && !attachedImage) || loading}
                className="aspect-square flex items-center justify-center bg-white text-black rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-md active:scale-95 cursor-pointer"
                aria-label="Enviar mensaje"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </div>
          </div>
        </form>
      </footer>
    </motion.div>
    );
  };

  return (
    <>
      {/* Botones de Cabecera Flotantes para pantallas previas al chat (excepto en la pantalla de bienvenida pura) */}
      {step !== 'chat' && step !== 'welcome' && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={handleOpenTelegram}
            className="p-2.5 text-sky-400 bg-[#1C1C1E]/90 hover:bg-[#2C2C2E] border border-sky-500/30 rounded-full shadow-lg backdrop-blur-xl transition-all active:scale-95"
            title="Abrir bot en Telegram"
          >
            <Send size={18} className="-rotate-12" />
          </button>
          <Link 
            to="/admin" 
            className="p-2.5 text-white/60 hover:text-white bg-[#1C1C1E]/90 hover:bg-[#2C2C2E] rounded-full shadow-lg backdrop-blur-xl transition-all border border-white/10"
            title="Panel de Administración"
          >
            <Shield size={18} />
          </Link>
        </div>
      )}

      {renderContent()}
    </>
  );
}

