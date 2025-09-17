// Offline Manager - Handles offline functionality and data synchronization
class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine
    this.syncQueue = []
    this.offlineData = {
      pendingTests: [],
      pendingResults: [],
      pendingUsers: [],
      lastSync: null,
    }
    this.syncInProgress = false
    this.maxRetries = 3
    this.retryDelay = 5000 // 5 seconds

    this.initializeOfflineSupport()
  }

  initializeOfflineSupport() {
    // Load offline data from localStorage
    this.loadOfflineData()

    // Setup online/offline event listeners
    window.addEventListener("online", () => this.handleOnlineStatus(true))
    window.addEventListener("offline", () => this.handleOnlineStatus(false))

    // Setup periodic sync when online
    this.setupPeriodicSync()

    // Setup service worker for caching (if supported)
    this.registerServiceWorker()

    // Initial sync check
    if (this.isOnline) {
      this.syncData()
    }

    // Update UI indicator
    this.updateOfflineIndicator()
  }

  loadOfflineData() {
    try {
      const stored = localStorage.getItem("offline_data")
      if (stored) {
        this.offlineData = { ...this.offlineData, ...JSON.parse(stored) }
      }

      const queue = localStorage.getItem("sync_queue")
      if (queue) {
        this.syncQueue = JSON.parse(queue)
      }
    } catch (error) {
      console.error("Error loading offline data:", error)
    }
  }

  saveOfflineData() {
    try {
      localStorage.setItem("offline_data", JSON.stringify(this.offlineData))
      localStorage.setItem("sync_queue", JSON.stringify(this.syncQueue))
    } catch (error) {
      console.error("Error saving offline data:", error)
    }
  }

  handleOnlineStatus(online) {
    this.isOnline = online
    this.updateOfflineIndicator()

    if (online) {
      console.log("[v0] Back online - starting sync")
      this.syncData()
    } else {
      console.log("[v0] Gone offline - enabling offline mode")
      this.showOfflineNotification()
    }
  }

  updateOfflineIndicator() {
    let indicator = document.getElementById("offline-indicator")

    if (!this.isOnline) {
      if (!indicator) {
        indicator = document.createElement("div")
        indicator.id = "offline-indicator"
        indicator.className = "offline-indicator"
        document.body.insertBefore(indicator, document.body.firstChild)
      }

      indicator.innerHTML = `
        <span>📡 Modo sin conexión - Los datos se sincronizarán cuando vuelvas a estar en línea</span>
        ${this.syncQueue.length > 0 ? `<span style="margin-left: 1rem;">⏳ ${this.syncQueue.length} elementos pendientes</span>` : ""}
      `
    } else {
      if (indicator) {
        indicator.remove()
      }
    }
  }

  showOfflineNotification() {
    if (window.app && window.app.showAlert) {
      window.app.showAlert(
        "Sin conexión a internet. Los datos se guardarán localmente y se sincronizarán cuando vuelvas a estar en línea.",
        "warning",
      )
    }
  }

  // Cache management for offline access
  cacheEssentialData() {
    try {
      const allData = window.dataManager.getAllData()
      const essentialData = {
        usuarios: allData.usuarios,
        estudiantes: allData.estudiantes,
        docentes: allData.docentes,
        administradores: allData.administradores,
        pruebas: allData.pruebas,
        resultados: allData.resultados,
        cachedAt: new Date().toISOString(),
      }

      localStorage.setItem("cached_data", JSON.stringify(essentialData))
      console.log("[v0] Essential data cached for offline use")
    } catch (error) {
      console.error("Error caching essential data:", error)
    }
  }

  getCachedData() {
    try {
      const cached = localStorage.getItem("cached_data")
      if (cached) {
        const data = JSON.parse(cached)
        const cacheAge = new Date() - new Date(data.cachedAt)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours

        if (cacheAge < maxAge) {
          return data
        }
      }
    } catch (error) {
      console.error("Error getting cached data:", error)
    }
    return null
  }

  // Offline test taking support
  saveTestProgressOffline(testId, studentId, progress) {
    const progressData = {
      id: `progress_${testId}_${studentId}_${Date.now()}`,
      type: "test_progress",
      testId,
      studentId,
      progress,
      timestamp: new Date().toISOString(),
      synced: false,
    }

    this.offlineData.pendingTests.push(progressData)
    this.saveOfflineData()

    console.log("[v0] Test progress saved offline:", progressData.id)
  }

  saveTestResultOffline(resultData) {
    const offlineResult = {
      id: `result_${resultData.pruebaId}_${resultData.estudianteId}_${Date.now()}`,
      type: "test_result",
      data: resultData,
      timestamp: new Date().toISOString(),
      synced: false,
    }

    this.offlineData.pendingResults.push(offlineResult)
    this.addToSyncQueue(offlineResult)
    this.saveOfflineData()

    console.log("[v0] Test result saved offline:", offlineResult.id)

    if (window.app && window.app.showAlert) {
      window.app.showAlert("Resultado guardado sin conexión. Se sincronizará automáticamente.", "info")
    }
  }

  saveUserDataOffline(userData, action = "create") {
    const offlineUser = {
      id: `user_${userData.id || Date.now()}`,
      type: "user_data",
      action, // 'create', 'update', 'delete'
      data: userData,
      timestamp: new Date().toISOString(),
      synced: false,
    }

    this.offlineData.pendingUsers.push(offlineUser)
    this.addToSyncQueue(offlineUser)
    this.saveOfflineData()

    console.log("[v0] User data saved offline:", offlineUser.id)
  }

  addToSyncQueue(item) {
    this.syncQueue.push(item)
    this.updateOfflineIndicator()
  }

  // Data synchronization
  async syncData() {
    if (this.syncInProgress || !this.isOnline) {
      return
    }

    this.syncInProgress = true
    console.log("[v0] Starting data synchronization...")

    try {
      // Cache current data for offline use
      this.cacheEssentialData()

      // Sync pending items
      await this.syncPendingItems()

      // Update last sync time
      this.offlineData.lastSync = new Date().toISOString()
      this.saveOfflineData()

      console.log("[v0] Data synchronization completed")

      if (this.syncQueue.length === 0 && window.app && window.app.showAlert) {
        window.app.showAlert("Datos sincronizados correctamente", "success")
      }
    } catch (error) {
      console.error("Error during sync:", error)

      if (window.app && window.app.showAlert) {
        window.app.showAlert("Error al sincronizar datos. Se reintentará automáticamente.", "error")
      }
    } finally {
      this.syncInProgress = false
      this.updateOfflineIndicator()
    }
  }

  async syncPendingItems() {
    const itemsToSync = [...this.syncQueue]
    const syncedItems = []

    for (const item of itemsToSync) {
      try {
        const success = await this.syncItem(item)
        if (success) {
          syncedItems.push(item)
          console.log("[v0] Synced item:", item.id)
        }
      } catch (error) {
        console.error("Error syncing item:", item.id, error)

        // Increment retry count
        item.retryCount = (item.retryCount || 0) + 1

        // Remove from queue if max retries reached
        if (item.retryCount >= this.maxRetries) {
          console.error("Max retries reached for item:", item.id)
          syncedItems.push(item) // Remove from queue

          if (window.app && window.app.showAlert) {
            window.app.showAlert(`Error al sincronizar ${item.type}. Elemento descartado.`, "error")
          }
        }
      }
    }

    // Remove synced items from queue
    this.syncQueue = this.syncQueue.filter((item) => !syncedItems.includes(item))

    // Remove synced items from offline data
    this.offlineData.pendingResults = this.offlineData.pendingResults.filter(
      (item) => !syncedItems.some((synced) => synced.id === item.id),
    )
    this.offlineData.pendingUsers = this.offlineData.pendingUsers.filter(
      (item) => !syncedItems.some((synced) => synced.id === item.id),
    )
    this.offlineData.pendingTests = this.offlineData.pendingTests.filter(
      (item) => !syncedItems.some((synced) => synced.id === item.id),
    )
  }

  async syncItem(item) {
    // Simulate API call - in a real app, this would make HTTP requests
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          switch (item.type) {
            case "test_result":
              // Save result to main data store
              window.dataManager.saveTestResult(item.data)
              resolve(true)
              break

            case "user_data":
              // Handle user data sync based on action
              switch (item.action) {
                case "create":
                  window.dataManager.createUser(item.data)
                  break
                case "update":
                  window.dataManager.updateUser(item.data)
                  break
                case "delete":
                  window.dataManager.deleteUser(item.data.id)
                  break
              }
              resolve(true)
              break

            case "test_progress":
              // Test progress doesn't need permanent storage
              resolve(true)
              break

            default:
              console.warn("Unknown sync item type:", item.type)
              resolve(false)
          }
        } catch (error) {
          console.error("Error processing sync item:", error)
          resolve(false)
        }
      }, 1000) // Simulate network delay
    })
  }

  setupPeriodicSync() {
    // Sync every 5 minutes when online
    setInterval(
      () => {
        if (this.isOnline && this.syncQueue.length > 0) {
          this.syncData()
        }
      },
      5 * 60 * 1000,
    )
  }

  // Service Worker registration for advanced caching
  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js")
        console.log("[v0] Service Worker registered:", registration)

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              if (window.app && window.app.showAlert) {
                window.app.showAlert("Nueva versión disponible. Recarga la página para actualizar.", "info")
              }
            }
          })
        })
      } catch (error) {
        console.log("[v0] Service Worker registration failed:", error)
      }
    }
  }

  // Offline-specific UI methods
  showOfflineTestInterface(testId) {
    // Check if test data is available offline
    const cachedData = this.getCachedData()
    if (!cachedData) {
      if (window.app && window.app.showAlert) {
        window.app.showAlert(
          "No hay datos disponibles sin conexión. Conéctate a internet para acceder a las pruebas.",
          "error",
        )
      }
      return false
    }

    const test = cachedData.pruebas.find((t) => t.id === testId)
    if (!test) {
      if (window.app && window.app.showAlert) {
        window.app.showAlert("Esta prueba no está disponible sin conexión.", "error")
      }
      return false
    }

    // Show offline warning
    if (window.app && window.app.showAlert) {
      window.app.showAlert(
        "Realizando prueba sin conexión. Los resultados se sincronizarán automáticamente.",
        "warning",
      )
    }

    return true
  }

  getOfflineCapabilities() {
    const cachedData = this.getCachedData()

    return {
      hasCache: !!cachedData,
      cacheAge: cachedData ? new Date() - new Date(cachedData.cachedAt) : null,
      pendingSync: this.syncQueue.length,
      canTakeTests: !!cachedData,
      canViewResults: !!cachedData,
      canCreateTests: false, // Requires online connection
      lastSync: this.offlineData.lastSync,
    }
  }

  // Manual sync trigger
  forcSync() {
    if (!this.isOnline) {
      if (window.app && window.app.showAlert) {
        window.app.showAlert("No hay conexión a internet. No se puede sincronizar.", "error")
      }
      return
    }

    if (this.syncInProgress) {
      if (window.app && window.app.showAlert) {
        window.app.showAlert("Sincronización en progreso...", "info")
      }
      return
    }

    this.syncData()
  }

  // Clear offline data (for troubleshooting)
  clearOfflineData() {
    this.offlineData = {
      pendingTests: [],
      pendingResults: [],
      pendingUsers: [],
      lastSync: null,
    }
    this.syncQueue = []

    localStorage.removeItem("offline_data")
    localStorage.removeItem("sync_queue")
    localStorage.removeItem("cached_data")
    localStorage.removeItem("test_progress")

    console.log("[v0] Offline data cleared")

    if (window.app && window.app.showAlert) {
      window.app.showAlert("Datos sin conexión eliminados", "success")
    }
  }

  // Get sync status for UI
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingItems: this.syncQueue.length,
      lastSync: this.offlineData.lastSync,
      capabilities: this.getOfflineCapabilities(),
    }
  }

  // Export offline data for backup
  exportOfflineData() {
    const exportData = {
      offlineData: this.offlineData,
      syncQueue: this.syncQueue,
      cachedData: this.getCachedData(),
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `offline_backup_${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)

    if (window.app && window.app.showAlert) {
      window.app.showAlert("Copia de seguridad de datos sin conexión descargada", "success")
    }
  }

  // Import offline data from backup
  importOfflineData(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result)

        if (importData.offlineData) {
          this.offlineData = importData.offlineData
        }

        if (importData.syncQueue) {
          this.syncQueue = importData.syncQueue
        }

        if (importData.cachedData) {
          localStorage.setItem("cached_data", JSON.stringify(importData.cachedData))
        }

        this.saveOfflineData()
        this.updateOfflineIndicator()

        if (window.app && window.app.showAlert) {
          window.app.showAlert("Datos sin conexión importados correctamente", "success")
        }
      } catch (error) {
        console.error("Error importing offline data:", error)
        if (window.app && window.app.showAlert) {
          window.app.showAlert("Error al importar datos sin conexión", "error")
        }
      }
    }
    reader.readAsText(file)
  }
}

// Create global instance
window.offlineManager = new OfflineManager()
