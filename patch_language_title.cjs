const fs = require('fs');
let code = fs.readFileSync('src/pages/Chat.tsx', 'utf-8');

// 1. Add state for language title index
code = code.replace(
  "const [greetingIndex, setGreetingIndex] = useState(0);",
  "const [greetingIndex, setGreetingIndex] = useState(0);\n  const [langTitleIndex, setLangTitleIndex] = useState(0);"
);

// 2. Add useEffect for language title cycle
const useEffectStr = `  useEffect(() => {
    if (step === 'welcome') {
      const interval = setInterval(() => {
        setGreetingIndex((prev) => (prev + 1) % greetings.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [step]);`;

const newUseEffectStr = `  useEffect(() => {
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
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [step]);`;

code = code.replace(useEffectStr, newUseEffectStr);

// 3. Update the language step render
const oldLanguageStepStart = `    if (step === 'language') {
      // Usamos el título del idioma actual (español por defecto hasta que seleccione uno)
      const t = translations[config.language] || translations['Español'];
      return (
        <motion.div`;

const oldLanguageStepFull = `    if (step === 'language') {
      // Usamos el título del idioma actual (español por defecto hasta que seleccione uno)
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
              {t.languageTitle}
            </motion.h2>
            
            <div className="space-y-3">
              {Object.keys(translations).map((lang, idx) => (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + (idx * 0.05), duration: 0.6 }}
                  key={lang}
                  onClick={() => {
                    setConfig({...config, language: lang});
                    setStep('userType');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-all text-lg font-medium text-center shadow-lg"
                >
                  {lang}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }`;

const newLanguageStepFull = `    if (step === 'language') {
      const languages = Object.keys(translations);
      const currentTitle = translations[languages[langTitleIndex]].languageTitle;
      
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-black flex flex-col p-6 font-sans text-white items-center justify-center"
        >
          <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
            <div className="h-16 flex items-center justify-center mb-8">
              <AnimatePresence mode="wait">
                <motion.h2 
                  key={currentTitle}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="text-2xl font-light tracking-tight text-center text-white/80"
                >
                  {currentTitle}
                </motion.h2>
              </AnimatePresence>
            </div>
            
            <div className="space-y-3">
              {languages.map((lang, idx) => (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + (idx * 0.05), duration: 0.6 }}
                  key={lang}
                  onClick={() => {
                    setConfig({...config, language: lang});
                    setStep('userType');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-all text-lg font-medium text-center shadow-lg"
                >
                  {lang}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }`;

if (code.includes(oldLanguageStepStart)) {
  code = code.replace(oldLanguageStepFull, newLanguageStepFull);
  fs.writeFileSync('src/pages/Chat.tsx', code);
  console.log('Language step updated');
} else {
  console.log('Could not find language step');
}
