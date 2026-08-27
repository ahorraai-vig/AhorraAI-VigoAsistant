const fs = require('fs');
let code = fs.readFileSync('src/pages/Chat.tsx', 'utf-8');

code = code.replace(/subtitle: 'Tu guía local',/g, "subtitle: 'Tu guía local',\n    userTypeTitle: '¿Quién eres?',\n    userTypeTourist: 'Visita',\n    userTypeLocal: 'Soy de aquí',");
code = code.replace(/subtitle: 'A túa guía local',/g, "subtitle: 'A túa guía local',\n    userTypeTitle: 'Quen es?',\n    userTypeTourist: 'Visita',\n    userTypeLocal: 'Son de aquí',");
code = code.replace(/subtitle: 'Your local guide',/g, "subtitle: 'Your local guide',\n    userTypeTitle: 'Who are you?',\n    userTypeTourist: 'Tourist',\n    userTypeLocal: 'Local',");
code = code.replace(/subtitle: 'Dein Reiseführer',/g, "subtitle: 'Dein Reiseführer',\n    userTypeTitle: 'Wer bist du?',\n    userTypeTourist: 'Besucher',\n    userTypeLocal: 'Einheimischer',");
code = code.replace(/subtitle: 'Votre guide local',/g, "subtitle: 'Votre guide local',\n    userTypeTitle: 'Qui êtes-vous ?',\n    userTypeTourist: 'Visiteur',\n    userTypeLocal: 'Local',");
code = code.replace(/subtitle: 'Seu guia local',/g, "subtitle: 'Seu guia local',\n    userTypeTitle: 'Quem é você?',\n    userTypeTourist: 'Visitante',\n    userTypeLocal: 'Local',");
code = code.replace(/subtitle: 'La tua guida locale',/g, "subtitle: 'La tua guida locale',\n    userTypeTitle: 'Chi sei?',\n    userTypeTourist: 'Visitatore',\n    userTypeLocal: 'Locale',");

fs.writeFileSync('src/pages/Chat.tsx', code);
