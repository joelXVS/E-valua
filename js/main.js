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
    const maxAttempts = 20

    while (!window.db || !window.db.data || !window.db.data.settings) {
      if (attempts >= maxAttempts) {
        throw new Error("Database initialization timeout")
      }

      console.log(`[v0] Waiting for database... attempt ${attempts + 1}/${maxAttempts}`)
      await new Promise((resolve) => setTimeout(resolve, 250))
      attempts++
    }

    if (!window.db.data.students || !window.db.data.teachers || !window.db.data.tests || !window.db.data.results) {
      throw new Error("Database data incomplete")
    }

    console.log("[v0] Database ready with all data loaded")
  }

  async initializeManagers() {
    try {
      // Auth manager is already initialized in auth.js

      // Initialize dashboard manager
      const DashboardManager = window.DashboardManager // Declare the variable before using it
      if (typeof DashboardManager !== "undefined") {
        window.dashboardManager = new DashboardManager()
        console.log("[v0] Dashboard manager initialized")
      }

      // Initialize test creator
      const TestCreator = window.TestCreator // Declare the variable before using it
      if (typeof TestCreator !== "undefined") {
        window.testCreator = new TestCreator()
        console.log("[v0] Test creator initialized")
      }

      // Initialize test evaluator
      const TestEvaluator = window.TestEvaluator // Declare the variable before using it
      if (typeof TestEvaluator !== "undefined") {
        window.testEvaluator = new TestEvaluator()
        console.log("[v0] Test evaluator initialized")
      }

      // Initialize results analyzer
      const ResultsAnalyzer = window.ResultsAnalyzer // Declare the variable before using it
      if (typeof ResultsAnalyzer !== "undefined") {
        window.resultsAnalyzer = new ResultsAnalyzer()
        console.log("[v0] Results analyzer initialized")
      }

      // Initialize offline manager
      const OfflineManager = window.OfflineManager // Declare the variable before using it
      if (typeof OfflineManager !== "undefined") {
        window.offlineManager = new OfflineManager()
        console.log("[v0] Offline manager initialized")
      }
    } catch (error) {
      console.warn("[v0] Some managers failed to initialize:", error)
      // Continue initialization even if some managers fail
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
    if (settings && settings.app && settings.app.maintenance) {
      this.showMaintenanceMode(
        settings.app.maintenanceMessage || "El sistema está en mantenimiento. Por favor intente más tarde.",
      )
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
    // Create a simple notification system if auth manager is not available
    if (window.authManager && window.authManager.showMessage) {
      window.authManager.showMessage(message, type)
    } else {
      // Fallback notification system
      this.createNotification(message, type)
    }
  }

  createNotification(message, type) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll(".app-notification")
    existingNotifications.forEach((n) => n.remove())

    // Create notification element
    const notification = document.createElement("div")
    notification.className = `app-notification notification-${type}`
    notification.textContent = message

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `

    // Set background color based on type
    const colors = {
      error: "#dc3545",
      success: "#28a745",
      warning: "#ffc107",
      info: "#17a2b8",
    }
    notification.style.backgroundColor = colors[type] || colors.info

    // Add animation styles
    const style = document.createElement("style")
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)

    // Add to page
    document.body.appendChild(notification)

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease-out reverse"
      setTimeout(() => notification.remove(), 300)
    }, 5000)
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

document.addEventListener("DOMContentLoaded", () => {
  try {
    window.evaluaApp = new EvaluaApp()
  } catch (error) {
    console.error("[v0] Failed to initialize EvaluaApp:", error)
    // Show basic error message
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; font-family: Arial, sans-serif;">
        <div>
          <h2 style="color: #dc3545;">Error de Inicialización</h2>
          <p>No se pudo inicializar la aplicación. Por favor recargue la página.</p>
          <button onclick="location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Recargar Página
          </button>
        </div>
      </div>
    `
  }
})

// Global error handler
window.addEventListener("error", (e) => {
  if (window.evaluaApp) {
    window.evaluaApp.handleError(e.error, "Global Error Handler")
  } else {
    console.error("[v0] Global error before app initialization:", e.error)
  }
})

// Unhandled promise rejection handler
window.addEventListener("unhandledrejection", (e) => {
  if (window.evaluaApp) {
    window.evaluaApp.handleError(e.reason, "Unhandled Promise Rejection")
  } else {
    console.error("[v0] Unhandled promise rejection before app initialization:", e.reason)
  }
})
