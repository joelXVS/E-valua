// Database Manager - Handles all data operations with embedded JSON data
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
      console.log("[v0] Initializing database...")

      // Check if we need to reset due to corruption
      const resetFlag = localStorage.getItem("evalua_reset_db")
      if (resetFlag) {
        console.log("[v0] Database reset requested, clearing corrupted data")
        this.clearCorruptedData()
        localStorage.removeItem("evalua_reset_db")
      }

      this.loadEmbeddedData()

      // Validate data integrity
      if (!this.validateDataIntegrity()) {
        console.warn("[v0] Data integrity check failed, reinitializing...")
        this.initializeEmptyData()
      }

      console.log("[v0] Database initialized successfully with embedded data")
    } catch (error) {
      console.error("[v0] Database initialization failed:", error)
      this.handleInitializationError(error)
    }
  }

  validateDataIntegrity() {
    try {
      // Check if all required data structures exist
      const requiredKeys = ["students", "teachers", "tests", "results", "settings"]
      for (const key of requiredKeys) {
        if (!this.data[key]) {
          console.error(`[v0] Missing required data: ${key}`)
          return false
        }
      }

      // Check if settings has required structure
      if (!this.data.settings.app || !this.data.settings.admin) {
        console.error("[v0] Settings data structure invalid")
        return false
      }

      return true
    } catch (error) {
      console.error("[v0] Data integrity validation failed:", error)
      return false
    }
  }

  clearCorruptedData() {
    try {
      const keysToRemove = [
        "evalua_data",
        "evalua_session",
        "evalua_lockout",
        "evalua_pending_sync",
        "evalua_last_save",
      ]

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key)
      })

      console.log("[v0] Corrupted data cleared")
    } catch (error) {
      console.error("[v0] Error clearing corrupted data:", error)
    }
  }

  handleInitializationError(error) {
    console.error("[v0] Database initialization error:", error)

    // Try to recover by initializing empty data
    try {
      this.initializeEmptyData()
      console.log("[v0] Database recovered with empty data")
    } catch (recoveryError) {
      console.error("[v0] Database recovery failed:", recoveryError)
      // Set flag for complete reset on next load
      localStorage.setItem("evalua_reset_db", "true")
      throw new Error("Database initialization failed completely")
    }
  }

  loadEmbeddedData() {
    // Embedded students data
    this.data.students = {
      students: [
        {
          id: "EST001",
          name: "Ana García",
          code: "2023001",
          password: "ana123",
          email: "ana.garcia@estudiante.edu",
          grade: "10°",
          createdAt: "2024-01-15T08:00:00.000Z",
          lastLogin: "2024-01-20T14:30:00.000Z",
          status: "active",
          testsCompleted: 3,
          averageScore: 85.5,
          averageTime: 1800,
        },
        {
          id: "EST002",
          name: "Carlos Rodríguez",
          code: "2023002",
          password: "carlos123",
          email: "carlos.rodriguez@estudiante.edu",
          grade: "11°",
          createdAt: "2024-01-15T08:00:00.000Z",
          lastLogin: "2024-01-19T16:45:00.000Z",
          status: "active",
          testsCompleted: 2,
          averageScore: 78.0,
          averageTime: 2100,
        },
        {
          id: "EST003",
          name: "María López",
          code: "2023003",
          password: "maria123",
          email: "maria.lopez@estudiante.edu",
          grade: "9°",
          createdAt: "2024-01-15T08:00:00.000Z",
          lastLogin: "2024-01-21T10:15:00.000Z",
          status: "active",
          testsCompleted: 4,
          averageScore: 92.3,
          averageTime: 1650,
        },
      ],
      metadata: {
        totalStudents: 3,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      },
    }

    // Embedded teachers data
    this.data.teachers = {
      teachers: [
        {
          id: "DOC001",
          name: "Prof. Elena Martínez",
          code: "PROF001",
          password: "elena2024",
          email: "elena.martinez@colegio.edu",
          subject: "Matemáticas",
          grades: ["9°", "10°", "11°"],
          teacherCode: "MAT2024",
          createdAt: "2024-01-10T08:00:00.000Z",
          lastLogin: "2024-01-21T07:30:00.000Z",
          status: "active",
          testsCreated: 5,
          studentsAssigned: 45,
        },
        {
          id: "DOC002",
          name: "Prof. Roberto Silva",
          code: "PROF002",
          password: "roberto2024",
          email: "roberto.silva@colegio.edu",
          subject: "Ciencias",
          grades: ["8°", "9°", "10°"],
          teacherCode: "CIE2024",
          createdAt: "2024-01-10T08:00:00.000Z",
          lastLogin: "2024-01-20T15:20:00.000Z",
          status: "active",
          testsCreated: 3,
          studentsAssigned: 38,
        },
      ],
      validTeacherCodes: ["MAT2024", "CIE2024", "ESP2024", "SOC2024", "ING2024"],
      metadata: {
        totalTeachers: 2,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      },
    }

    // Embedded tests data
    this.data.tests = {
      tests: [
        {
          id: "TEST001",
          title: "Álgebra Básica - Ecuaciones Lineales",
          description: "Evaluación sobre resolución de ecuaciones lineales y sistemas de ecuaciones",
          subject: "Matemáticas",
          grade: "9°",
          teacherId: "DOC001",
          code: "ALG001",
          timeLimit: 3600,
          totalQuestions: 15,
          pointsPerCorrect: 1,
          pointsPerIncorrect: 0,
          passingScore: 70,
          startDate: "2024-01-22T08:00:00.000Z",
          endDate: "2024-01-25T23:59:59.000Z",
          createdAt: "2024-01-20T10:00:00.000Z",
          status: "active",
          antiCheatEnabled: true,
          randomizeQuestions: true,
          showResults: true,
          allowReview: false,
          questions: [
            {
              id: "Q001",
              type: "multiple-choice",
              question: "¿Cuál es el valor de x en la ecuación 2x + 5 = 13?",
              options: ["x = 3", "x = 4", "x = 5", "x = 6"],
              correctAnswer: 1,
              points: 1,
              explanation: "2x + 5 = 13, entonces 2x = 8, por lo tanto x = 4",
            },
            {
              id: "Q002",
              type: "multiple-choice",
              question: "Si 3x - 7 = 14, ¿cuál es el valor de x?",
              options: ["x = 5", "x = 6", "x = 7", "x = 8"],
              correctAnswer: 2,
              points: 1,
              explanation: "3x - 7 = 14, entonces 3x = 21, por lo tanto x = 7",
            },
          ],
        },
        {
          id: "TEST002",
          title: "Biología - Célula y sus Organelos",
          description: "Evaluación sobre estructura celular y función de organelos",
          subject: "Ciencias",
          grade: "10°",
          teacherId: "DOC002",
          code: "BIO001",
          timeLimit: 2700,
          totalQuestions: 12,
          pointsPerCorrect: 1,
          pointsPerIncorrect: 0,
          passingScore: 75,
          startDate: "2024-01-23T09:00:00.000Z",
          endDate: "2024-01-26T18:00:00.000Z",
          createdAt: "2024-01-21T14:00:00.000Z",
          status: "active",
          antiCheatEnabled: true,
          randomizeQuestions: false,
          showResults: true,
          allowReview: true,
          questions: [
            {
              id: "Q003",
              type: "multiple-choice",
              question: "¿Cuál es la función principal del núcleo celular?",
              options: [
                "Producir energía",
                "Controlar las actividades celulares",
                "Sintetizar proteínas",
                "Almacenar agua",
              ],
              correctAnswer: 1,
              points: 1,
              explanation: "El núcleo controla todas las actividades celulares y contiene el material genético",
            },
          ],
        },
      ],
      metadata: {
        totalTests: 2,
        activeTests: 2,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      },
    }

    // Embedded results data
    this.data.results = {
      results: [
        {
          id: "RES001",
          testId: "TEST001",
          studentId: "EST001",
          score: 13,
          maxScore: 15,
          percentage: 86.7,
          timeSpent: 1650,
          passed: true,
          cheatingDetected: false,
          submittedAt: "2024-01-22T10:30:00.000Z",
          answers: [
            { questionId: "Q001", selectedAnswer: 1, correct: true, timeSpent: 45 },
            { questionId: "Q002", selectedAnswer: 2, correct: true, timeSpent: 38 },
          ],
          cheatingEvents: [],
        },
        {
          id: "RES002",
          testId: "TEST001",
          studentId: "EST002",
          score: 11,
          maxScore: 15,
          percentage: 73.3,
          timeSpent: 2100,
          passed: true,
          cheatingDetected: false,
          submittedAt: "2024-01-22T11:15:00.000Z",
          answers: [
            { questionId: "Q001", selectedAnswer: 1, correct: true, timeSpent: 65 },
            { questionId: "Q002", selectedAnswer: 1, correct: false, timeSpent: 55 },
          ],
          cheatingEvents: [],
        },
      ],
      statistics: {
        totalResults: 2,
        averageScore: 80.0,
        averageTime: 1875,
        passRate: 100,
        cheatingIncidents: 0,
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      },
    }

    // Embedded settings data
    this.data.settings = {
      app: {
        name: "E-valua",
        version: "1.0.0-beta",
        maintenance: false,
        maxStudents: 1600,
      },
      admin: {
        name: "Joel Valencia",
        code: "1115454214",
        password: "admin2024",
      },
      theme: {
        primaryColor: "#667eea",
        secondaryColor: "#764ba2",
      },
      security: {
        maxLoginAttempts: 3,
        antiCheatEnabled: true,
        blockRightClick: true,
      },
      limits: {
        maxQuestionsPerTest: 50,
        maxTimePerTest: 7200,
      },
      features: {
        offlineMode: true,
        dataSync: true,
      },
    }

    // Try to load from localStorage if available (for persistence)
    const savedData = localStorage.getItem("evalua_data")
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)
        if (this.isValidSavedData(parsedData)) {
          // Merge saved data with embedded data
          this.data = { ...this.data, ...parsedData }
          console.log("[v0] Loaded saved data from localStorage")
        } else {
          console.warn("[v0] Saved data is invalid, using embedded data")
          localStorage.removeItem("evalua_data") // Remove invalid data
        }
      } catch (error) {
        console.warn("[v0] Error loading saved data, using embedded data:", error)
        localStorage.removeItem("evalua_data") // Remove corrupted data
      }
    }
  }

  isValidSavedData(data) {
    try {
      // Check if data has required structure
      if (!data || typeof data !== "object") return false

      const requiredKeys = ["students", "teachers", "tests", "results", "settings"]
      for (const key of requiredKeys) {
        if (!data[key]) return false
      }

      // Check if settings has admin data
      if (!data.settings.admin || !data.settings.admin.code) return false

      return true
    } catch (error) {
      console.error("[v0] Error validating saved data:", error)
      return false
    }
  }

  getEmptyStructure(type) {
    const structures = {
      students: { students: [], metadata: { totalStudents: 0, lastUpdated: new Date().toISOString(), version: "1.0" } },
      teachers: {
        teachers: [],
        validTeacherCodes: ["MAT2024", "CIE2024", "ESP2024", "SOC2024", "ING2024"],
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
        app: { name: "E-valua", version: "1.0.0-beta", maintenance: false, maxStudents: 1600 },
        admin: { name: "Joel Valencia", code: "1115454214", password: "admin2024" },
        theme: { primaryColor: "#667eea", secondaryColor: "#764ba2" },
        security: { maxLoginAttempts: 3, antiCheatEnabled: true, blockRightClick: true },
        limits: { maxQuestionsPerTest: 50, maxTimePerTest: 7200 },
        features: { offlineMode: true, dataSync: true },
      },
    }
    return structures[type] || {}
  }

  initializeEmptyData() {
    console.log("[v0] Initializing empty data structures")
    Object.keys(this.data).forEach((key) => {
      if (!this.data[key]) {
        this.data[key] = this.getEmptyStructure(key)
      }
    })

    if (!this.data.settings || !this.data.settings.admin) {
      this.data.settings = this.getEmptyStructure("settings")
    }
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

      this.saveToLocalStorage()

      if (this.isOnline) {
        await this.syncToServer()
      } else {
        this.addToPendingSync()
      }
    } catch (error) {
      console.error("[v0] Error saving data:", error)
      try {
        this.saveToLocalStorage()
      } catch (localError) {
        console.error("[v0] Critical: Could not save to localStorage:", localError)
      }
    }
  }

  saveToLocalStorage() {
    try {
      if (!this.validateDataIntegrity()) {
        console.error("[v0] Cannot save invalid data to localStorage")
        return false
      }

      const dataString = JSON.stringify(this.data)
      localStorage.setItem("evalua_data", dataString)
      localStorage.setItem("evalua_last_save", new Date().toISOString())
      return true
    } catch (error) {
      console.error("[v0] Error saving to localStorage:", error)

      if (error.name === "QuotaExceededError") {
        console.warn("[v0] localStorage quota exceeded, clearing old data")
        this.clearOldLocalStorageData()
        // Try saving again
        try {
          localStorage.setItem("evalua_data", JSON.stringify(this.data))
          return true
        } catch (retryError) {
          console.error("[v0] Still cannot save after cleanup:", retryError)
        }
      }
      return false
    }
  }

  clearOldLocalStorageData() {
    try {
      const keysToRemove = ["evalua_error_logs", "evalua_pending_sync", "syncQueue"]

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key)
      })

      console.log("[v0] Cleared old localStorage data")
    } catch (error) {
      console.error("[v0] Error clearing old localStorage data:", error)
    }
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
