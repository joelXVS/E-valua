// Main Application Controller
class App {
  constructor() {
    this.currentUser = null
    this.currentScreen = "login"
    this.currentView = "dashboard"
    this.init()
  }

  init() {
    this.initializeManagers()
    this.setupEventListeners()
    this.loadApp()
  }

  initializeManagers() {
    try {
      if (window.DataManager) window.dataManager = new window.DataManager()
      if (window.Auth) window.auth = new window.Auth()
      if (window.Dashboard) window.dashboard = new window.Dashboard()
      if (window.TestCreator) window.testCreator = new window.TestCreator()
      if (window.TestEvaluator) window.testEvaluator = new window.TestEvaluator()
      if (window.ResultsAnalyzer) window.resultsAnalyzer = new window.ResultsAnalyzer()
      if (window.OfflineManager) window.offlineManager = new window.OfflineManager()

      console.log("[v0] Managers initialized")
    } catch (error) {
      console.error("[v0] Error initializing managers:", error)
    }
  }

  setupEventListeners() {
    // Online/Offline detection
    window.addEventListener("online", () => {
      if (window.dataManager) {
        window.dataManager.setOnlineStatus(true)
      }
      this.hideOfflineIndicator()
      // Trigger sync when coming back online
      if (window.offlineManager) {
        window.offlineManager.handleOnlineStatus(true)
      }
    })

    window.addEventListener("offline", () => {
      if (window.dataManager) {
        window.dataManager.setOnlineStatus(false)
      }
      this.showOfflineIndicator()
      // Handle offline mode
      if (window.offlineManager) {
        window.offlineManager.handleOnlineStatus(false)
      }
    })

    // Login form
    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.handleLogin(e)
    })

    // Register form
    document.getElementById("register-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.handleRegister(e)
    })

    // Show register screen
    document.getElementById("show-register").addEventListener("click", () => {
      this.showScreen("register")
    })

    // Back to login
    document.getElementById("back-to-login").addEventListener("click", () => {
      this.showScreen("login")
    })

    // Logout
    document.getElementById("logout-btn").addEventListener("click", () => {
      this.logout()
    })

    // User type change in register form
    document.getElementById("reg-user-type").addEventListener("change", (e) => {
      const teacherCodeGroup = document.getElementById("teacher-code-group")
      if (e.target.value === "docente") {
        teacherCodeGroup.style.display = "block"
        document.getElementById("teacher-code").required = true
      } else {
        teacherCodeGroup.style.display = "none"
        document.getElementById("teacher-code").required = false
      }
    })
  }

  loadApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem("current_user")
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser)
        this.showMainApp()
      } catch (error) {
        console.error("Error loading saved user:", error)
        this.showScreen("login")
      }
    } else {
      this.showScreen("login")
    }
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.add("hidden")
    })

    // Show requested screen
    const targetScreen = document.getElementById(`${screenName}-screen`) || document.getElementById(`${screenName}-app`)
    if (targetScreen) {
      targetScreen.classList.remove("hidden")
    }

    this.currentScreen = screenName
  }

  handleLogin(event) {
    const formData = new FormData(event.target)
    const userCode = formData.get("userCode")
    const password = formData.get("password")
    const userType = formData.get("userType")

    if (!userCode || !password || !userType) {
      this.showAlert("Por favor completa todos los campos", "error")
      return
    }

    try {
      let user = null

      // Try to authenticate with dataManager if available
      if (window.dataManager) {
        user = window.dataManager.authenticateUser(userCode, password, userType)
      } else {
        // Fallback authentication for demo purposes
        if (userCode === "1115454214" && password === "admin123" && userType === "administrador") {
          user = { id: 1, nombre: "Joel Valencia", codigo: "1115454214" }
        }
      }

      if (user) {
        this.currentUser = { ...user, tipo: userType }
        localStorage.setItem("current_user", JSON.stringify(this.currentUser))
        this.showMainApp()
        this.showAlert("Bienvenido " + user.nombre, "success")

        if (window.offlineManager) {
          window.offlineManager.cacheEssentialData()
        }
      } else {
        this.showAlert("Credenciales incorrectas", "error")
      }
    } catch (error) {
      console.error("[v0] Login error:", error)
      this.showAlert("Error al iniciar sesión", "error")
    }
  }

  handleRegister(event) {
    const formData = new FormData(event.target)
    const userData = {
      nombre: formData.get("name"),
      codigo: formData.get("userCode"),
      password: formData.get("password"),
      tipo: formData.get("userType"),
    }

    if (!navigator.onLine) {
      this.showAlert("Registro no disponible sin conexión. Conéctate a internet para crear una cuenta.", "error")
      return
    }

    // Validate teacher code if user is a teacher
    if (userData.tipo === "docente") {
      const teacherCode = formData.get("teacherCode")
      if (window.dataManager && !window.dataManager.validateTeacherCode(teacherCode)) {
        this.showAlert("Código de profesor inválido", "error")
        return
      }
    }

    // Check if user code already exists
    if (window.dataManager) {
      const allData = window.dataManager.getAllData()
      const existingUser = [...allData.estudiantes, ...allData.docentes].find((u) => u.codigo === userData.codigo)

      if (existingUser) {
        this.showAlert("El código de usuario ya existe", "error")
        return
      }
    }

    try {
      if (window.dataManager) {
        const newUser = window.dataManager.createUser(userData)
      }

      if (window.offlineManager && !navigator.onLine) {
        window.offlineManager.saveUserDataOffline(userData, "create")
      }

      this.showAlert("Cuenta creada exitosamente", "success")
      this.showScreen("login")

      // Pre-fill login form
      document.getElementById("user-code").value = userData.codigo
      document.getElementById("user-type").value = userData.tipo
    } catch (error) {
      console.error("Error creating user:", error)
      this.showAlert("Error al crear la cuenta", "error")
    }
  }

  showMainApp() {
    this.showScreen("main")
    this.setupNavigation()
    this.loadDashboard()

    // Update user name in navbar
    document.getElementById("user-name").textContent = this.currentUser.nombre

    this.updateOfflineStatus()
  }

  setupNavigation() {
    const navMenu = document.getElementById("nav-menu")
    navMenu.innerHTML = ""

    const menuItems = this.getMenuItemsForUser()

    menuItems.forEach((item) => {
      const li = document.createElement("li")
      const a = document.createElement("a")
      a.href = "#"
      a.textContent = item.label
      a.dataset.view = item.view

      a.addEventListener("click", (e) => {
        e.preventDefault()
        this.loadView(item.view)

        // Update active state
        navMenu.querySelectorAll("a").forEach((link) => link.classList.remove("active"))
        a.classList.add("active")
      })

      li.appendChild(a)
      navMenu.appendChild(li)
    })

    // Set first item as active
    if (navMenu.firstChild) {
      navMenu.firstChild.querySelector("a").classList.add("active")
    }
  }

  getMenuItemsForUser() {
    const baseItems = [{ label: "Dashboard", view: "dashboard" }]

    if (this.currentUser.tipo === "estudiante") {
      return [
        ...baseItems,
        { label: "Pruebas Disponibles", view: "available-tests" },
        { label: "Mis Resultados", view: "my-results" },
        { label: "Estado Sin Conexión", view: "offline-status" },
      ]
    } else if (this.currentUser.tipo === "docente") {
      return [
        ...baseItems,
        { label: "Crear Prueba", view: "create-test" },
        { label: "Mis Pruebas", view: "my-tests" },
        { label: "Resultados", view: "results-analyzer" },
        { label: "Estado Sin Conexión", view: "offline-status" },
      ]
    } else if (this.currentUser.tipo === "administrador") {
      return [
        ...baseItems,
        { label: "Gestión de Usuarios", view: "user-management" },
        { label: "Todas las Pruebas", view: "all-tests" },
        { label: "Estadísticas Generales", view: "general-stats" },
        { label: "Configuración", view: "settings" },
        { label: "Estado Sin Conexión", view: "offline-status" },
      ]
    }

    return baseItems
  }

  loadView(viewName) {
    this.currentView = viewName
    const contentContainer = document.getElementById("content-container")

    switch (viewName) {
      case "dashboard":
        this.loadDashboard()
        break
      case "create-test":
        if (!navigator.onLine) {
          this.showAlert("Crear pruebas requiere conexión a internet", "error")
          return
        }
        window.testCreator.showTestCreator()
        break
      case "available-tests":
        this.loadAvailableTests()
        break
      case "my-results":
        this.loadMyResults()
        break
      case "my-tests":
        this.loadMyTests()
        break
      case "results-analyzer":
        window.resultsAnalyzer.showResultsAnalyzer()
        break
      case "user-management":
        this.loadUserManagement()
        break
      case "all-tests":
        this.loadAllTests()
        break
      case "general-stats":
        this.loadGeneralStats()
        break
      case "settings":
        this.loadSettings()
        break
      case "offline-status":
        this.loadOfflineStatus()
        break
      default:
        this.loadDashboard()
    }
  }

  loadDashboard() {
    if (window.dashboard) {
      window.dashboard.loadDashboard(this.currentUser)
    } else {
      document.getElementById("content-container").innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Dashboard - ${this.currentUser.nombre}</h2>
          </div>
          <p>Bienvenido al sistema de evaluación online.</p>
          <p>Tipo de usuario: ${this.currentUser.tipo}</p>
        </div>
      `
    }
  }

  loadAvailableTests() {
    const contentContainer = document.getElementById("content-container")

    let activeTests
    if (!navigator.onLine && window.offlineManager) {
      const cachedData = window.offlineManager.getCachedData()
      if (cachedData) {
        activeTests = cachedData.pruebas.filter((test) => {
          const now = new Date()
          const startDate = new Date(test.fechaInicio)
          const endDate = new Date(test.fechaFin)
          return now >= startDate && now <= endDate
        })
      } else {
        activeTests = []
      }
    } else {
      activeTests = window.dataManager.getActiveTests()
    }

    let html = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Pruebas Disponibles</h2>
          ${!navigator.onLine ? '<p style="color: #f59e0b; font-size: 0.9rem;">📡 Modo sin conexión - Datos guardados localmente</p>' : ""}
        </div>
        <div class="tests-grid">
    `

    if (activeTests.length === 0) {
      html += `<p>No hay pruebas disponibles en este momento.${!navigator.onLine ? " Conéctate a internet para ver las pruebas más recientes." : ""}</p>`
    } else {
      activeTests.forEach((test) => {
        const startDate = new Date(test.fechaInicio).toLocaleDateString()
        const endDate = new Date(test.fechaFin).toLocaleDateString()

        html += `
          <div class="test-card">
            <h3>${test.nombre}</h3>
            <p><strong>Código:</strong> ${test.codigo}</p>
            <p><strong>Duración:</strong> ${test.duracion} minutos</p>
            <p><strong>Disponible hasta:</strong> ${endDate}</p>
            <button class="btn-primary" onclick="window.app.startTest('${test.id}')">
              Iniciar Prueba
            </button>
          </div>
        `
      })
    }

    html += "</div></div>"
    contentContainer.innerHTML = html
  }

  startTest(testId) {
    if (!navigator.onLine && window.offlineManager) {
      const canTakeOffline = window.offlineManager.showOfflineTestInterface(testId)
      if (!canTakeOffline) {
        return
      }
    }

    window.testEvaluator.startTest(testId, this.currentUser.id)
  }

  loadOfflineStatus() {
    const contentContainer = document.getElementById("content-container")

    if (!window.offlineManager) {
      contentContainer.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Estado Sin Conexión</h2>
          </div>
          <p>Funcionalidad sin conexión no disponible</p>
        </div>
      `
      return
    }

    const syncStatus = window.offlineManager.getSyncStatus()
    const capabilities = syncStatus.capabilities

    contentContainer.innerHTML = `
      <div class="offline-status-container">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Estado de Conexión</h2>
          </div>
          
          <div class="connection-status">
            <div class="status-indicator ${syncStatus.isOnline ? "online" : "offline"}">
              <span class="status-dot"></span>
              <span class="status-text">${syncStatus.isOnline ? "En línea" : "Sin conexión"}</span>
            </div>
            
            ${syncStatus.syncInProgress ? '<p class="sync-progress">🔄 Sincronizando datos...</p>' : ""}
            
            ${
              syncStatus.pendingItems > 0
                ? `
              <div class="pending-sync">
                <p><strong>Elementos pendientes de sincronización:</strong> ${syncStatus.pendingItems}</p>
                <button class="btn-primary" onclick="window.offlineManager.forcSync()" ${!syncStatus.isOnline ? "disabled" : ""}>
                  Sincronizar Ahora
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Capacidades Sin Conexión</h3>
          </div>
          
          <div class="capabilities-grid">
            <div class="capability-item ${capabilities.canTakeTests ? "available" : "unavailable"}">
              <span class="capability-icon">${capabilities.canTakeTests ? "✅" : "❌"}</span>
              <span class="capability-text">Realizar Pruebas</span>
            </div>
            
            <div class="capability-item ${capabilities.canViewResults ? "available" : "unavailable"}">
              <span class="capability-icon">${capabilities.canViewResults ? "✅" : "❌"}</span>
              <span class="capability-text">Ver Resultados</span>
            </div>
            
            <div class="capability-item ${capabilities.canCreateTests ? "available" : "unavailable"}">
              <span class="capability-icon">${capabilities.canCreateTests ? "✅" : "❌"}</span>
              <span class="capability-text">Crear Pruebas</span>
            </div>
          </div>
          
          ${
            capabilities.hasCache
              ? `
            <div class="cache-info">
              <p><strong>Datos guardados:</strong> ${new Date(capabilities.cacheAge).toLocaleString()}</p>
              <p><strong>Última sincronización:</strong> ${capabilities.lastSync ? new Date(capabilities.lastSync).toLocaleString() : "Nunca"}</p>
            </div>
          `
              : '<p class="no-cache">No hay datos guardados para uso sin conexión</p>'
          }
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Gestión de Datos Sin Conexión</h3>
          </div>
          
          <div class="offline-actions">
            <button class="btn-secondary" onclick="window.offlineManager.exportOfflineData()">
              📥 Exportar Datos Sin Conexión
            </button>
            
            <label class="btn-secondary" style="cursor: pointer;">
              📤 Importar Datos Sin Conexión
              <input type="file" accept=".json" style="display: none;" onchange="window.app.handleOfflineImport(this)">
            </label>
            
            <button class="btn-destructive" onclick="window.app.confirmClearOfflineData()">
              🗑️ Limpiar Datos Sin Conexión
            </button>
          </div>
        </div>
      </div>
    `
  }

  handleOfflineImport(input) {
    const file = input.files[0]
    if (file && window.offlineManager) {
      window.offlineManager.importOfflineData(file)
    }
    input.value = "" // Reset input
  }

  confirmClearOfflineData() {
    if (
      confirm("¿Estás seguro de que quieres eliminar todos los datos sin conexión? Esta acción no se puede deshacer.")
    ) {
      window.offlineManager.clearOfflineData()
      this.loadOfflineStatus() // Refresh the view
    }
  }

  logout() {
    this.currentUser = null
    localStorage.removeItem("current_user")
    this.showScreen("login")

    // Clear forms
    document.getElementById("login-form").reset()
    document.getElementById("register-form").reset()
  }

  showAlert(message, type = "info") {
    // Create alert element
    const alert = document.createElement("div")
    alert.className = `alert alert-${type}`
    alert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1001;
      max-width: 300px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    `

    // Set background color based on type
    switch (type) {
      case "success":
        alert.style.backgroundColor = "#4CAF50"
        break
      case "error":
        alert.style.backgroundColor = "#F44336"
        break
      case "warning":
        alert.style.backgroundColor = "#f59e0b"
        break
      default:
        alert.style.backgroundColor = "#757575"
    }

    alert.textContent = message
    document.body.appendChild(alert)

    // Remove after 3 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert)
      }
    }, 3000)
  }

  showOfflineIndicator() {
    if (window.offlineManager) {
      window.offlineManager.updateOfflineIndicator()
    } else {
      document.getElementById("offline-indicator").classList.remove("hidden")
    }
    this.updateOfflineStatus()
  }

  hideOfflineIndicator() {
    if (window.offlineManager) {
      window.offlineManager.updateOfflineIndicator()
    } else {
      document.getElementById("offline-indicator").classList.add("hidden")
    }
    this.updateOfflineStatus()
  }

  updateOfflineStatus() {
    const userInfo = document.querySelector(".nav-user")
    let offlineStatus = document.getElementById("offline-status")

    if (!navigator.onLine) {
      if (!offlineStatus) {
        offlineStatus = document.createElement("span")
        offlineStatus.id = "offline-status"
        offlineStatus.style.cssText = `
          background: #f59e0b;
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          margin-left: 0.5rem;
        `
        userInfo.appendChild(offlineStatus)
      }

      const syncStatus = window.offlineManager ? window.offlineManager.getSyncStatus() : null
      const pendingCount = syncStatus ? syncStatus.pendingItems : 0
      offlineStatus.textContent = `Sin conexión${pendingCount > 0 ? ` (${pendingCount} pendientes)` : ""}`
    } else {
      if (offlineStatus) {
        offlineStatus.remove()
      }
    }
  }

  loadMyResults() {
    // Placeholder for loading user results
    document.getElementById("content-container").innerHTML = "<p>Mis Resultados</p>"
  }

  loadMyTests() {
    // Placeholder for loading user tests
    document.getElementById("content-container").innerHTML = "<p>Mis Pruebas</p>"
  }

  loadUserManagement() {
    // Placeholder for loading user management
    document.getElementById("content-container").innerHTML = "<p>Gestión de Usuarios</p>"
  }

  loadAllTests() {
    // Placeholder for loading all tests
    document.getElementById("content-container").innerHTML = "<p>Todas las Pruebas</p>"
  }

  loadGeneralStats() {
    // Placeholder for loading general statistics
    document.getElementById("content-container").innerHTML = "<p>Estadísticas Generales</p>"
  }

  loadSettings() {
    // Placeholder for loading settings
    document.getElementById("content-container").innerHTML = "<p>Configuración</p>"
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing app...")
  window.app = new App()
})
    document.getElementById("show-register").addEventListener("click", () => {
      this.showScreen("register")
    })

    // Back to login
    document.getElementById("back-to-login").addEventListener("click", () => {
      this.showScreen("login")
    })

    // Logout
    document.getElementById("logout-btn").addEventListener("click", () => {
      this.logout()
    })

    // User type change in register form
    document.getElementById("reg-user-type").addEventListener("change", (e) => {
      const teacherCodeGroup = document.getElementById("teacher-code-group")
      if (e.target.value === "docente") {
        teacherCodeGroup.style.display = "block"
        document.getElementById("teacher-code").required = true
      } else {
        teacherCodeGroup.style.display = "none"
        document.getElementById("teacher-code").required = false
      }
    })
  }

  checkMaintenanceMode() {
    if (!window.dataManager) {
      console.warn("[v0] DataManager not available for maintenance check")
      return true
    }

    try {
      const settings = window.dataManager.getAllData().ajustes_generales_app
      if (settings && settings.mantenimiento) {
        this.showMaintenanceScreen()
        return false
      }
    } catch (error) {
      console.warn("[v0] Error checking maintenance mode:", error)
    }
    return true
  }

  loadApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem("current_user")
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser)
        this.showMainApp()
      } catch (error) {
        console.error("Error loading saved user:", error)
        this.showScreen("login")
      }
    } else {
      this.showScreen("login")
    }

    // Hide loading screen after a short delay
    setTimeout(() => {
      document.getElementById("loading-screen").classList.add("hidden")
    }, 1500)
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.add("hidden")
    })

    // Show requested screen
    const targetScreen = document.getElementById(`${screenName}-screen`) || document.getElementById(`${screenName}-app`)
    if (targetScreen) {
      targetScreen.classList.remove("hidden")
    }

    this.currentScreen = screenName
  }

  handleLogin(event) {
    const formData = new FormData(event.target)
    const userCode = formData.get("userCode")
    const password = formData.get("password")
    const userType = formData.get("userType")

    if (!userCode || !password || !userType) {
      this.showAlert("Por favor completa todos los campos", "error")
      return
    }

    if (!window.dataManager) {
      this.showAlert("Sistema no inicializado correctamente. Por favor recarga la página.", "error")
      return
    }

    if (!navigator.onLine && window.offlineManager) {
      const cachedData = window.offlineManager.getCachedData()
      if (!cachedData) {
        this.showAlert("Sin conexión y sin datos guardados. Conéctate a internet para iniciar sesión.", "error")
        return
      }
    }

    try {
      const user = window.dataManager.authenticateUser(userCode, password, userType)

      if (user) {
        this.currentUser = { ...user, tipo: userType }
        localStorage.setItem("current_user", JSON.stringify(this.currentUser))
        this.showMainApp()
        this.showAlert("Bienvenido " + user.nombre, "success")

        if (window.offlineManager) {
          window.offlineManager.cacheEssentialData()
        }
      } else {
        this.showAlert("Credenciales incorrectas", "error")
      }
    } catch (error) {
      console.error("[v0] Login error:", error)
      this.showAlert("Error al iniciar sesión", "error")
    }
  }

  handleRegister(event) {
    const formData = new FormData(event.target)
    const userData = {
      nombre: formData.get("name"),
      codigo: formData.get("userCode"),
      password: formData.get("password"),
      tipo: formData.get("userType"),
    }

    if (!navigator.onLine) {
      this.showAlert("Registro no disponible sin conexión. Conéctate a internet para crear una cuenta.", "error")
      return
    }

    // Validate teacher code if user is a teacher
    if (userData.tipo === "docente") {
      const teacherCode = formData.get("teacherCode")
      if (!window.dataManager.validateTeacherCode(teacherCode)) {
        this.showAlert("Código de profesor inválido", "error")
        return
      }
    }

    // Check if user code already exists
    const allData = window.dataManager.getAllData()
    const existingUser = [...allData.estudiantes, ...allData.docentes].find((u) => u.codigo === userData.codigo)

    if (existingUser) {
      this.showAlert("El código de usuario ya existe", "error")
      return
    }

    try {
      const newUser = window.dataManager.createUser(userData)

      if (window.offlineManager && !navigator.onLine) {
        window.offlineManager.saveUserDataOffline(userData, "create")
      }

      this.showAlert("Cuenta creada exitosamente", "success")
      this.showScreen("login")

      // Pre-fill login form
      document.getElementById("user-code").value = userData.codigo
      document.getElementById("user-type").value = userData.tipo
    } catch (error) {
      console.error("Error creating user:", error)
      this.showAlert("Error al crear la cuenta", "error")
    }
  }

  showMainApp() {
    this.showScreen("main")
    this.setupNavigation()
    this.loadDashboard()

    // Update user name in navbar
    document.getElementById("user-name").textContent = this.currentUser.nombre

    this.updateOfflineStatus()
  }

  setupNavigation() {
    const navMenu = document.getElementById("nav-menu")
    navMenu.innerHTML = ""

    const menuItems = this.getMenuItemsForUser()

    menuItems.forEach((item) => {
      const li = document.createElement("li")
      const a = document.createElement("a")
      a.href = "#"
      a.textContent = item.label
      a.dataset.view = item.view

      a.addEventListener("click", (e) => {
        e.preventDefault()
        this.loadView(item.view)

        // Update active state
        navMenu.querySelectorAll("a").forEach((link) => link.classList.remove("active"))
        a.classList.add("active")
      })

      li.appendChild(a)
      navMenu.appendChild(li)
    })

    // Set first item as active
    if (navMenu.firstChild) {
      navMenu.firstChild.querySelector("a").classList.add("active")
    }
  }

  getMenuItemsForUser() {
    const baseItems = [{ label: "Dashboard", view: "dashboard" }]

    if (this.currentUser.tipo === "estudiante") {
      return [
        ...baseItems,
        { label: "Pruebas Disponibles", view: "available-tests" },
        { label: "Mis Resultados", view: "my-results" },
        { label: "Estado Sin Conexión", view: "offline-status" },
      ]
    } else if (this.currentUser.tipo === "docente") {
      return [
        ...baseItems,
        { label: "Crear Prueba", view: "create-test" },
        { label: "Mis Pruebas", view: "my-tests" },
        { label: "Resultados", view: "results-analyzer" },
        { label: "Estado Sin Conexión", view: "offline-status" },
      ]
    } else if (this.currentUser.tipo === "administrador") {
      return [
        ...baseItems,
        { label: "Gestión de Usuarios", view: "user-management" },
        { label: "Todas las Pruebas", view: "all-tests" },
        { label: "Estadísticas Generales", view: "general-stats" },
        { label: "Configuración", view: "settings" },
        { label: "Estado Sin Conexión", view: "offline-status" },
      ]
    }

    return baseItems
  }

  loadView(viewName) {
    this.currentView = viewName
    const contentContainer = document.getElementById("content-container")

    switch (viewName) {
      case "dashboard":
        this.loadDashboard()
        break
      case "create-test":
        if (!navigator.onLine) {
          this.showAlert("Crear pruebas requiere conexión a internet", "error")
          return
        }
        window.testCreator.showTestCreator()
        break
      case "available-tests":
        this.loadAvailableTests()
        break
      case "my-results":
        this.loadMyResults()
        break
      case "my-tests":
        this.loadMyTests()
        break
      case "results-analyzer":
        window.resultsAnalyzer.showResultsAnalyzer()
        break
      case "user-management":
        this.loadUserManagement()
        break
      case "all-tests":
        this.loadAllTests()
        break
      case "general-stats":
        this.loadGeneralStats()
        break
      case "settings":
        this.loadSettings()
        break
      case "offline-status":
        this.loadOfflineStatus()
        break
      default:
        this.loadDashboard()
    }
  }

  loadDashboard() {
    if (window.dashboard) {
      window.dashboard.loadDashboard(this.currentUser)
    } else {
      console.error("[v0] Dashboard not available")
      document.getElementById("content-container").innerHTML = "<p>Error: Dashboard no disponible</p>"
    }
  }

  loadAvailableTests() {
    const contentContainer = document.getElementById("content-container")

    let activeTests
    if (!navigator.onLine && window.offlineManager) {
      const cachedData = window.offlineManager.getCachedData()
      if (cachedData) {
        activeTests = cachedData.pruebas.filter((test) => {
          const now = new Date()
          const startDate = new Date(test.fechaInicio)
          const endDate = new Date(test.fechaFin)
          return now >= startDate && now <= endDate
        })
      } else {
        activeTests = []
      }
    } else {
      activeTests = window.dataManager.getActiveTests()
    }

    let html = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Pruebas Disponibles</h2>
          ${!navigator.onLine ? '<p style="color: #f59e0b; font-size: 0.9rem;">📡 Modo sin conexión - Datos guardados localmente</p>' : ""}
        </div>
        <div class="tests-grid">
    `

    if (activeTests.length === 0) {
      html += `<p>No hay pruebas disponibles en este momento.${!navigator.onLine ? " Conéctate a internet para ver las pruebas más recientes." : ""}</p>`
    } else {
      activeTests.forEach((test) => {
        const startDate = new Date(test.fechaInicio).toLocaleDateString()
        const endDate = new Date(test.fechaFin).toLocaleDateString()

        html += `
          <div class="test-card">
            <h3>${test.nombre}</h3>
            <p><strong>Código:</strong> ${test.codigo}</p>
            <p><strong>Duración:</strong> ${test.duracion} minutos</p>
            <p><strong>Disponible hasta:</strong> ${endDate}</p>
            <button class="btn-primary" onclick="window.app.startTest('${test.id}')">
              Iniciar Prueba
            </button>
          </div>
        `
      })
    }

    html += "</div></div>"
    contentContainer.innerHTML = html
  }

  startTest(testId) {
    if (!navigator.onLine && window.offlineManager) {
      const canTakeOffline = window.offlineManager.showOfflineTestInterface(testId)
      if (!canTakeOffline) {
        return
      }
    }

    window.testEvaluator.startTest(testId, this.currentUser.id)
  }

  loadOfflineStatus() {
    const contentContainer = document.getElementById("content-container")

    if (!window.offlineManager) {
      contentContainer.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Estado Sin Conexión</h2>
          </div>
          <p>Funcionalidad sin conexión no disponible</p>
        </div>
      `
      return
    }

    const syncStatus = window.offlineManager.getSyncStatus()
    const capabilities = syncStatus.capabilities

    contentContainer.innerHTML = `
      <div class="offline-status-container">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Estado de Conexión</h2>
          </div>
          
          <div class="connection-status">
            <div class="status-indicator ${syncStatus.isOnline ? "online" : "offline"}">
              <span class="status-dot"></span>
              <span class="status-text">${syncStatus.isOnline ? "En línea" : "Sin conexión"}</span>
            </div>
            
            ${syncStatus.syncInProgress ? '<p class="sync-progress">🔄 Sincronizando datos...</p>' : ""}
            
            ${
              syncStatus.pendingItems > 0
                ? `
              <div class="pending-sync">
                <p><strong>Elementos pendientes de sincronización:</strong> ${syncStatus.pendingItems}</p>
                <button class="btn-primary" onclick="window.offlineManager.forcSync()" ${!syncStatus.isOnline ? "disabled" : ""}>
                  Sincronizar Ahora
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Capacidades Sin Conexión</h3>
          </div>
          
          <div class="capabilities-grid">
            <div class="capability-item ${capabilities.canTakeTests ? "available" : "unavailable"}">
              <span class="capability-icon">${capabilities.canTakeTests ? "✅" : "❌"}</span>
              <span class="capability-text">Realizar Pruebas</span>
            </div>
            
            <div class="capability-item ${capabilities.canViewResults ? "available" : "unavailable"}">
              <span class="capability-icon">${capabilities.canViewResults ? "✅" : "❌"}</span>
              <span class="capability-text">Ver Resultados</span>
            </div>
            
            <div class="capability-item ${capabilities.canCreateTests ? "available" : "unavailable"}">
              <span class="capability-icon">${capabilities.canCreateTests ? "✅" : "❌"}</span>
              <span class="capability-text">Crear Pruebas</span>
            </div>
          </div>
          
          ${
            capabilities.hasCache
              ? `
            <div class="cache-info">
              <p><strong>Datos guardados:</strong> ${new Date(capabilities.cacheAge).toLocaleString()}</p>
              <p><strong>Última sincronización:</strong> ${capabilities.lastSync ? new Date(capabilities.lastSync).toLocaleString() : "Nunca"}</p>
            </div>
          `
              : '<p class="no-cache">No hay datos guardados para uso sin conexión</p>'
          }
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Gestión de Datos Sin Conexión</h3>
          </div>
          
          <div class="offline-actions">
            <button class="btn-secondary" onclick="window.offlineManager.exportOfflineData()">
              📥 Exportar Datos Sin Conexión
            </button>
            
            <label class="btn-secondary" style="cursor: pointer;">
              📤 Importar Datos Sin Conexión
              <input type="file" accept=".json" style="display: none;" onchange="window.app.handleOfflineImport(this)">
            </label>
            
            <button class="btn-destructive" onclick="window.app.confirmClearOfflineData()">
              🗑️ Limpiar Datos Sin Conexión
            </button>
          </div>
        </div>
      </div>
    `
  }

  handleOfflineImport(input) {
    const file = input.files[0]
    if (file && window.offlineManager) {
      window.offlineManager.importOfflineData(file)
    }
    input.value = "" // Reset input
  }

  confirmClearOfflineData() {
    if (
      confirm("¿Estás seguro de que quieres eliminar todos los datos sin conexión? Esta acción no se puede deshacer.")
    ) {
      window.offlineManager.clearOfflineData()
      this.loadOfflineStatus() // Refresh the view
    }
  }

  logout() {
    this.currentUser = null
    localStorage.removeItem("current_user")
    this.showScreen("login")

    // Clear forms
    document.getElementById("login-form").reset()
    document.getElementById("register-form").reset()
  }

  showAlert(message, type = "info") {
    // Create alert element
    const alert = document.createElement("div")
    alert.className = `alert alert-${type}`
    alert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1001;
      max-width: 300px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    `

    // Set background color based on type
    switch (type) {
      case "success":
        alert.style.backgroundColor = "#4CAF50"
        break
      case "error":
        alert.style.backgroundColor = "#F44336"
        break
      case "warning":
        alert.style.backgroundColor = "#f59e0b"
        break
      default:
        alert.style.backgroundColor = "#757575"
    }

    alert.textContent = message
    document.body.appendChild(alert)

    // Remove after 3 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert)
      }
    }, 3000)
  }

  showOfflineIndicator() {
    if (window.offlineManager) {
      window.offlineManager.updateOfflineIndicator()
    } else {
      document.getElementById("offline-indicator").classList.remove("hidden")
    }
    this.updateOfflineStatus()
  }

  hideOfflineIndicator() {
    if (window.offlineManager) {
      window.offlineManager.updateOfflineIndicator()
    } else {
      document.getElementById("offline-indicator").classList.add("hidden")
    }
    this.updateOfflineStatus()
  }

  showMaintenanceScreen() {
    document.body.innerHTML = `
            <div class="maintenance-screen">
                <div class="maintenance-content">
                    <h1>Sistema en Mantenimiento</h1>
                    <p>El sistema está temporalmente fuera de servicio por mantenimiento.</p>
                    <p>Por favor intenta más tarde.</p>
                </div>
            </div>
        `
  }

  updateOfflineStatus() {
    const userInfo = document.querySelector(".nav-user")
    let offlineStatus = document.getElementById("offline-status")

    if (!navigator.onLine) {
      if (!offlineStatus) {
        offlineStatus = document.createElement("span")
        offlineStatus.id = "offline-status"
        offlineStatus.style.cssText = `
          background: #f59e0b;
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          margin-left: 0.5rem;
        `
        userInfo.appendChild(offlineStatus)
      }

      const syncStatus = window.offlineManager ? window.offlineManager.getSyncStatus() : null
      const pendingCount = syncStatus ? syncStatus.pendingItems : 0
      offlineStatus.textContent = `Sin conexión${pendingCount > 0 ? ` (${pendingCount} pendientes)` : ""}`
    } else {
      if (offlineStatus) {
        offlineStatus.remove()
      }
    }
  }

  loadMyResults() {
    // Placeholder for loading user results
    document.getElementById("content-container").innerHTML = "<p>Mis Resultados</p>"
  }

  loadMyTests() {
    // Placeholder for loading user tests
    document.getElementById("content-container").innerHTML = "<p>Mis Pruebas</p>"
  }

  loadUserManagement() {
    // Placeholder for loading user management
    document.getElementById("content-container").innerHTML = "<p>Gestión de Usuarios</p>"
  }

  loadAllTests() {
    // Placeholder for loading all tests
    document.getElementById("content-container").innerHTML = "<p>Todas las Pruebas</p>"
  }

  loadGeneralStats() {
    // Placeholder for loading general statistics
    document.getElementById("content-container").innerHTML = "<p>Estadísticas Generales</p>"
  }

  loadSettings() {
    // Placeholder for loading settings
    document.getElementById("content-container").innerHTML = "<p>Configuración</p>"
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing app...")
  window.app = new App()
})
