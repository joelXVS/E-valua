// Dashboard Manager - Handles dashboard functionality and statistics
class DashboardManager {
  constructor() {
    this.currentUser = null
    this.currentSection = "overview"
    this.refreshInterval = null

    this.init()
  }

  init() {
    this.setupEventListeners()
  }

  setupEventListeners() {
    // Navigation menu
    const navLinks = document.querySelectorAll(".nav-link")
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault()
        const section = e.target.getAttribute("data-section")
        this.showSection(section)
      })
    })

    // Auto-refresh dashboard every 30 seconds
    this.refreshInterval = setInterval(() => {
      if (this.currentSection === "overview") {
        this.loadOverviewStats()
      }
    }, 30000)
  }

  async initialize(user) {
    this.currentUser = user
    console.log("[v0] Initializing dashboard for user:", user.name)

    // Show appropriate navigation items based on user role
    this.setupRoleBasedNavigation()

    // Load initial section
    this.showSection("overview")
  }

  setupRoleBasedNavigation() {
    const userType = this.currentUser.userType

    // Hide/show navigation items based on role
    const studentOnlyItems = document.querySelectorAll(".student-only")
    const teacherOnlyItems = document.querySelectorAll(".teacher-only")
    const adminOnlyItems = document.querySelectorAll(".admin-only")

    studentOnlyItems.forEach((item) => {
      item.style.display = userType === "student" ? "block" : "none"
    })

    teacherOnlyItems.forEach((item) => {
      item.style.display = ["teacher", "admin"].includes(userType) ? "block" : "none"
    })

    adminOnlyItems.forEach((item) => {
      item.style.display = userType === "admin" ? "block" : "none"
    })
  }

  showSection(sectionName) {
    // Update navigation
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active")
    })

    const activeLink = document.querySelector(`[data-section="${sectionName}"]`)
    if (activeLink) {
      activeLink.classList.add("active")
    }

    // Hide all sections
    document.querySelectorAll(".dashboard-section").forEach((section) => {
      section.classList.remove("active")
    })

    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`)
    if (targetSection) {
      targetSection.classList.add("active")
      this.currentSection = sectionName
    }

    // Load section content
    this.loadSectionContent(sectionName)
  }

  async loadSectionContent(sectionName) {
    try {
      switch (sectionName) {
        case "overview":
          await this.loadOverviewStats()
          break
        case "create-test":
          await this.loadTestCreator()
          break
        case "my-tests":
          await this.loadMyTests()
          break
        case "available-tests":
          await this.loadAvailableTests()
          break
        case "results":
          await this.loadResults()
          break
        case "users":
          await this.loadUsersManagement()
          break
        case "settings":
          await this.loadSettings()
          break
        default:
          console.warn("[v0] Unknown section:", sectionName)
      }
    } catch (error) {
      console.error("[v0] Error loading section content:", error)
      this.showError("Error al cargar el contenido")
    }
  }

  async loadOverviewStats() {
    const statsGrid = document.getElementById("stats-grid")
    if (!statsGrid) return

    const userType = this.currentUser.userType
    let statsHTML = ""

    try {
      if (userType === "student") {
        statsHTML = await this.generateStudentStats()
      } else if (userType === "teacher") {
        statsHTML = await this.generateTeacherStats()
      } else if (userType === "admin") {
        statsHTML = await this.generateAdminStats()
      }

      statsGrid.innerHTML = statsHTML
    } catch (error) {
      console.error("[v0] Error generating stats:", error)
      statsGrid.innerHTML = "<p>Error al cargar las estadísticas</p>"
    }
  }

  async generateStudentStats() {
    const studentResults = window.db.getResultsForStudent(this.currentUser.id)
    const availableTests = window.db.getTestsForStudent(this.currentUser.id)

    const completedTests = studentResults.length
    const averageScore =
      completedTests > 0 ? studentResults.reduce((sum, r) => sum + r.percentage, 0) / completedTests : 0
    const averageTime =
      completedTests > 0 ? studentResults.reduce((sum, r) => sum + r.timeSpent, 0) / completedTests : 0
    const pendingTests = availableTests.length

    return `
      <div class="stat-card">
        <h3>${completedTests}</h3>
        <p>Pruebas Completadas</p>
      </div>
      <div class="stat-card ${averageScore >= 70 ? "positive" : averageScore >= 50 ? "warning" : "negative"}">
        <h3>${averageScore.toFixed(1)}%</h3>
        <p>Promedio General</p>
      </div>
      <div class="stat-card">
        <h3>${this.formatTime(Math.round(averageTime))}</h3>
        <p>Tiempo Promedio</p>
      </div>
      <div class="stat-card ${pendingTests > 0 ? "warning" : ""}">
        <h3>${pendingTests}</h3>
        <p>Pruebas Pendientes</p>
      </div>
      <div class="stat-card">
        <h3>${studentResults.filter((r) => r.passed).length}</h3>
        <p>Pruebas Aprobadas</p>
      </div>
      <div class="stat-card ${studentResults.some((r) => r.cheatingDetected) ? "negative" : "positive"}">
        <h3>${studentResults.filter((r) => r.cheatingDetected).length}</h3>
        <p>Incidentes de Trampa</p>
      </div>
    `
  }

  async generateTeacherStats() {
    const teacherTests = window.db.getTestsForTeacher(this.currentUser.id)
    const allResults = window.db.data.results.results
    const teacherResults = allResults.filter((r) => teacherTests.some((t) => t.id === r.testId))

    const activeTests = teacherTests.filter((t) => t.status === "active").length
    const totalStudents = new Set(teacherResults.map((r) => r.studentId)).size
    const averageScore =
      teacherResults.length > 0 ? teacherResults.reduce((sum, r) => sum + r.percentage, 0) / teacherResults.length : 0
    const passRate =
      teacherResults.length > 0 ? (teacherResults.filter((r) => r.passed).length / teacherResults.length) * 100 : 0

    return `
      <div class="stat-card">
        <h3>${teacherTests.length}</h3>
        <p>Pruebas Creadas</p>
      </div>
      <div class="stat-card ${activeTests > 0 ? "positive" : "warning"}">
        <h3>${activeTests}</h3>
        <p>Pruebas Activas</p>
      </div>
      <div class="stat-card">
        <h3>${totalStudents}</h3>
        <p>Estudiantes Únicos</p>
      </div>
      <div class="stat-card ${averageScore >= 70 ? "positive" : averageScore >= 50 ? "warning" : "negative"}">
        <h3>${averageScore.toFixed(1)}%</h3>
        <p>Promedio de Clase</p>
      </div>
      <div class="stat-card ${passRate >= 70 ? "positive" : passRate >= 50 ? "warning" : "negative"}">
        <h3>${passRate.toFixed(1)}%</h3>
        <p>Tasa de Aprobación</p>
      </div>
      <div class="stat-card">
        <h3>${teacherResults.length}</h3>
        <p>Total Evaluaciones</p>
      </div>
    `
  }

  async generateAdminStats() {
    const allStudents = window.db.data.students.students
    const allTeachers = window.db.data.teachers.teachers
    const allTests = window.db.data.tests.tests
    const allResults = window.db.data.results.results

    const activeStudents = allStudents.filter((s) => s.status === "active").length
    const activeTeachers = allTeachers.filter((t) => t.status === "active").length
    const activeTests = allTests.filter((t) => t.status === "active").length
    const systemUsage = allResults.length > 0 ? (allResults.length / (allStudents.length * allTests.length)) * 100 : 0

    return `
      <div class="stat-card">
        <h3>${activeStudents}</h3>
        <p>Estudiantes Activos</p>
      </div>
      <div class="stat-card">
        <h3>${activeTeachers}</h3>
        <p>Docentes Activos</p>
      </div>
      <div class="stat-card">
        <h3>${activeTests}</h3>
        <p>Pruebas Activas</p>
      </div>
      <div class="stat-card">
        <h3>${allResults.length}</h3>
        <p>Evaluaciones Totales</p>
      </div>
      <div class="stat-card ${systemUsage >= 50 ? "positive" : systemUsage >= 25 ? "warning" : "negative"}">
        <h3>${systemUsage.toFixed(1)}%</h3>
        <p>Uso del Sistema</p>
      </div>
      <div class="stat-card ${allResults.filter((r) => r.cheatingDetected).length === 0 ? "positive" : "warning"}">
        <h3>${allResults.filter((r) => r.cheatingDetected).length}</h3>
        <p>Incidentes de Seguridad</p>
      </div>
    `
  }

  async loadTestCreator() {
    const container = document.getElementById("test-creator-container")
    if (!container) return

    if (window.testCreator) {
      window.testCreator.render(container)
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Creador de Pruebas</h3>
          <p>El módulo de creación de pruebas se está cargando...</p>
          <button class="btn-primary" onclick="location.reload()">Recargar</button>
        </div>
      `
    }
  }

  async loadMyTests() {
    const container = document.getElementById("tests-list")
    if (!container) return

    const tests = window.db.getTestsForTeacher(this.currentUser.id)

    if (tests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No hay pruebas creadas</h3>
          <p>Comience creando su primera prueba</p>
          <button class="btn-primary" onclick="window.dashboardManager.showSection('create-test')">
            Crear Primera Prueba
          </button>
        </div>
      `
      return
    }

    let testsHTML = `
      <div class="search-filter-bar">
        <input type="text" class="search-input" placeholder="Buscar pruebas..." id="tests-search">
        <select class="filter-select" id="tests-filter">
          <option value="">Todas las pruebas</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
          <option value="completed">Completadas</option>
        </select>
        <button class="btn-primary" onclick="window.dashboardManager.showSection('create-test')">
          Nueva Prueba
        </button>
      </div>
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Código</th>
              <th>Estado</th>
              <th>Estudiantes</th>
              <th>Promedio</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `

    tests.forEach((test) => {
      const results = window.db.getResultsForTest(test.id)
      const averageScore = results.length > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length : 0

      testsHTML += `
        <tr>
          <td>${test.title}</td>
          <td><code>${test.code}</code></td>
          <td>
            <span class="status-badge status-${test.status}">
              ${test.status === "active" ? "Activa" : "Inactiva"}
            </span>
          </td>
          <td>${results.length}</td>
          <td>${averageScore.toFixed(1)}%</td>
          <td>${this.formatDate(test.createdAt)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-small btn-view" onclick="window.dashboardManager.viewTestResults('${test.id}')">
                Ver
              </button>
              <button class="btn-small btn-edit" onclick="window.dashboardManager.editTest('${test.id}')">
                Editar
              </button>
              <button class="btn-small btn-delete" onclick="window.dashboardManager.deleteTest('${test.id}')">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `
    })

    testsHTML += `
          </tbody>
        </table>
      </div>
    `

    container.innerHTML = testsHTML

    // Setup search and filter
    this.setupTestsSearchAndFilter()
  }

  async loadAvailableTests() {
    const container = document.getElementById("available-tests-list")
    if (!container) return

    const tests = window.db.getTestsForStudent(this.currentUser.id)
    const studentResults = window.db.getResultsForStudent(this.currentUser.id)

    if (tests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No hay pruebas disponibles</h3>
          <p>No hay pruebas programadas en este momento</p>
        </div>
      `
      return
    }

    let testsHTML = `
      <div class="available-tests-grid">
    `

    tests.forEach((test) => {
      const hasCompleted = studentResults.some((r) => r.testId === test.id)
      const now = new Date()
      const startDate = new Date(test.startDate)
      const endDate = new Date(test.endDate)
      const isAvailable = now >= startDate && now <= endDate

      testsHTML += `
        <div class="test-card ${hasCompleted ? "completed" : ""} ${!isAvailable ? "unavailable" : ""}">
          <div class="test-card-header">
            <h3>${test.title}</h3>
            <span class="test-subject">${test.subject}</span>
          </div>
          <div class="test-card-body">
            <p>${test.description}</p>
            <div class="test-info">
              <div class="info-item">
                <strong>Preguntas:</strong> ${test.totalQuestions}
              </div>
              <div class="info-item">
                <strong>Tiempo:</strong> ${this.formatTime(test.timeLimit)}
              </div>
              <div class="info-item">
                <strong>Puntos:</strong> ${test.totalQuestions * test.pointsPerCorrect}
              </div>
            </div>
            <div class="test-schedule">
              <div class="schedule-item">
                <strong>Inicio:</strong> ${this.formatDate(test.startDate)}
              </div>
              <div class="schedule-item">
                <strong>Fin:</strong> ${this.formatDate(test.endDate)}
              </div>
            </div>
          </div>
          <div class="test-card-footer">
            ${
              hasCompleted
                ? '<button class="btn-secondary" disabled>Completada</button>'
                : isAvailable
                  ? `<button class="btn-primary" onclick="window.dashboardManager.startTest('${test.id}')">Iniciar Prueba</button>`
                  : '<button class="btn-secondary" disabled>No Disponible</button>'
            }
          </div>
        </div>
      `
    })

    testsHTML += "</div>"
    container.innerHTML = testsHTML
  }

  async loadResults() {
    const container = document.getElementById("results-container")
    if (!container) return

    let results = []

    if (this.currentUser.userType === "student") {
      results = window.db.getResultsForStudent(this.currentUser.id)
    } else if (this.currentUser.userType === "teacher") {
      const teacherTests = window.db.getTestsForTeacher(this.currentUser.id)
      results = window.db.data.results.results.filter((r) => teacherTests.some((t) => t.id === r.testId))
    } else if (this.currentUser.userType === "admin") {
      results = window.db.data.results.results
    }

    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No hay resultados</h3>
          <p>No se han encontrado resultados de evaluaciones</p>
        </div>
      `
      return
    }

    let resultsHTML = `
      <div class="search-filter-bar">
        <input type="text" class="search-input" placeholder="Buscar resultados..." id="results-search">
        <select class="filter-select" id="results-filter">
          <option value="">Todos los resultados</option>
          <option value="passed">Aprobados</option>
          <option value="failed">Reprobados</option>
          <option value="cheating">Con incidentes</option>
        </select>
        <button class="btn-secondary" onclick="window.dashboardManager.exportResults()">
          Exportar CSV
        </button>
      </div>
      <div class="data-table">
        <table>
          <thead>
            <tr>
              ${this.currentUser.userType !== "student" ? "<th>Estudiante</th>" : ""}
              <th>Prueba</th>
              <th>Puntuación</th>
              <th>Porcentaje</th>
              <th>Estado</th>
              <th>Tiempo</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `

    results.forEach((result) => {
      const test = window.db.data.tests.tests.find((t) => t.id === result.testId)
      const student = window.db.data.students.students.find((s) => s.id === result.studentId)

      resultsHTML += `
        <tr>
          ${this.currentUser.userType !== "student" ? `<td>${student ? student.name : "Desconocido"}</td>` : ""}
          <td>${test ? test.title : "Prueba eliminada"}</td>
          <td>${result.score}/${result.maxScore}</td>
          <td>
            <span class="percentage ${result.percentage >= 70 ? "good" : result.percentage >= 50 ? "average" : "poor"}">
              ${result.percentage.toFixed(1)}%
            </span>
          </td>
          <td>
            <span class="status-badge ${result.passed ? "status-passed" : "status-failed"}">
              ${result.passed ? "Aprobado" : "Reprobado"}
            </span>
            ${result.cheatingDetected ? '<span class="warning-badge">⚠️</span>' : ""}
          </td>
          <td>${this.formatTime(result.timeSpent)}</td>
          <td>${this.formatDate(result.submittedAt)}</td>
          <td>
            <button class="btn-small btn-view" onclick="window.dashboardManager.viewDetailedResult('${result.id}')">
              Detalles
            </button>
          </td>
        </tr>
      `
    })

    resultsHTML += `
          </tbody>
        </table>
      </div>
    `

    container.innerHTML = resultsHTML
    this.setupResultsSearchAndFilter()
  }

  async loadUsersManagement() {
    const container = document.getElementById("users-container")
    if (!container) return

    const students = window.db.data.students.students
    const teachers = window.db.data.teachers.teachers

    container.innerHTML = `
      <div class="users-tabs">
        <button class="tab-btn active" onclick="window.dashboardManager.showUsersTab('students')">
          Estudiantes (${students.length})
        </button>
        <button class="tab-btn" onclick="window.dashboardManager.showUsersTab('teachers')">
          Docentes (${teachers.length})
        </button>
      </div>
      <div id="users-content">
        <!-- Content will be loaded here -->
      </div>
    `

    this.showUsersTab("students")
  }

  async loadSettings() {
    const container = document.getElementById("settings-container")
    if (!container) return

    const settings = window.db.data.settings

    container.innerHTML = `
      <div class="settings-sections">
        <div class="settings-section">
          <h3>Configuración General</h3>
          <div class="form-group">
            <label>Nombre de la Aplicación</label>
            <input type="text" id="app-name" value="${settings.app.name}">
          </div>
          <div class="form-group">
            <label>Versión</label>
            <input type="text" id="app-version" value="${settings.app.version}" readonly>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="maintenance-mode" ${settings.app.maintenance ? "checked" : ""}>
              Modo de Mantenimiento
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>Configuración de Seguridad</h3>
          <div class="form-group">
            <label>Máximo Intentos de Login</label>
            <input type="number" id="max-login-attempts" value="${settings.security.maxLoginAttempts}" min="1" max="10">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="anti-cheat" ${settings.security.antiCheatEnabled ? "checked" : ""}>
              Sistema Anti-Trampa
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="block-right-click" ${settings.security.blockRightClick ? "checked" : ""}>
              Bloquear Click Derecho
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>Límites del Sistema</h3>
          <div class="form-group">
            <label>Máximo Estudiantes</label>
            <input type="number" id="max-students" value="${settings.app.maxStudents}" min="100" max="5000">
          </div>
          <div class="form-group">
            <label>Máximo Preguntas por Prueba</label>
            <input type="number" id="max-questions" value="${settings.limits.maxQuestionsPerTest}" min="10" max="200">
          </div>
        </div>

        <div class="settings-actions">
          <button class="btn-primary" onclick="window.dashboardManager.saveSettings()">
            Guardar Configuración
          </button>
          <button class="btn-secondary" onclick="window.dashboardManager.exportData()">
            Exportar Datos
          </button>
          <button class="btn-secondary" onclick="window.dashboardManager.importData()">
            Importar Datos
          </button>
        </div>
      </div>
    `
  }

  setupTestsSearchAndFilter() {
    const searchInput = document.getElementById("tests-search")
    const filterSelect = document.getElementById("tests-filter")

    if (searchInput) {
      searchInput.addEventListener("input", () => this.filterTests())
    }

    if (filterSelect) {
      filterSelect.addEventListener("change", () => this.filterTests())
    }
  }

  setupResultsSearchAndFilter() {
    const searchInput = document.getElementById("results-search")
    const filterSelect = document.getElementById("results-filter")

    if (searchInput) {
      searchInput.addEventListener("input", () => this.filterResults())
    }

    if (filterSelect) {
      filterSelect.addEventListener("change", () => this.filterResults())
    }
  }

  filterTests() {
    const searchTerm = document.getElementById("tests-search")?.value.toLowerCase() || ""
    const filterValue = document.getElementById("tests-filter")?.value || ""
    const rows = document.querySelectorAll("#tests-list tbody tr")

    rows.forEach((row) => {
      const title = row.cells[0].textContent.toLowerCase()
      const status = row.cells[2].textContent.toLowerCase()

      const matchesSearch = title.includes(searchTerm)
      const matchesFilter = !filterValue || status.includes(filterValue)

      row.style.display = matchesSearch && matchesFilter ? "" : "none"
    })
  }

  filterResults() {
    const searchTerm = document.getElementById("results-search")?.value.toLowerCase() || ""
    const filterValue = document.getElementById("results-filter")?.value || ""
    const rows = document.querySelectorAll("#results-container tbody tr")

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase()
      const matchesSearch = text.includes(searchTerm)

      let matchesFilter = true
      if (filterValue === "passed") {
        matchesFilter = text.includes("aprobado")
      } else if (filterValue === "failed") {
        matchesFilter = text.includes("reprobado")
      } else if (filterValue === "cheating") {
        matchesFilter = text.includes("⚠️")
      }

      row.style.display = matchesSearch && matchesFilter ? "" : "none"
    })
  }

  // Action handlers
  async startTest(testId) {
    if (window.testEvaluator) {
      await window.testEvaluator.startTest(testId, this.currentUser.id)
    } else {
      this.showError("El módulo de evaluación no está disponible")
    }
  }

  async viewTestResults(testId) {
    if (window.resultsAnalyzer) {
      window.resultsAnalyzer.showTestResults(testId)
    } else {
      this.showError("El analizador de resultados no está disponible")
    }
  }

  async editTest(testId) {
    if (window.testCreator) {
      window.testCreator.editTest(testId)
      this.showSection("create-test")
    } else {
      this.showError("El creador de pruebas no está disponible")
    }
  }

  async deleteTest(testId) {
    if (confirm("¿Está seguro que desea eliminar esta prueba? Esta acción no se puede deshacer.")) {
      try {
        await window.db.deleteTest(testId)
        this.showSuccess("Prueba eliminada exitosamente")
        this.loadMyTests()
      } catch (error) {
        this.showError("Error al eliminar la prueba")
      }
    }
  }

  showUsersTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"))
    event.target.classList.add("active")

    const content = document.getElementById("users-content")

    if (tabName === "students") {
      this.loadStudentsTable(content)
    } else if (tabName === "teachers") {
      this.loadTeachersTable(content)
    }
  }

  loadStudentsTable(container) {
    const students = window.db.data.students.students

    let html = `
      <div class="search-filter-bar">
        <input type="text" class="search-input" placeholder="Buscar estudiantes..." id="students-search">
        <select class="filter-select" id="students-filter">
          <option value="">Todos los estudiantes</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Grado</th>
              <th>Pruebas</th>
              <th>Promedio</th>
              <th>Estado</th>
              <th>Último Acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `

    students.forEach((student) => {
      const results = window.db.getResultsForStudent(student.id)
      const average = results.length > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length : 0

      html += `
        <tr>
          <td>${student.name}</td>
          <td><code>${student.code}</code></td>
          <td>${student.grade || "N/A"}</td>
          <td>${results.length}</td>
          <td>${average.toFixed(1)}%</td>
          <td>
            <span class="status-badge status-${student.status}">
              ${student.status === "active" ? "Activo" : "Inactivo"}
            </span>
          </td>
          <td>${this.formatDate(student.lastLogin)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-small btn-view" onclick="window.dashboardManager.viewStudentDetails('${student.id}')">
                Ver
              </button>
              <button class="btn-small btn-edit" onclick="window.dashboardManager.editStudent('${student.id}')">
                Editar
              </button>
            </div>
          </td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>
      </div>
    `

    container.innerHTML = html
  }

  loadTeachersTable(container) {
    const teachers = window.db.data.teachers.teachers

    let html = `
      <div class="search-filter-bar">
        <input type="text" class="search-input" placeholder="Buscar docentes..." id="teachers-search">
        <select class="filter-select" id="teachers-filter">
          <option value="">Todos los docentes</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Materia</th>
              <th>Pruebas</th>
              <th>Estudiantes</th>
              <th>Estado</th>
              <th>Último Acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `

    teachers.forEach((teacher) => {
      const tests = window.db.getTestsForTeacher(teacher.id)

      html += `
        <tr>
          <td>${teacher.name}</td>
          <td><code>${teacher.code}</code></td>
          <td>${teacher.subject || "N/A"}</td>
          <td>${tests.length}</td>
          <td>${teacher.studentsAssigned || 0}</td>
          <td>
            <span class="status-badge status-${teacher.status}">
              ${teacher.status === "active" ? "Activo" : "Inactivo"}
            </span>
          </td>
          <td>${this.formatDate(teacher.lastLogin)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-small btn-view" onclick="window.dashboardManager.viewTeacherDetails('${teacher.id}')">
                Ver
              </button>
              <button class="btn-small btn-edit" onclick="window.dashboardManager.editTeacher('${teacher.id}')">
                Editar
              </button>
            </div>
          </td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>
      </div>
    `

    container.innerHTML = html
  }

  // Utility methods
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, "0")}`
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  showError(message) {
    if (window.authManager) {
      window.authManager.showError(message)
    }
  }

  showSuccess(message) {
    if (window.authManager) {
      window.authManager.showSuccess(message)
    }
  }

  exportResults() {
    const results = window.db.data.results.results
    if (window.evaluaApp) {
      window.evaluaApp.downloadCSV(results, `resultados_${new Date().toISOString().split("T")[0]}.csv`)
    }
  }

  exportData() {
    if (window.db) {
      window.db.exportData("json")
    }
  }

  async saveSettings() {
    try {
      const settings = window.db.data.settings

      // Update settings from form
      settings.app.name = document.getElementById("app-name").value
      settings.app.maintenance = document.getElementById("maintenance-mode").checked
      settings.security.maxLoginAttempts = Number.parseInt(document.getElementById("max-login-attempts").value)
      settings.security.antiCheatEnabled = document.getElementById("anti-cheat").checked
      settings.security.blockRightClick = document.getElementById("block-right-click").checked
      settings.app.maxStudents = Number.parseInt(document.getElementById("max-students").value)
      settings.limits.maxQuestionsPerTest = Number.parseInt(document.getElementById("max-questions").value)

      await window.db.saveData()
      this.showSuccess("Configuración guardada exitosamente")
    } catch (error) {
      this.showError("Error al guardar la configuración")
    }
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
  }
}

// Add CSS for new components
const dashboardStyles = document.createElement("style")
dashboardStyles.textContent = `
  .available-tests-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .test-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    transition: transform 0.3s ease;
  }

  .test-card:hover {
    transform: translateY(-5px);
  }

  .test-card.completed {
    opacity: 0.7;
    border-left: 4px solid #28a745;
  }

  .test-card.unavailable {
    opacity: 0.5;
    border-left: 4px solid #6c757d;
  }

  .test-card-header {
    margin-bottom: 1rem;
  }

  .test-card-header h3 {
    margin-bottom: 0.5rem;
    color: #333;
  }

  .test-subject {
    background: #667eea;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.8rem;
  }

  .test-info, .test-schedule {
    margin-bottom: 1rem;
  }

  .info-item, .schedule-item {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .status-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .status-active { background: #d4edda; color: #155724; }
  .status-inactive { background: #f8d7da; color: #721c24; }
  .status-passed { background: #d4edda; color: #155724; }
  .status-failed { background: #f8d7da; color: #721c24; }

  .percentage.good { color: #28a745; }
  .percentage.average { color: #ffc107; }
  .percentage.poor { color: #dc3545; }

  .warning-badge {
    background: #fff3cd;
    color: #856404;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-size: 0.7rem;
    margin-left: 0.5rem;
  }

  .users-tabs {
    display: flex;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid #e1e5e9;
  }

  .tab-btn {
    padding: 0.8rem 1.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    color: #666;
    border-bottom: 2px solid transparent;
    transition: all 0.3s ease;
  }

  .tab-btn.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .settings-sections {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .settings-section {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .settings-section h3 {
    margin-bottom: 1rem;
    color: #333;
    border-bottom: 2px solid #e1e5e9;
    padding-bottom: 0.5rem;
  }

  .settings-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .available-tests-grid {
      grid-template-columns: 1fr;
    }
    
    .settings-sections {
      grid-template-columns: 1fr;
    }
    
    .settings-actions {
      flex-direction: column;
    }
  }
`
document.head.appendChild(dashboardStyles)

// Initialize global dashboard manager
window.DashboardManager = DashboardManager
