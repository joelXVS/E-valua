// Authentication Manager
class AuthManager {
  constructor() {
    this.currentUser = null
    this.loginAttempts = 0
    this.isLocked = false
    this.lockoutTimer = null

    this.init()
  }

  init() {
    // Check for existing session
    this.loadSession()

    // Setup event listeners
    this.setupEventListeners()

    // Check if user is already logged in
    if (this.currentUser) {
      this.showDashboard()
    } else {
      this.showLogin()
    }
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById("login-form")
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e))
    }

    // Register form
    const registerForm = document.getElementById("register-form")
    if (registerForm) {
      registerForm.addEventListener("submit", (e) => this.handleRegister(e))
    }

    // Show register screen
    const showRegisterBtn = document.getElementById("show-register")
    if (showRegisterBtn) {
      showRegisterBtn.addEventListener("click", () => this.showRegister())
    }

    // Back to login
    const backToLoginBtn = document.getElementById("back-to-login")
    if (backToLoginBtn) {
      backToLoginBtn.addEventListener("click", () => this.showLogin())
    }

    // Logout
    const logoutBtn = document.getElementById("logout-btn")
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout())
    }

    // User type change in register form
    const regTypeSelect = document.getElementById("reg-type")
    if (regTypeSelect) {
      regTypeSelect.addEventListener("change", (e) => this.handleUserTypeChange(e))
    }

    // Session timeout
    this.setupSessionTimeout()
  }

  async handleLogin(e) {
    e.preventDefault()

    if (this.isLocked) {
      this.showError("Cuenta bloqueada. Intente más tarde.")
      return
    }

    const formData = new FormData(e.target)
    const loginData = {
      code: formData.get("user-code") || document.getElementById("user-code").value,
      password: formData.get("password") || document.getElementById("password").value,
      userType: formData.get("user-type") || document.getElementById("user-type").value,
    }

    // Validate input
    if (!loginData.code || !loginData.password || !loginData.userType) {
      this.showError("Por favor complete todos los campos")
      return
    }

    this.setFormLoading(true)

    try {
      // Wait for database to be ready
      if (!window.db || !window.db.data.settings) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const user = await window.db.authenticateUser(loginData.code, loginData.password, loginData.userType)

      if (user) {
        this.currentUser = user
        this.saveSession()
        this.resetLoginAttempts()
        this.showSuccess("Inicio de sesión exitoso")

        setTimeout(() => {
          this.showDashboard()
        }, 1000)
      } else {
        this.handleFailedLogin()
      }
    } catch (error) {
      console.error("[v0] Login error:", error)
      this.showError("Error en el sistema. Intente más tarde.")
    } finally {
      this.setFormLoading(false)
    }
  }

  async handleRegister(e) {
    e.preventDefault()

    const formData = new FormData(e.target)
    const registerData = {
      name: formData.get("reg-name") || document.getElementById("reg-name").value,
      code: formData.get("reg-code") || document.getElementById("reg-code").value,
      password: formData.get("reg-password") || document.getElementById("reg-password").value,
      userType: formData.get("reg-type") || document.getElementById("reg-type").value,
      teacherCode: formData.get("teacher-code") || document.getElementById("teacher-code").value,
    }

    // Validate input
    if (!registerData.name || !registerData.code || !registerData.password || !registerData.userType) {
      this.showError("Por favor complete todos los campos")
      return
    }

    if (registerData.userType === "teacher" && !registerData.teacherCode) {
      this.showError("El código de profesor es requerido para docentes")
      return
    }

    // Validate password strength
    if (registerData.password.length < 6) {
      this.showError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    this.setFormLoading(true, "register")

    try {
      const newUser = await window.db.registerUser(registerData)

      this.showSuccess("Cuenta creada exitosamente. Puede iniciar sesión.")

      setTimeout(() => {
        this.showLogin()
        // Pre-fill login form
        document.getElementById("user-code").value = registerData.code
        document.getElementById("user-type").value = registerData.userType
      }, 1500)
    } catch (error) {
      console.error("[v0] Registration error:", error)
      this.showError(error.message || "Error al crear la cuenta")
    } finally {
      this.setFormLoading(false, "register")
    }
  }

  handleFailedLogin() {
    this.loginAttempts++
    const maxAttempts = window.db?.data?.settings?.security?.maxLoginAttempts || 3

    if (this.loginAttempts >= maxAttempts) {
      this.lockAccount()
      this.showError(`Cuenta bloqueada por ${this.getLockoutDuration()} minutos debido a múltiples intentos fallidos`)
    } else {
      const remaining = maxAttempts - this.loginAttempts
      this.showError(`Credenciales incorrectas. ${remaining} intentos restantes.`)
    }
  }

  lockAccount() {
    this.isLocked = true
    const duration = this.getLockoutDuration() * 60 * 1000 // Convert to milliseconds

    this.lockoutTimer = setTimeout(() => {
      this.isLocked = false
      this.resetLoginAttempts()
      this.showSuccess("Cuenta desbloqueada. Puede intentar nuevamente.")
    }, duration)

    // Save lockout state
    localStorage.setItem(
      "evalua_lockout",
      JSON.stringify({
        locked: true,
        until: Date.now() + duration,
      }),
    )
  }

  getLockoutDuration() {
    return window.db?.data?.settings?.security?.lockoutDuration / 60 || 15 // Default 15 minutes
  }

  resetLoginAttempts() {
    this.loginAttempts = 0
    localStorage.removeItem("evalua_lockout")
  }

  handleUserTypeChange(e) {
    const teacherCodeGroup = document.getElementById("teacher-code-group")
    if (e.target.value === "teacher") {
      teacherCodeGroup.style.display = "block"
      document.getElementById("teacher-code").required = true
    } else {
      teacherCodeGroup.style.display = "none"
      document.getElementById("teacher-code").required = false
    }
  }

  handleLogout() {
    if (confirm("¿Está seguro que desea cerrar sesión?")) {
      this.currentUser = null
      this.clearSession()
      this.showLogin()
      this.showSuccess("Sesión cerrada exitosamente")
    }
  }

  // Session management
  saveSession() {
    if (this.currentUser) {
      const sessionData = {
        user: this.currentUser,
        timestamp: Date.now(),
        expires: Date.now() + (window.db?.data?.settings?.app?.sessionTimeout || 7200) * 1000,
      }

      try {
        localStorage.setItem("evalua_session", JSON.stringify(sessionData))
      } catch (error) {
        console.error("[v0] Error saving session:", error)
      }
    }
  }

  loadSession() {
    try {
      const sessionData = localStorage.getItem("evalua_session")
      if (sessionData) {
        const session = JSON.parse(sessionData)

        // Check if session is still valid
        if (session.expires > Date.now()) {
          this.currentUser = session.user
          return true
        } else {
          this.clearSession()
        }
      }
    } catch (error) {
      console.error("[v0] Error loading session:", error)
      this.clearSession()
    }

    // Check lockout state
    try {
      const lockoutData = localStorage.getItem("evalua_lockout")
      if (lockoutData) {
        const lockout = JSON.parse(lockoutData)
        if (lockout.locked && lockout.until > Date.now()) {
          this.isLocked = true
          const remaining = lockout.until - Date.now()
          this.lockoutTimer = setTimeout(() => {
            this.isLocked = false
            this.resetLoginAttempts()
          }, remaining)
        } else {
          this.resetLoginAttempts()
        }
      }
    } catch (error) {
      console.error("[v0] Error loading lockout state:", error)
    }

    return false
  }

  clearSession() {
    localStorage.removeItem("evalua_session")
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer)
    }
  }

  setupSessionTimeout() {
    const checkSession = () => {
      if (this.currentUser) {
        const sessionData = localStorage.getItem("evalua_session")
        if (sessionData) {
          const session = JSON.parse(sessionData)
          if (session.expires <= Date.now()) {
            this.showError("Su sesión ha expirado. Por favor inicie sesión nuevamente.")
            this.handleLogout()
            return
          }
        }
      }

      // Check again in 1 minute
      this.sessionTimeoutTimer = setTimeout(checkSession, 60000)
    }

    checkSession()
  }

  // UI Management
  showLogin() {
    this.hideAllScreens()
    document.getElementById("login-screen").classList.remove("hidden")
    document.getElementById("user-code").focus()
  }

  showRegister() {
    this.hideAllScreens()
    document.getElementById("register-screen").classList.remove("hidden")
    document.getElementById("reg-name").focus()
  }

  showDashboard() {
    this.hideAllScreens()
    document.getElementById("dashboard-screen").classList.remove("hidden")

    // Update user info in navbar
    const userNameElement = document.getElementById("user-name")
    if (userNameElement && this.currentUser) {
      userNameElement.textContent = this.currentUser.name
    }

    // Set role-based CSS class
    document.body.className = `role-${this.currentUser.userType}`

    // Initialize dashboard
    if (window.dashboardManager) {
      window.dashboardManager.init(this.currentUser)
    }
  }

  hideAllScreens() {
    const screens = document.querySelectorAll(".screen")
    screens.forEach((screen) => screen.classList.add("hidden"))
  }

  // Form state management
  setFormLoading(loading, formType = "login") {
    const form =
      formType === "register" ? document.getElementById("register-form") : document.getElementById("login-form")

    if (loading) {
      form.classList.add("form-loading")
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.textContent = "Procesando..."
      }
    } else {
      form.classList.remove("form-loading")
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = formType === "register" ? "Crear Cuenta" : "Iniciar Sesión"
      }
    }
  }

  // Message display
  showError(message) {
    this.showMessage(message, "error")
  }

  showSuccess(message) {
    this.showMessage(message, "success")
  }

  showMessage(message, type = "info") {
    // Remove existing messages
    const existingMessages = document.querySelectorAll(".auth-message")
    existingMessages.forEach((msg) => msg.remove())

    // Create message element
    const messageEl = document.createElement("div")
    messageEl.className = `auth-message auth-message-${type}`
    messageEl.textContent = message

    // Style the message
    Object.assign(messageEl.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "1rem 1.5rem",
      borderRadius: "8px",
      color: "white",
      fontWeight: "600",
      zIndex: "10000",
      maxWidth: "400px",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      animation: "slideInRight 0.3s ease-out",
    })

    // Set background color based on type
    const colors = {
      error: "#dc3545",
      success: "#28a745",
      info: "#17a2b8",
      warning: "#ffc107",
    }
    messageEl.style.backgroundColor = colors[type] || colors.info

    document.body.appendChild(messageEl)

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.style.animation = "slideOutRight 0.3s ease-in"
        setTimeout(() => messageEl.remove(), 300)
      }
    }, 5000)
  }

  // Utility methods
  getCurrentUser() {
    return this.currentUser
  }

  isAuthenticated() {
    return !!this.currentUser
  }

  hasRole(role) {
    return this.currentUser && this.currentUser.userType === role
  }

  hasAnyRole(roles) {
    return this.currentUser && roles.includes(this.currentUser.userType)
  }

  // Security features
  enableAntiCheat() {
    if (!window.db?.data?.settings?.security?.antiCheatEnabled) return

    // Disable right-click
    if (window.db.data.settings.security.blockRightClick) {
      document.addEventListener("contextmenu", (e) => e.preventDefault())
    }

    // Disable F12, Ctrl+Shift+I, etc.
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "C") ||
        (e.ctrlKey && e.key === "u")
      ) {
        e.preventDefault()
        this.showError("Acción no permitida durante la evaluación")
      }
    })

    // Disable text selection during tests
    if (
      document.getElementById("test-screen") &&
      !document.getElementById("test-screen").classList.contains("hidden")
    ) {
      document.body.style.userSelect = "none"
    }
  }

  disableAntiCheat() {
    document.body.style.userSelect = ""
  }
}

// Add CSS animations for messages
const style = document.createElement("style")
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .form-loading {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .form-loading button[type="submit"]::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
`
document.head.appendChild(style)

// Initialize global auth manager
window.authManager = new AuthManager()
