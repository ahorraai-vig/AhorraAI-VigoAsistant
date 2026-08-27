const fs = require('fs');
let code = fs.readFileSync('src/pages/Chat.tsx', 'utf-8');

// Update step state
code = code.replace(
  "const [step, setStep] = useState<'welcome' | 'language' | 'config' | 'chat'>('welcome');",
  "const [step, setStep] = useState<'welcome' | 'language' | 'userType' | 'config' | 'chat'>('welcome');"
);

// Update language click handler
code = code.replace(
  "setConfig({...config, language: lang});\n                    setStep('config');",
  "setConfig({...config, language: lang});\n                    setStep('userType');"
);

const newConfigRender = `
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
            
            <div className="space-y-6 flex flex-col items-center">
              <motion.button
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                onClick={() => {
                  setConfig({...config, userType: 'tourist'});
                  setStep('config');
                }}
                className="w-48 h-48 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-colors flex items-center justify-center text-xl font-medium shadow-lg border border-white/5"
              >
                {t.userTypeTourist}
              </motion.button>
              
              <motion.button
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
                onClick={() => {
                  setConfig({...config, userType: 'local'});
                  setStep('config');
                }}
                className="w-48 h-48 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] active:scale-[0.98] transition-colors flex items-center justify-center text-xl font-medium shadow-lg border border-white/5"
              >
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
                        className={\`w-[85%] py-4 rounded-full text-center font-medium transition-colors \${
                          config.timeAvailable === time 
                            ? 'bg-white text-black shadow-md' 
                            : 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                        }\`}
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
                      className={\`flex items-center px-5 py-3 rounded-full font-medium transition-colors \${
                        config.interests.includes(interest.id) 
                          ? 'bg-white text-black shadow-md' 
                          : 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                      }\`}
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
`;

// Replace old config render with userType and new config render
const oldConfigRenderStart = `    if (step === 'config') {
      const t = translations[config.language] || translations['Español'];
      
      return (
        <motion.div `;
        
const indexStart = code.indexOf(oldConfigRenderStart);
const returnEndIndex = code.indexOf(`    return (
      <motion.div 
        initial={{ opacity: 0 }}`);

if (indexStart !== -1 && returnEndIndex !== -1) {
  code = code.substring(0, indexStart) + newConfigRender + code.substring(returnEndIndex);
  fs.writeFileSync('src/pages/Chat.tsx', code);
  console.log('Patched successfully');
} else {
  console.log('Failed to find replacement points');
}
