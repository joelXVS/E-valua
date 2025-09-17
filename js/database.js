// Database Manager - Handles all JSON file operations
class DatabaseManager {
  constructor() {
    this.data = {
      students: null,
      teachers: null,
      tests: null,
      results: null,
      settings: null,
    }
    this.isOnline = navigator.onLine
    this.pendingSync = []

    // Listen for online/offline events
    window.addEventListener("online", () => this.handleOnlineStatus(true))
    window.addEventListener("offline", () => this.handleOnlineStatus(false))

    this.init()
  }

  async init() {
    try {
      await this.loadAllData()
      console.log("[v0] Database initialized successfully")
    } catch (error) {
      console.error("[v0] Database initialization failed:", error)
      this.initializeEmptyData()
    }
  }

  async loadAllData() {
    const files = [
      { key: "students", path: "data/estudiantes.json" },
      { key: "teachers", path: "data/docentes.json" },
      { key: "tests", path: "data/pruebas.json" },
      { key: "results", path: "data/resultados.json" },
      { key: "settings", path: "data/ajustes_generales_app.json" },
    ]

    for (const file of files) {
      try {
        const response = await fetch(file.path)
        if (response.ok) {
          this.data[file.key] = await response.json()
        } else {
          console.warn(`[v0] Could not load ${file.path}, using empty data`)
          this.data[file.key] = this.getEmptyStructure(file.key)
        }
      } catch (error) {
        console.warn(`[v0] Error loading ${file.path}:`, error)
        this.data[file.key] = this.getEmptyStructure(file.key)
      }
    }
  }

  getEmptyStructure(type) {
    const structures = {
      students: { students: [], metadata: { totalStudents: 0, lastUpdated: new Date().toISOString(), version: "1.0" } },
      teachers: {
        teachers: [],
        validTeacherCodes: [],
        metadata: { totalTeachers: 0, lastUpdated: new Date().toISOString(), version: "1.0" },
      },
      tests: {
        tests: [],
        metadata: { totalTests: 0, activeTests: 0, lastUpdated: new Date().toISOString(), version: "1.0" },
      },
      results: {
        results: [],
        statistics: { totalResults: 0, averageScore: 0, averageTime: 0, passRate: 0, cheatingIncidents: 0 },
        metadata: { lastUpdated: new Date().toISOString(), version: "1.0" },
      },
      settings: {
        app: { name: "E-valua", version: "1.0.0-beta", maintenance: false },
        admin: { name: "Joel Valencia", code: "1115454214", password: "admin2024" },
        theme: { primaryColor: "#667eea", secondaryColor: "#764ba2" },
        security: { maxLoginAttempts: 3, antiCheatEnabled: true },
        features: { offlineMode: true, dataSync: true },
      },
    }
    return structures[type] || {}
  }

  initializeEmptyData() {
    Object.keys(this.data).forEach((key) => {
      if (!this.data[key]) {
        this.data[key] = this.getEmptyStructure(key)
      }
    })
  }

  // Authentication methods
  async authenticateUser(code, password, userType) {
    let userData = null

    switch (userType) {
      case "student":
        userData = this.data.students.students.find((s) => s.code === code && s.password === password)
        break
      case "teacher":
        userData = this.data.teachers.teachers.find((t) => t.code === code && t.password === password)
        break
      case "admin":
        if (code === this.data.settings.admin.code && password === this.data.settings.admin.password) {
          userData = { ...this.data.settings.admin, userType: "admin" }
        }
        break
    }

    if (userData) {
      userData.userType = userType
      userData.lastLogin = new Date().toISOString()
      await this.saveData()
      return userData
    }

    return null
  }

  async registerUser(userData) {
    const { userType, teacherCode } = userData

    // Validate teacher code for teachers
    if (userType === "teacher") {
      if (!this.data.teachers.validTeacherCodes.includes(teacherCode)) {
        throw new Error("Código de profesor inválido")
      }
    }

    // Check if user already exists
    const existingUser = this.findUserByCode(userData.code)
    if (existingUser) {
      throw new Error("El código de usuario ya existe")
    }

    // Create new user
    const newUser = {
      id: this.generateId(userType),
      name: userData.name,
      code: userData.code,
      password: userData.password,
      email: userData.email || "",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      status: "active",
    }

    if (userType === "student") {
      newUser.grade = userData.grade || ""
      newUser.testsCompleted = 0
      newUser.averageScore = 0
      newUser.averageTime = 0
      this.data.students.students.push(newUser)
      this.data.students.metadata.totalStudents++
    } else if (userType === "teacher") {
      newUser.subject = userData.subject || ""
      newUser.grades = userData.grades || []
      newUser.teacherCode = teacherCode
      newUser.testsCreated = 0
      newUser.studentsAssigned = 0
      this.data.teachers.teachers.push(newUser)
      this.data.teachers.metadata.totalTeachers++
    }

    await this.saveData()
    return newUser
  }

  findUserByCode(code) {
    const student = this.data.students.students.find((s) => s.code === code)
    if (student) return { ...student, userType: "student" }

    const teacher = this.data.teachers.teachers.find((t) => t.code === code)
    if (teacher) return { ...teacher, userType: "teacher" }

    if (code === this.data.settings.admin.code) {
      return { ...this.data.settings.admin, userType: "admin" }
    }

    return null
  }

