// Main Application Controller
class EvaluaApp {
  constructor() {
    this.isInitialized = false
    this.loadingScreen = document.getElementById("loading-screen")

    this.init()
  }

  async init() {
    try {
      console.log("[v0] Initializing E-valua application...")

      // Show loading screen
      this.showLoading()

      // Wait for database to initialize
      await this.waitForDatabase()

      // Initialize managers
      await this.initializeManagers()

      // Setup global event listeners
      this.setupGlobalEventListeners()

      // Check maintenance mode
      this.checkMaintenanceMode()

      // Hide loading screen
      this.hideLoading()

      this.isInitialized = true
      console.log("[v0] E-valua application initialized successfully")
    } catch (error) {
      console.error("[v0] Application initialization failed:", error)
      this.showError("Error al inicializar la aplicación. Por favor recargue la página.")
    }
  }

  async waitForDatabase() {
    let attempts = 0
    const maxAttempts = 10

    while (!window.db || !window.db.data.settings) {
      if (attempts >= maxAttempts) {
        throw new Error("Database initialization timeout")
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
      attempts++
    }

    console.log("[v0] Database ready")
  }

  async initializeManagers() {
    // Auth manager is already initialized in auth.js

    // Initialize other managers when they're loaded
    const DashboardManager = window.DashboardManager
    const TestCreator = window.TestCreator
    const TestEvaluator = window.TestEvaluator
    const ResultsAnalyzer = window.ResultsAnalyzer
    const OfflineManager = window.OfflineManager

    if (DashboardManager) {
      window.dashboardManager = new DashboardManager()
    }

    if (TestCreator) {
      window.testCreator = new TestCreator()
    }

    if (TestEvaluator) {
      window.testEvaluator = new TestEvaluator()
    }

    if (ResultsAnalyzer) {
      window.resultsAnalyzer = new ResultsAnalyzer()
    }

    if (OfflineManager) {
      window.offlineManager = new OfflineManager()
    }
  }

  setupGlobalEventListeners() {
    // Handle visibility change (tab switching detection)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.isTestActive()) {
        this.handleTabSwitch()
      }
    })

    // Handle window focus/blur
    window.addEventListener("blur", () => {
      if (this.isTestActive()) {
        this.handleWindowBlur()
      }
    })

    window.addEventListener("focus", () => {
      if (this.isTestActive()) {
        this.handleWindowFocus()
      }
    })

    // Handle beforeunload (prevent accidental page close during tests)
    window.addEventListener("beforeunload", (e) => {
      if (this.isTestActive()) {
        e.preventDefault()
        e.returnValue = "¿Está seguro que desea salir? Su progreso se perderá."
        return e.returnValue
      }
    })

    // Handle keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      this.handleGlobalKeydown(e)
    })

    // Handle network status changes
    window.addEventListener("online", () => {
      this.handleNetworkChange(true)
    })

    window.addEventListener("offline", () => {
      this.handleNetworkChange(false)
    })
  }

  checkMaintenanceMode() {
    const settings = window.db.data.settings
    if (settings.app.maintenance) {
      this.showMaintenanceMode(settings.app.maintenanceMessage)
    }
  }

  showMaintenanceMode(message) {
    const maintenanceHTML = `
      <div class="maintenance-screen">
        <div class="maintenance-content">
          <h1>🔧 Mantenimiento</h1>
          <p>${message}</p>
          <div class="loading-spinner"></div>
        </div>
      </div>
    `

    document.body.innerHTML = maintenanceHTML

    // Add maintenance styles
    const style = document.createElement("style")
    style.textContent = `
      .maintenance-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        z-index: 99999;
      }
      
      .maintenance-content h1 {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      
      .maintenance-content p {
        font-size: 1.2rem;
        margin-bottom: 2rem;
        max-width: 500px;
      }
    `
    document.head.appendChild(style)
  }

  // Test state management
  isTestActive() {
    const testScreen = document.getElementById("test-screen")
    return testScreen && !testScreen.classList.contains("hidden")
  }

  handleTabSwitch() {
    if (window.testEvaluator) {
      window.testEvaluator.recordTabSwitch()
    }
  }

  handleWindowBlur() {
    if (window.testEvaluator) {
      window.testEvaluator.recordWindowBlur()
    }
  }

  handleWindowFocus() {
    if (window.testEvaluator) {
      window.testEvaluator.recordWindowFocus()
    }
  }

  handleGlobalKeydown(e) {
    // Prevent certain key combinations during tests
    if (this.isTestActive()) {
      const preventedKeys = [
        "F12", // Developer tools
        "F5", // Refresh
        "F11", // Fullscreen toggle
      ]

      const preventedCombos = [
        { ctrl: true, key: "r" }, // Refresh
        { ctrl: true, key: "R" }, // Refresh
        { ctrl: true, shift: true, key: "I" }, // Dev tools
        { ctrl: true, shift: true, key: "C" }, // Dev tools
        { ctrl: true, key: "u" }, // View source
        { ctrl: true, key: "U" }, // View source
        { alt: true, key: "F4" }, // Close window
      ]

      if (preventedKeys.includes(e.key)) {
        e.preventDefault()
        this.showWarning("Acción no permitida durante la evaluación")
        return
      }

      for (const combo of preventedCombos) {
        if (
          (!combo.ctrl || e.ctrlKey) &&
          (!combo.shift || e.shiftKey) &&
          (!combo.alt || e.altKey) &&
          e.key === combo.key
        ) {
          e.preventDefault()
          this.showWarning("Acción no permitida durante la evaluación")
          return
        }
      }
    }
  }

  handleNetworkChange(isOnline) {
    const indicator = document.getElementById("offline-indicator")

    if (isOnline) {
      indicator.classList.add("hidden")
      this.showSuccess("Conexión restaurada")

      // Trigger data sync
      if (window.db) {
        window.db.handleOnlineStatus(true)
      }
    } else {
      indicator.classList.remove("hidden")
      this.showWarning("Sin conexión a internet. Los datos se guardarán localmente.")
    }
  }

  // Loading screen management
  showLoading() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.remove("hidden")
    }
  }

  hideLoading() {
    if (this.loadingScreen) {
      setTimeout(() => {
        this.loadingScreen.classList.add("hidden")
      }, 1000) // Show loading for at least 1 second for better UX
    }
  }

  // Message utilities
  showError(message) {
    this.showMessage(message, "error")
  }

  showSuccess(message) {
    this.showMessage(message, "success")
  }

  showWarning(message) {
    this.showMessage(message, "warning")
  }

  showMessage(message, type = "info") {
    // Use auth manager's message system if available
    if (window.authManager) {
      window.authManager.showMessage(message, type)
    } else {
      // Fallback to console
      console.log(`[v0] ${type.toUpperCase()}: ${message}`)
    }
  }

  // Utility methods
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    } else {
      return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  generateRandomCode(length = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Security utilities
  sanitizeInput(input) {
    const div = document.createElement("div")
    div.textContent = input
    return div.innerHTML
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  // Export utilities
  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  downloadCSV(data, filename) {
    const csv = this.convertToCSV(data)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  convertToCSV(data) {
    if (!data || data.length === 0) return ""

    const headers = Object.keys(data[0])
    const csvHeaders = headers.join(",")

    const csvRows = data.map((row) => {
      return headers
        .map((header) => {
          const value = row[header]
          return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(",")
    })

    return [csvHeaders, ...csvRows].join("\n")
  }

  // Performance monitoring
  measurePerformance(name, fn) {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    console.log(`[v0] ${name} took ${end - start} milliseconds`)
    return result
  }

  // Error handling
  handleError(error, context = "Unknown") {
    console.error(`[v0] Error in ${context}:`, error)

    // Log error for debugging
    const errorLog = {
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    // Store error log locally
    try {
      const existingLogs = JSON.parse(localStorage.getItem("evalua_error_logs") || "[]")
      existingLogs.push(errorLog)

      // Keep only last 50 errors
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50)
      }

      localStorage.setItem("evalua_error_logs", JSON.stringify(existingLogs))
    } catch (e) {
      console.error("[v0] Could not save error log:", e)
    }

    // Show user-friendly error message
    this.showError("Ha ocurrido un error. Por favor intente nuevamente.")
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.evaluaApp = new EvaluaApp()
})

// Global error handler
window.addEventListener("error", (e) => {
  if (window.evaluaApp) {
    window.evaluaApp.handleError(e.error, "Global Error Handler")
  }
})

// Unhandled promise rejection handler
window.addEventListener("unhandledrejection", (e) => {
  if (window.evaluaApp) {
    window.evaluaApp.handleError(e.reason, "Unhandled Promise Rejection")
  }
})
