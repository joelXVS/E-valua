// config.js - Configuración global
const SYSTEM_CONFIG = {
  // URL de tu App Script desplegado como Web App
  DRIVE_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbx0pByISivzqJSFtBBkbfLWL4QnAzwa8Is4qNYFIAm0MHMLlN5t_2ZBpqt2MXs3mWsx/exec',
  
  // Archivos de base de datos en Google Drive
  DATABASE_FILES: {
    TESTS: 'tests.json',
    GRADES: 'grades.json',
    TEACHERS: 'teachers.json',
    RESULTS: 'results.json',
    CONFIG: 'config.json'
  },
  
  // Configuración del sistema
  APP_NAME: 'E-valua',
  VERSION: '2.0',
  MAINTENANCE: false
};

// Hacer disponible globalmente
window.SYSTEM_CONFIG = SYSTEM_CONFIG;