// utils/drive-api.js - Versión Mejorada
class DriveAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cache = new Map();
    this.queue = [];
    this.processing = false;
  }

  // Método principal para todas las peticiones
  async request(action, data = {}) {
    try {
      const url = `${this.baseUrl}?action=${action}`;
      
      console.log(`🚀 Drive API [${action}]:`, data.filename || '');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error(`❌ Drive API Error [${action}]:`, result.error);
        throw new Error(result.error || 'Error desconocido');
      }
      
      console.log(`✅ Drive API Success [${action}]`);
      return result;
      
    } catch (error) {
      console.error(`💥 Drive API Failed [${action}]:`, error);
      
      // Reintento automático para errores de red
      if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        console.log('🔄 Reintentando...');
        await this.delay(1000);
        return this.request(action, data);
      }
      
      throw error;
    }
  }

  // CRUD Mejorado
  
  // CREATE - Crear nuevo registro
  async create(filename, newData) {
    // Primero leer datos existentes
    const existing = await this.read(filename);
    const dataKey = Object.keys(existing).find(k => Array.isArray(existing[k]));
    
    if (dataKey) {
      existing[dataKey].push(newData);
      return this.update(filename, existing);
    }
    
    return this.update(filename, { data: [newData] });
  }

  // READ - Leer archivo (con cache)
  async read(filename) {
    const cacheKey = `read_${filename}`;
    const cacheTime = 30000; // 30 segundos
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTime) {
        return cached.data;
      }
    }
    
    const result = await this.request('read', { filename });
    
    if (result.data) {
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now()
      });
      
      // Limpiar cache después de 30 segundos
      setTimeout(() => this.cache.delete(cacheKey), cacheTime);
    }
    
    return result.data || {};
  }

  // UPDATE - Actualizar archivo completo
  async update(filename, data) {
    const result = await this.request('write', { filename, data });
    
    // Invalidar cache
    this.cache.delete(`read_${filename}`);
    
    // Notificación
    if (typeof showSnackbar === 'function') {
      showSnackbar(`${filename} actualizado en Drive`, { type: 'success' });
    }
    
    return result;
  }

  // DELETE - Eliminar registro específico
  async delete(filename, key, value) {
    const result = await this.request('delete', { filename, key, value });
    
    // Invalidar cache
    this.cache.delete(`read_${filename}`);
    
    return result;
  }

  // LIST - Listar archivos disponibles
  async list() {
    const result = await this.request('list');
    return result.data || [];
  }

  // STATS - Obtener estadísticas
  async stats() {
    const result = await this.request('stats');
    return result.stats || {};
  }

  // BACKUP - Crear copia de seguridad
  async backup(filename) {
    const data = await this.read(filename);
    const backupName = `backup_${new Date().toISOString().split('T')[0]}_${filename}`;
    
    return this.update(backupName, data);
  }

  // TEST - Probar conexión
  async testConnection() {
    try {
      const result = await this.request('test');
      return result.success === true;
    } catch {
      return false;
    }
  }

  // SYNC - Sincronizar datos locales con Drive
  async sync(filename, localData) {
    console.log(`🔄 Sincronizando ${filename}...`);
    
    try {
      const driveData = await this.read(filename);
      
      // Comparar y fusionar
      const merged = this.mergeData(driveData, localData);
      
      // Solo actualizar si hay cambios
      if (JSON.stringify(driveData) !== JSON.stringify(merged)) {
        await this.update(filename, merged);
        console.log(`✅ ${filename} sincronizado`);
        return { synced: true, changes: true };
      }
      
      console.log(`✅ ${filename} ya está actualizado`);
      return { synced: true, changes: false };
      
    } catch (error) {
      console.error(`❌ Error sincronizando ${filename}:`, error);
      return { synced: false, error };
    }
  }

  // Merge inteligente de datos
  mergeData(driveData, localData) {
    // Lógica de fusión según el tipo de archivo
    if (Array.isArray(driveData.results) && Array.isArray(localData.results)) {
      // Para resultados: agregar nuevos sin duplicados
      const driveCodes = new Set(driveData.results.map(r => r.resultCode));
      const newResults = localData.results.filter(r => !driveCodes.has(r.resultCode));
      
      return {
        ...driveData,
        results: [...driveData.results, ...newResults],
        lastSync: new Date().toISOString()
      };
    }
    
    // Merge genérico
    return { ...driveData, ...localData, lastSync: new Date().toISOString() };
  }

  // Utilidades
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache limpiado');
  }
}

// Inicialización global
let driveAPI = null;

function initDriveAPI(webAppUrl) {
  if (!driveAPI) {
    driveAPI = new DriveAPI(webAppUrl);
    console.log('🚀 Drive API Inicializada');
  }
  
  window.driveAPI = driveAPI;
  return driveAPI;
}

// Helper para carga con fallback
async function loadWithFallback(filename, fallbackUrl) {
  if (!window.driveAPI) {
    console.warn('Drive API no inicializada, usando datos locales');
    return loadLocalFile(fallbackUrl);
  }
  
  try {
    const data = await window.driveAPI.read(filename);
    console.log(`✅ ${filename} cargado desde Drive`);
    return data;
  } catch (error) {
    console.warn(`❌ No se pudo cargar ${filename} desde Drive:`, error);
    return loadLocalFile(fallbackUrl);
  }
}

async function loadLocalFile(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`❌ Error cargando ${url}:`, error);
    return null;
  }
}

// Exportar globalmente
window.DriveAPI = DriveAPI;
window.initDriveAPI = initDriveAPI;
window.loadWithFallback = loadWithFallback;