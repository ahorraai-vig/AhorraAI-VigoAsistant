const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

code = code.replace(
  "- Tiempo disponible: ${config?.timeAvailable || 'No especificado'}",
  "- Tipo de usuario: ${config?.userType === 'local' ? 'Residente / Local' : 'Turista / Visita'}\\n- Tiempo disponible: ${config?.timeAvailable || 'No especificado'}"
);

fs.writeFileSync('api/index.ts', code);