  generateId(type) {
    const prefix = {
      student: "EST",
      teacher: "DOC",
      test: "TEST",
      result: "RES",
    }

    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substr(2, 3).toUpperCase()
    return `${prefix[type] || "GEN"}${timestamp}${random}`
  }

  // Test management
  async createTest(testData) {
    const newTest = {
      id: this.generateId("test"),
      ...testData,
      createdAt: new Date().toISOString(),
      status: "active",
    }

    this.data.tests.tests.push(newTest)
    this.data.tests.metadata.totalTests++
    this.data.tests.metadata.activeTests++

    await this.saveData()
    return newTest
  }

  async updateTest(testId, updates) {
    const testIndex = this.data.tests.tests.findIndex((t) => t.id === testId)
    if (testIndex === -1) throw new Error("Prueba no encontrada")

    this.data.tests.tests[testIndex] = { ...this.data.tests.tests[testIndex], ...updates }
    await this.saveData()
    return this.data.tests.tests[testIndex]
  }

  async deleteTest(testId) {
    const testIndex = this.data.tests.tests.findIndex((t) => t.id === testId)
    if (testIndex === -1) throw new Error("Prueba no encontrada")

    this.data.tests.tests.splice(testIndex, 1)
    this.data.tests.metadata.totalTests--

    await this.saveData()
  }

  getTestsForStudent(studentId) {
    const now = new Date()
    return this.data.tests.tests.filter((test) => {
      const startDate = new Date(test.startDate)
      const endDate = new Date(test.endDate)
      return test.status === "active" && now >= startDate && now <= endDate
    })
  }

  getTestsForTeacher(teacherId) {
    return this.data.tests.tests.filter((test) => test.teacherId === teacherId)
  }

  // Results management
  async saveTestResult(resultData) {
    const newResult = {
      id: this.generateId("result"),
      ...resultData,
      submittedAt: new Date().toISOString(),
    }

    this.data.results.results.push(newResult)
    this.updateResultStatistics()

    await this.saveData()
    return newResult
  }

  updateResultStatistics() {
    const results = this.data.results.results
    const stats = this.data.results.statistics

    stats.totalResults = results.length

    if (results.length > 0) {
      stats.averageScore = results.reduce((sum, r) => sum + r.percentage, 0) / results.length
      stats.averageTime = results.reduce((sum, r) => sum + r.timeSpent, 0) / results.length
      stats.passRate = (results.filter((r) => r.passed).length / results.length) * 100
      stats.cheatingIncidents = results.filter((r) => r.cheatingDetected).length
    }
  }

  getResultsForTest(testId) {
    return this.data.results.results.filter((r) => r.testId === testId)
  }

  getResultsForStudent(studentId) {
    return this.data.results.results.filter((r) => r.studentId === studentId)
  }

  // Data persistence
  async saveData() {
    try {
      // Update timestamps
      Object.keys(this.data).forEach((key) => {
        if (this.data[key] && this.data[key].metadata) {
          this.data[key].metadata.lastUpdated = new Date().toISOString()
        }
      })

      if (this.isOnline) {
        await this.syncToServer()
      } else {
        this.saveToLocalStorage()
        this.addToPendingSync()
      }
    } catch (error) {
      console.error("[v0] Error saving data:", error)
      this.saveToLocalStorage()
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem("evalua_data", JSON.stringify(this.data))
      localStorage.setItem("evalua_last_save", new Date().toISOString())
    } catch (error) {
      console.error("[v0] Error saving to localStorage:", error)
    }
  }

  loadFromLocalStorage() {
    try {
      const savedData = localStorage.getItem("evalua_data")
      if (savedData) {
        this.data = JSON.parse(savedData)
        return true
      }
    } catch (error) {
      console.error("[v0] Error loading from localStorage:", error)
    }
    return false
  }

  addToPendingSync() {
    const syncItem = {
      timestamp: new Date().toISOString(),
      data: JSON.stringify(this.data),
    }
    this.pendingSync.push(syncItem)
    localStorage.setItem("evalua_pending_sync", JSON.stringify(this.pendingSync))
  }

  async syncToServer() {
    // In a real implementation, this would sync with a server
    // For now, we'll simulate server sync
    console.log("[v0] Syncing data to server...")

    // Clear pending sync items
    this.pendingSync = []
    localStorage.removeItem("evalua_pending_sync")

    return true
  }

  handleOnlineStatus(isOnline) {
    this.isOnline = isOnline
    const indicator = document.getElementById("offline-indicator")

    if (isOnline) {
      indicator.classList.add("hidden")
      this.syncPendingData()
    } else {
      indicator.classList.remove("hidden")
    }
  }

  async syncPendingData() {
    if (this.pendingSync.length > 0) {
      try {
        await this.syncToServer()
        console.log("[v0] Pending data synced successfully")
      } catch (error) {
        console.error("[v0] Error syncing pending data:", error)
      }
    }
  }

  // Utility methods
  exportData(format = "json") {
    const dataToExport = {
      ...this.data,
      exportedAt: new Date().toISOString(),
      version: this.data.settings.app.version,
    }

    if (format === "json") {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `evalua_backup_${new Date().toISOString().split("T")[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result)
          this.data = importedData
          this.saveData()
          resolve(true)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error("Error reading file"))
      reader.readAsText(file)
    })
  }
}

// Initialize global database instance
window.db = new DatabaseManager()
