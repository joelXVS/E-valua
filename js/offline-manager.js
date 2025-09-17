class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine
    this.syncQueue = []
    this.lastSyncTime = localStorage.getItem("lastSyncTime") || 0
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadSyncQueue()
    this.updateConnectionStatus()
    this.startPeriodicSync()

    // Intentar sincronizar al inicializar si hay conexión
    if (this.isOnline) {
      this.syncData()
    }
  }

  setupEventListeners() {
    // Detectar cambios en la conexión
    window.addEventListener("online", () => {
      this.isOnline = true
      this.updateConnectionStatus()
      this.syncData()
      this.showNotification("Conexión restaurada. Sincronizando datos...", "success")
    })

    window.addEventListener("offline", () => {
      this.isOnline = false
      this.updateConnectionStatus()
      this.showNotification("Sin conexión. Los datos se guardarán localmente.", "warning")
    })

    // Sincronizar antes de cerrar la página
    window.addEventListener("beforeunload", () => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.syncData()
      }
    })
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById("connection-status")
    if (statusElement) {
      statusElement.className = `connection-status ${this.isOnline ? "online" : "offline"}`
      statusElement.innerHTML = `
                <span class="status-indicator"></span>
                <span class="status-text">${this.isOnline ? "En línea" : "Sin conexión"}</span>
            `
    }

    // Actualizar indicadores en toda la aplicación
    document.querySelectorAll(".offline-indicator").forEach((indicator) => {
      indicator.style.display = this.isOnline ? "none" : "block"
    })

    document.querySelectorAll(".online-only").forEach((element) => {
      element.disabled = !this.isOnline
      if (!this.isOnline) {
        element.title = "Función disponible solo con conexión a internet"
      }
    })
  }

  // Agregar operación a la cola de sincronización
  addToSyncQueue(operation) {
    const syncItem = {
      id: this.generateId(),
      timestamp: Date.now(),
      operation: operation.type,
      data: operation.data,
      retries: 0,
      maxRetries: 3,
    }

    this.syncQueue.push(syncItem)
    this.saveSyncQueue()

    // Si estamos en línea, intentar sincronizar inmediatamente
    if (this.isOnline) {
      this.syncData()
    }

    return syncItem.id
  }

  // Guardar cola de sincronización en localStorage
  saveSyncQueue() {
    try {
      localStorage.setItem("syncQueue", JSON.stringify(this.syncQueue))
    } catch (error) {
      console.error("Error saving sync queue:", error)
    }
  }

  // Cargar cola de sincronización desde localStorage
  loadSyncQueue() {
    try {
      const saved = localStorage.getItem("syncQueue")
      this.syncQueue = saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading sync queue:", error)
      this.syncQueue = []
    }
  }

  // Sincronizar datos con el servidor (simulado)
  async syncData() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return
    }

    const itemsToSync = [...this.syncQueue]
    const successfulSyncs = []

    for (const item of itemsToSync) {
      try {
        const success = await this.processSyncItem(item)
        if (success) {
          successfulSyncs.push(item.id)
        } else {
          item.retries++
          if (item.retries >= item.maxRetries) {
            console.error("Max retries reached for sync item:", item)
            successfulSyncs.push(item.id) // Remover después de max intentos
          }
        }
      } catch (error) {
        console.error("Error syncing item:", item, error)
        item.retries++
        if (item.retries >= item.maxRetries) {
          successfulSyncs.push(item.id)
        }
      }
    }

    // Remover elementos sincronizados exitosamente
    this.syncQueue = this.syncQueue.filter((item) => !successfulSyncs.includes(item.id))
    this.saveSyncQueue()

    if (successfulSyncs.length > 0) {
      this.lastSyncTime = Date.now()
      localStorage.setItem("lastSyncTime", this.lastSyncTime.toString())
      this.updateSyncStatus()

      if (successfulSyncs.length === itemsToSync.length) {
        this.showNotification("Datos sincronizados correctamente", "success")
      }
    }
  }

  // Procesar un elemento individual de sincronización
  async processSyncItem(item) {
    // Simular latencia de red
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200))

    switch (item.operation) {
      case "CREATE_TEST":
        return this.syncCreateTest(item.data)
      case "UPDATE_TEST":
        return this.syncUpdateTest(item.data)
      case "DELETE_TEST":
        return this.syncDeleteTest(item.data)
      case "SUBMIT_RESULT":
        return this.syncSubmitResult(item.data)
      case "UPDATE_USER":
        return this.syncUpdateUser(item.data)
      case "CREATE_USER":
        return this.syncCreateUser(item.data)
      default:
        console.warn("Unknown sync operation:", item.operation)
        return true // Marcar como exitoso para remover de la cola
    }
  }

  // Métodos de sincronización específicos
  async syncCreateTest(testData) {
    try {
      // Simular API call
      console.log("[v0] Syncing create test:", testData.title)

      // En una implementación real, aquí haríamos la llamada al servidor
      // const response = await fetch('/api/tests', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(testData)
      // });
      // return response.ok;

      // Simulación: 90% de éxito
      return Math.random() > 0.1
    } catch (error) {
      console.error("Error syncing create test:", error)
      return false
    }
  }

  async syncUpdateTest(testData) {
    try {
      console.log("[v0] Syncing update test:", testData.id)
      return Math.random() > 0.1
    } catch (error) {
      console.error("Error syncing update test:", error)
      return false
    }
  }

  async syncDeleteTest(testData) {
    try {
      console.log("[v0] Syncing delete test:", testData.id)
      return Math.random() > 0.1
    } catch (error) {
      console.error("Error syncing delete test:", error)
      return false
    }
  }

  async syncSubmitResult(resultData) {
    try {
      console.log("[v0] Syncing submit result:", resultData.studentId, resultData.testId)
      return Math.random() > 0.05 // 95% de éxito para resultados
    } catch (error) {
      console.error("Error syncing submit result:", error)
      return false
    }
  }

  async syncUpdateUser(userData) {
    try {
      console.log("[v0] Syncing update user:", userData.id)
      return Math.random() > 0.1
    } catch (error) {
      console.error("Error syncing update user:", error)
      return false
    }
  }

  async syncCreateUser(userData) {
    try {
      console.log("[v0] Syncing create user:", userData.id)
      return Math.random() > 0.1
    } catch (error) {
      console.error("Error syncing create user:", error)
      return false
    }
  }

  // Actualizar estado de sincronización en la UI
  updateSyncStatus() {
    const syncStatusElement = document.getElementById("sync-status")
    if (syncStatusElement) {
      const pendingCount = this.syncQueue.length
      const lastSync = this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString() : "Nunca"

      syncStatusElement.innerHTML = `
                <div class="sync-info">
                    <span class="sync-pending">${pendingCount} elementos pendientes</span>
                    <span class="sync-last">Última sincronización: ${lastSync}</span>
                </div>
            `
    }
  }

  // Iniciar sincronización periódica
  startPeriodicSync() {
    // Sincronizar cada 30 segundos si hay conexión
    setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.syncData()
      }
      this.updateSyncStatus()
    }, 30000)
  }

  // Forzar sincronización manual
  forcSync() {
    if (!this.isOnline) {
      this.showNotification("No hay conexión a internet", "error")
      return
    }

    if (this.syncQueue.length === 0) {
      this.showNotification("No hay datos pendientes para sincronizar", "info")
      return
    }

    this.showNotification("Iniciando sincronización...", "info")
    this.syncData()
  }

  // Mostrar notificaciones
  showNotification(message, type = "info") {
    // Crear elemento de notificación
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `

    // Agregar al contenedor de notificaciones
    let container = document.getElementById("notifications-container")
    if (!container) {
      container = document.createElement("div")
      container.id = "notifications-container"
      container.className = "notifications-container"
      document.body.appendChild(container)
    }

    container.appendChild(notification)

    // Event listener para cerrar
    notification.querySelector(".notification-close").addEventListener("click", () => {
      container.removeChild(notification)
    })

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (container.contains(notification)) {
        container.removeChild(notification)
      }
    }, 5000)
  }

  // Verificar espacio de almacenamiento
  checkStorageSpace() {
    try {
      const used = new Blob(Object.values(localStorage)).size
      const quota = 5 * 1024 * 1024 // 5MB aproximado para localStorage
      const percentage = (used / quota) * 100

      if (percentage > 80) {
        this.showNotification(
          `Almacenamiento local casi lleno (${percentage.toFixed(1)}%). Considera sincronizar datos.`,
          "warning",
        )
      }

      return {
        used,
        quota,
        percentage,
        available: quota - used,
      }
    } catch (error) {
      console.error("Error checking storage space:", error)
      return null
    }
  }

  // Limpiar datos antiguos
  cleanupOldData() {
    try {
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 días

      // Limpiar resultados antiguos
      const resultados = JSON.parse(localStorage.getItem("resultados") || "[]")
      const filteredResultados = resultados.filter((result) => new Date(result.completedAt).getTime() > cutoffTime)

      if (filteredResultados.length < resultados.length) {
        localStorage.setItem("resultados", JSON.stringify(filteredResultados))
        console.log(`[v0] Cleaned up ${resultados.length - filteredResultados.length} old results`)
      }

      // Limpiar elementos de sincronización muy antiguos
      this.syncQueue = this.syncQueue.filter((item) => item.timestamp > cutoffTime)
      this.saveSyncQueue()
    } catch (error) {
      console.error("Error cleaning up old data:", error)
    }
  }

  // Exportar datos para respaldo
  exportBackup() {
    try {
      const backup = {
        timestamp: Date.now(),
        version: "1.0",
        data: {
          estudiantes: JSON.parse(localStorage.getItem("estudiantes") || "[]"),
          docentes: JSON.parse(localStorage.getItem("docentes") || "[]"),
          pruebas: JSON.parse(localStorage.getItem("pruebas") || "[]"),
          resultados: JSON.parse(localStorage.getItem("resultados") || "[]"),
          configuracion: JSON.parse(localStorage.getItem("configuracion") || "{}"),
        },
        syncQueue: this.syncQueue,
      }

      const dataStr = JSON.stringify(backup, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(dataBlob)

      const link = document.createElement("a")
      link.href = url
      link.download = `e-valua-backup-${new Date().toISOString().split("T")[0]}.json`
      link.click()

      URL.revokeObjectURL(url)
      this.showNotification("Respaldo exportado correctamente", "success")
    } catch (error) {
      console.error("Error exporting backup:", error)
      this.showNotification("Error al exportar respaldo", "error")
    }
  }

  // Importar datos desde respaldo
  importBackup(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result)

        if (!backup.data || !backup.version) {
          throw new Error("Formato de respaldo inválido")
        }

        // Confirmar importación
        if (!confirm("¿Estás seguro de que quieres importar este respaldo? Esto sobrescribirá los datos actuales.")) {
          return
        }

        // Importar datos
        Object.entries(backup.data).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value))
        })

        // Importar cola de sincronización
        if (backup.syncQueue) {
          this.syncQueue = backup.syncQueue
          this.saveSyncQueue()
        }

        this.showNotification("Respaldo importado correctamente. Recarga la página.", "success")

        // Recargar después de 2 segundos
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } catch (error) {
        console.error("Error importing backup:", error)
        this.showNotification("Error al importar respaldo: " + error.message, "error")
      }
    }
    reader.readAsText(file)
  }

  // Generar ID único
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Obtener estadísticas de sincronización
  getSyncStats() {
    const totalOperations = this.syncQueue.length
    const operationTypes = {}

    this.syncQueue.forEach((item) => {
      operationTypes[item.operation] = (operationTypes[item.operation] || 0) + 1
    })

    return {
      totalPending: totalOperations,
      operationTypes,
      lastSyncTime: this.lastSyncTime,
      isOnline: this.isOnline,
      storageInfo: this.checkStorageSpace(),
    }
  }
}

// Inicializar el gestor offline
let offlineManager
document.addEventListener("DOMContentLoaded", () => {
  offlineManager = new OfflineManager()

  // Agregar botones de control offline si existen
  const forceSyncBtn = document.getElementById("force-sync")
  if (forceSyncBtn) {
    forceSyncBtn.addEventListener("click", () => offlineManager.forcSync())
  }

  const exportBackupBtn = document.getElementById("export-backup")
  if (exportBackupBtn) {
    exportBackupBtn.addEventListener("click", () => offlineManager.exportBackup())
  }

  const importBackupBtn = document.getElementById("import-backup")
  const importBackupFile = document.getElementById("import-backup-file")
  if (importBackupBtn && importBackupFile) {
    importBackupBtn.addEventListener("click", () => importBackupFile.click())
    importBackupFile.addEventListener("change", (e) => {
      if (e.target.files[0]) {
        offlineManager.importBackup(e.target.files[0])
      }
    })
  }

  // Limpiar datos antiguos al inicializar
  offlineManager.cleanupOldData()

  // Verificar espacio de almacenamiento
  offlineManager.checkStorageSpace()
})

// Funciones globales para integración con otros módulos
window.addToSyncQueue = (operation) => {
  if (offlineManager) {
    return offlineManager.addToSyncQueue(operation)
  }
  return null
}

window.isOnline = () => {
  return offlineManager ? offlineManager.isOnline : navigator.onLine
}
