// Data Manager - Handles all JSON file operations and data management
class DataManager {
  constructor() {
    this.data = {
      estudiantes: [],
      docentes: [],
      pruebas: [],
      resultados: [],
      ajustes_generales_app: {
        version: "1.0.0",
        mantenimiento: false,
        colores: {
          primario: "#15803d",
          secundario: "#84cc16",
          fondo: "#ffffff",
        },
        administrador: {
          nombre: "Joel Valencia",
          codigo: "1115454214",
        },
        codigos_profesor: ["PROF2024", "TEACHER001", "DOCENTE123"],
      },
    }
    this.isOnline = navigator.onLine
    this.pendingSync = []
    this.initializeData()
  }

  // Initialize data from localStorage or create default data
  initializeData() {
    try {
      // Load existing data from localStorage
      const savedData = localStorage.getItem("evaluacion_data")
      if (savedData) {
        this.data = { ...this.data, ...JSON.parse(savedData) }
      } else {
        // Create default data structure
        this.createDefaultData()
      }

      // Save to localStorage
      this.saveToLocalStorage()
    } catch (error) {
      console.error("Error initializing data:", error)
      this.createDefaultData()
    }
  }

  createDefaultData() {
    // Create default admin user
    this.data.docentes.push({
      id: "admin_001",
      nombre: "Joel Valencia",
      codigo: "1115454214",
      password: "admin123",
      tipo: "administrador",
      fechaCreacion: new Date().toISOString(),
      activo: true,
    })

    // Create sample teacher
    this.data.docentes.push({
      id: "teacher_001",
      nombre: "María González",
      codigo: "PROF001",
      password: "teacher123",
      tipo: "docente",
      fechaCreacion: new Date().toISOString(),
      activo: true,
      materias: ["Matemáticas", "Física"],
    })

    // Create sample student
    this.data.estudiantes.push({
      id: "student_001",
      nombre: "Juan Pérez",
      codigo: "EST001",
      password: "student123",
      grado: "10A",
      fechaCreacion: new Date().toISOString(),
      activo: true,
      estadisticas: {
        pruebasRealizadas: 0,
        tiempoPromedio: 0,
        promedioPuntos: 0,
      },
    })
  }

  // Save data to localStorage
  saveToLocalStorage() {
    try {
      localStorage.setItem("evaluacion_data", JSON.stringify(this.data))
      localStorage.setItem("last_sync", new Date().toISOString())
    } catch (error) {
      console.error("Error saving to localStorage:", error)
    }
  }

  // Get all data
  getAllData() {
    return this.data
  }

  // User management
  createUser(userData) {
    const userId = this.generateId()
    const newUser = {
      id: userId,
      ...userData,
      fechaCreacion: new Date().toISOString(),
      activo: true,
    }

    if (userData.tipo === "estudiante") {
      newUser.estadisticas = {
        pruebasRealizadas: 0,
        tiempoPromedio: 0,
        promedioPuntos: 0,
      }
      this.data.estudiantes.push(newUser)
    } else if (userData.tipo === "docente") {
      newUser.materias = userData.materias || []
      this.data.docentes.push(newUser)
    }

    this.saveToLocalStorage()
    return newUser
  }

  authenticateUser(codigo, password, tipo) {
    let users = []

    if (tipo === "estudiante") {
      users = this.data.estudiantes
    } else if (tipo === "docente" || tipo === "administrador") {
      users = this.data.docentes
    }

    const user = users.find((u) => u.codigo === codigo && u.password === password && u.activo)

    if (user && tipo === "administrador") {
      // Verify admin credentials
      const adminData = this.data.ajustes_generales_app.administrador
      return user.codigo === adminData.codigo
    }

    return user || null
  }

  // Test management
  createTest(testData) {
    const testId = this.generateId()
    const newTest = {
      id: testId,
      codigo: this.generateTestCode(),
      ...testData,
      fechaCreacion: new Date().toISOString(),
      activo: true,
      estadisticas: {
        estudiantesInscritos: 0,
        estudiantesCompletados: 0,
        promedioTiempo: 0,
        promedioPuntos: 0,
      },
    }

    this.data.pruebas.push(newTest)
    this.saveToLocalStorage()
    return newTest
  }

  getTestsByTeacher(teacherId) {
    return this.data.pruebas.filter((test) => test.creadorId === teacherId)
  }

  getActiveTests() {
    const now = new Date()
    return this.data.pruebas.filter((test) => {
      const startDate = new Date(test.fechaInicio)
      const endDate = new Date(test.fechaFin)
      return test.activo && now >= startDate && now <= endDate
    })
  }

  // Results management
  saveTestResult(resultData) {
    const resultId = this.generateId()
    const newResult = {
      id: resultId,
      ...resultData,
      fechaCompletado: new Date().toISOString(),
    }

    this.data.resultados.push(newResult)
    this.updateTestStatistics(resultData.pruebaId)
    this.updateStudentStatistics(resultData.estudianteId, resultData)
    this.saveToLocalStorage()
    return newResult
  }

  getResultsByTest(testId) {
    return this.data.resultados.filter((result) => result.pruebaId === testId)
  }

  getResultsByStudent(studentId) {
    return this.data.resultados.filter((result) => result.estudianteId === studentId)
  }

  // Statistics updates
  updateTestStatistics(testId) {
    const test = this.data.pruebas.find((t) => t.id === testId)
    const results = this.getResultsByTest(testId)

    if (test && results.length > 0) {
      const completedResults = results.filter((r) => r.completado)
      test.estadisticas.estudiantesInscritos = results.length
      test.estadisticas.estudiantesCompletados = completedResults.length

      if (completedResults.length > 0) {
        const totalTime = completedResults.reduce((sum, r) => sum + r.tiempoTotal, 0)
        const totalPoints = completedResults.reduce((sum, r) => sum + r.puntosTotales, 0)

        test.estadisticas.promedioTiempo = totalTime / completedResults.length
        test.estadisticas.promedioPuntos = totalPoints / completedResults.length
      }
    }
  }

  updateStudentStatistics(studentId, resultData) {
    const student = this.data.estudiantes.find((s) => s.id === studentId)
    if (student && resultData.completado) {
      const studentResults = this.getResultsByStudent(studentId)
      const completedResults = studentResults.filter((r) => r.completado)

      student.estadisticas.pruebasRealizadas = completedResults.length

      if (completedResults.length > 0) {
        const totalTime = completedResults.reduce((sum, r) => sum + r.tiempoTotal, 0)
        const totalPoints = completedResults.reduce((sum, r) => sum + r.puntosTotales, 0)

        student.estadisticas.tiempoPromedio = totalTime / completedResults.length
        student.estadisticas.promedioPuntos = totalPoints / completedResults.length
      }
    }
  }

  // Utility methods
  generateId() {
    return "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  }

  generateTestCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase()
  }

  validateTeacherCode(code) {
    return this.data.ajustes_generales_app.codigos_profesor.includes(code)
  }

  // Offline/Online sync methods
  addToPendingSync(operation) {
    this.pendingSync.push({
      ...operation,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem("pending_sync", JSON.stringify(this.pendingSync))
  }

  async syncPendingOperations() {
    if (this.isOnline && this.pendingSync.length > 0) {
      // In a real implementation, this would sync with a server
      console.log("Syncing pending operations:", this.pendingSync)
      this.pendingSync = []
      localStorage.removeItem("pending_sync")
    }
  }

  setOnlineStatus(status) {
    this.isOnline = status
    if (status) {
      this.syncPendingOperations()
    }
  }
}

// Create global instance
window.dataManager = new DataManager()
