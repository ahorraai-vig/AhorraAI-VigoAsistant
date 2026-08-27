const fs = require('fs');
let code = fs.readFileSync('src/pages/Chat.tsx', 'utf-8');

const oldUserTypeButtons = `<div className="space-y-6 flex flex-col items-center">
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
            </div>`;

const newUserTypeButtons = `<div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center justify-center">
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
            </div>`;

if (code.includes(oldUserTypeButtons)) {
  code = code.replace(oldUserTypeButtons, newUserTypeButtons);
  fs.writeFileSync('src/pages/Chat.tsx', code);
  console.log('UserType buttons updated');
} else {
  console.log('Could not find old userType buttons');
}
