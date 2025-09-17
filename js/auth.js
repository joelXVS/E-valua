// Authentication Manager - Handles user authentication and session management
class AuthManager {
  constructor() {
    this.currentUser = null
    this.sessionTimeout = 30 * 60 * 1000 // 30 minutes
    this.sessionTimer = null
    this.init()
  }

  init() {
    this.setupSessionManagement()
    this.loadSavedSession()
  }

  setupSessionManagement() {
    // Reset session timer on user activity
    const resetTimer = () => {
      this.resetSessionTimer()
    }

    document.addEventListener("click", resetTimer)
    document.addEventListener("keypress", resetTimer)
    document.addEventListener("scroll", resetTimer)
    document.addEventListener("mousemove", resetTimer)
  }

  resetSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer)
    }

    if (this.currentUser) {
      this.sessionTimer = setTimeout(() => {
        this.handleSessionTimeout()
      }, this.sessionTimeout)
    }
  }

  handleSessionTimeout() {
    this.showAlert("Tu sesión ha expirado por inactividad", "warning")
    this.logout()
  }

  loadSavedSession() {
    const savedUser = localStorage.getItem("current_user")
    const sessionStart = localStorage.getItem("session_start")

    if (savedUser && sessionStart) {
      const sessionAge = Date.now() - Number.parseInt(sessionStart)

      if (sessionAge < this.sessionTimeout) {
        try {
          this.currentUser = JSON.parse(savedUser)
          this.resetSessionTimer()
          return this.currentUser
        } catch (error) {
          console.error("Error loading saved session:", error)
          this.clearSession()
        }
      } else {
        this.clearSession()
      }
    }

    return null
  }

  async login(userCode, password, userType) {
    try {
      // Validate input
      if (!userCode || !password || !userType) {
        throw new Error("Todos los campos son requeridos")
      }

      // Check maintenance mode
      const settings = window.dataManager.getAllData().ajustes_generales_app
      if (settings.mantenimiento && userType !== "administrador") {
        throw new Error("El sistema está en mantenimiento. Solo los administradores pueden acceder.")
      }

      // Authenticate user
      const user = window.dataManager.authenticateUser(userCode, password, userType)

      if (!user) {
        // Log failed attempt
        this.logFailedAttempt(userCode, userType)
        throw new Error("Credenciales incorrectas")
      }

      // Check if user is active
      if (!user.activo) {
        throw new Error("Tu cuenta está desactivada. Contacta al administrador.")
      }

      // Set current user
      this.currentUser = { ...user, tipo: userType }

      // Save session
      this.saveSession()

      // Update last login
      this.updateLastLogin(user.id, userType)

      // Start session timer
      this.resetSessionTimer()

      return this.currentUser
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  async register(userData) {
    try {
      // Validate required fields
      const requiredFields = ["nombre", "codigo", "password", "tipo"]
      for (const field of requiredFields) {
        if (!userData[field]) {
          throw new Error(`El campo ${field} es requerido`)
        }
      }

      // Validate password strength
      if (!this.validatePassword(userData.password)) {
        throw new Error("La contraseña debe tener al menos 6 caracteres")
      }

      // Validate teacher code if user is a teacher
      if (userData.tipo === "docente") {
        if (!userData.teacherCode || !window.dataManager.validateTeacherCode(userData.teacherCode)) {
          throw new Error("Código de profesor inválido")
        }
      }

      // Check if user code already exists
      if (this.userCodeExists(userData.codigo)) {
        throw new Error("El código de usuario ya existe")
      }

      // Create user
      const newUser = window.dataManager.createUser({
        nombre: userData.nombre,
        codigo: userData.codigo,
        password: userData.password, // In production, this should be hashed
        tipo: userData.tipo,
        grado: userData.grado || null,
        materias: userData.materias || [],
      })

      // Log registration
      this.logUserAction(newUser.id, "registro", "Usuario registrado exitosamente")

      return newUser
    } catch (error) {
      console.error("Registration error:", error)
      throw error
    }
  }

  logout() {
    if (this.currentUser) {
      this.logUserAction(this.currentUser.id, "logout", "Usuario cerró sesión")
    }

    this.currentUser = null
    this.clearSession()

    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer)
      this.sessionTimer = null
    }

    // Redirect to login
    if (window.app) {
      window.app.showScreen("login")
    }
  }

  saveSession() {
    if (this.currentUser) {
      localStorage.setItem("current_user", JSON.stringify(this.currentUser))
      localStorage.setItem("session_start", Date.now().toString())
    }
  }

  clearSession() {
    localStorage.removeItem("current_user")
    localStorage.removeItem("session_start")
  }

  // Validation methods
  validatePassword(password) {
    return password && password.length >= 6
  }

  userCodeExists(codigo) {
    const allData = window.dataManager.getAllData()
    const existingUser = [...allData.estudiantes, ...allData.docentes].find((u) => u.codigo === codigo)
    return !!existingUser
  }

  // Security methods
  logFailedAttempt(userCode, userType) {
    const attempt = {
      userCode,
      userType,
      timestamp: new Date().toISOString(),
      ip: "localhost", // In production, get real IP
      success: false,
    }

    // Store failed attempts (in production, send to server)
    const failedAttempts = JSON.parse(localStorage.getItem("failed_attempts") || "[]")
    failedAttempts.push(attempt)

    // Keep only last 100 attempts
    if (failedAttempts.length > 100) {
      failedAttempts.splice(0, failedAttempts.length - 100)
    }

    localStorage.setItem("failed_attempts", JSON.stringify(failedAttempts))
  }

  logUserAction(userId, action, details) {
    const logEntry = {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      ip: "localhost",
    }

    // Store user actions (in production, send to server)
    const userLogs = JSON.parse(localStorage.getItem("user_logs") || "[]")
    userLogs.push(logEntry)

    // Keep only last 1000 entries
    if (userLogs.length > 1000) {
      userLogs.splice(0, userLogs.length - 1000)
    }

    localStorage.setItem("user_logs", JSON.stringify(userLogs))
  }

  updateLastLogin(userId, userType) {
    const allData = window.dataManager.getAllData()
    const users = userType === "estudiante" ? allData.estudiantes : allData.docentes

    const user = users.find((u) => u.id === userId)
    if (user) {
      user.ultimoAcceso = new Date().toISOString()
      window.dataManager.saveToLocalStorage()
    }
  }

  // Permission methods
  hasPermission(permission) {
    if (!this.currentUser) return false

    const permissions = this.getUserPermissions(this.currentUser.tipo)
    return permissions.includes(permission)
  }

  getUserPermissions(userType) {
    const permissionMap = {
      estudiante: ["view_available_tests", "take_test", "view_own_results", "view_own_profile"],
      docente: [
        "create_test",
        "edit_own_tests",
        "view_own_tests",
        "view_test_results",
        "export_results",
        "view_student_results",
      ],
      administrador: [
        "manage_users",
        "view_all_tests",
        "view_all_results",
        "system_settings",
        "view_logs",
        "export_data",
        "maintenance_mode",
      ],
    }

    return permissionMap[userType] || []
  }

  requirePermission(permission) {
    if (!this.hasPermission(permission)) {
      throw new Error("No tienes permisos para realizar esta acción")
    }
  }

  // Password management
  changePassword(currentPassword, newPassword) {
    if (!this.currentUser) {
      throw new Error("No hay usuario autenticado")
    }

    if (!this.validatePassword(newPassword)) {
      throw new Error("La nueva contraseña debe tener al menos 6 caracteres")
    }

    // Verify current password
    const user = window.dataManager.authenticateUser(this.currentUser.codigo, currentPassword, this.currentUser.tipo)

    if (!user) {
      throw new Error("Contraseña actual incorrecta")
    }

    // Update password
    const allData = window.dataManager.getAllData()
    const users = this.currentUser.tipo === "estudiante" ? allData.estudiantes : allData.docentes

    const userToUpdate = users.find((u) => u.id === this.currentUser.id)
    if (userToUpdate) {
      userToUpdate.password = newPassword // In production, hash this
      userToUpdate.passwordChanged = new Date().toISOString()
      window.dataManager.saveToLocalStorage()

      this.logUserAction(this.currentUser.id, "password_change", "Contraseña cambiada")
      return true
    }

    throw new Error("Error al actualizar la contraseña")
  }

  // Account management
  updateProfile(profileData) {
    if (!this.currentUser) {
      throw new Error("No hay usuario autenticado")
    }

    const allData = window.dataManager.getAllData()
    const users = this.currentUser.tipo === "estudiante" ? allData.estudiantes : allData.docentes

    const userToUpdate = users.find((u) => u.id === this.currentUser.id)
    if (userToUpdate) {
      // Update allowed fields
      const allowedFields = ["nombre", "grado", "materias"]
      allowedFields.forEach((field) => {
        if (profileData[field] !== undefined) {
          userToUpdate[field] = profileData[field]
        }
      })

      userToUpdate.profileUpdated = new Date().toISOString()
      window.dataManager.saveToLocalStorage()

      // Update current user session
      this.currentUser = { ...this.currentUser, ...profileData }
      this.saveSession()

      this.logUserAction(this.currentUser.id, "profile_update", "Perfil actualizado")
      return true
    }

    throw new Error("Error al actualizar el perfil")
  }

  // Utility methods
  getCurrentUser() {
    return this.currentUser
  }

  isAuthenticated() {
    return !!this.currentUser
  }

  getUserRole() {
    return this.currentUser ? this.currentUser.tipo : null
  }

  showAlert(message, type = "info") {
    if (window.app && window.app.showAlert) {
      window.app.showAlert(message, type)
    } else {
      console.log(`${type.toUpperCase()}: ${message}`)
    }
  }
}

// Create global instance
window.authManager = new AuthManager()
