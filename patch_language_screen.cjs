const fs = require('fs');
let code = fs.readFileSync('src/pages/Chat.tsx', 'utf-8');

const oldLanguageStepFull = `    if (step === 'language') {
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

const newLanguageStepFull = `    if (step === 'language') {
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
    }`;

if (code.includes(oldLanguageStepStart = `    if (step === 'language') {
      const languages = Object.keys(translations);
      const currentTitle = translations[languages[langTitleIndex]].languageTitle;`)) {
  const startIdx = code.indexOf(oldLanguageStepStart);
  const endIdx = code.indexOf(`    if (step === 'userType') {`);
  if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + newLanguageStepFull + "\n" + code.substring(endIdx);
    fs.writeFileSync('src/pages/Chat.tsx', code);
    console.log('Language screen updated successfully.');
  } else {
    console.log('Could not find boundaries.');
  }
} else {
  console.log('Could not find old language step.');
}
