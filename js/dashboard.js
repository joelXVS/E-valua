// Dashboard Manager - Handles dashboard views for different user types
class Dashboard {
  constructor() {
    this.currentUser = null
  }

  loadDashboard(user) {
    this.currentUser = user
    const contentContainer = document.getElementById("content-container")

    let dashboardHTML = ""

    switch (user.tipo) {
      case "estudiante":
        dashboardHTML = this.generateStudentDashboard()
        break
      case "docente":
        dashboardHTML = this.generateTeacherDashboard()
        break
      case "administrador":
        dashboardHTML = this.generateAdminDashboard()
        break
      default:
        dashboardHTML = this.generateDefaultDashboard()
    }

    contentContainer.innerHTML = dashboardHTML
    this.setupDashboardEvents()
  }

  generateStudentDashboard() {
    const studentData = this.getStudentData()
    const availableTests = this.getAvailableTestsForStudent()
    const recentResults = this.getRecentResults(this.currentUser.id, 5)

    return `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <h1>Bienvenido, ${this.currentUser.nombre}</h1>
          <p>Panel de Control - Estudiante</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-number">${studentData.pruebasRealizadas}</span>
            <span class="stat-label">Pruebas Realizadas</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${this.formatTime(studentData.tiempoPromedio)}</span>
            <span class="stat-label">Tiempo Promedio</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${studentData.promedioPuntos.toFixed(1)}</span>
            <span class="stat-label">Promedio de Puntos</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${availableTests.length}</span>
            <span class="stat-label">Pruebas Disponibles</span>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Pruebas Disponibles</h2>
            </div>
            <div class="available-tests">
              ${this.renderAvailableTests(availableTests)}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Resultados Recientes</h2>
            </div>
            <div class="recent-results">
              ${this.renderRecentResults(recentResults)}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Progreso Académico</h2>
          </div>
          <div class="progress-chart">
            ${this.renderProgressChart(recentResults)}
          </div>
        </div>
      </div>
    `
  }

  generateTeacherDashboard() {
    const teacherData = this.getTeacherData()
    const myTests = this.getTeacherTests()
    const recentResults = this.getTeacherRecentResults()

    return `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <h1>Bienvenido, ${this.currentUser.nombre}</h1>
          <p>Panel de Control - Docente</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-number">${teacherData.pruebasCreadas}</span>
            <span class="stat-label">Pruebas Creadas</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${teacherData.estudiantesEvaluados}</span>
            <span class="stat-label">Estudiantes Evaluados</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${teacherData.promedioGeneral.toFixed(1)}</span>
            <span class="stat-label">Promedio General</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${teacherData.pruebasActivas}</span>
            <span class="stat-label">Pruebas Activas</span>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Mis Pruebas</h2>
              <button class="btn-primary btn-small" onclick="window.app.loadView('create-test')">
                Crear Nueva Prueba
              </button>
            </div>
            <div class="my-tests">
              ${this.renderTeacherTests(myTests)}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Resultados Recientes</h2>
            </div>
            <div class="recent-results">
              ${this.renderTeacherResults(recentResults)}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Estadísticas por Materia</h2>
          </div>
          <div class="subject-stats">
            ${this.renderSubjectStats(teacherData.estadisticasMaterias)}
          </div>
        </div>
      </div>
    `
  }

  generateAdminDashboard() {
    const adminData = this.getAdminData()
    const systemStats = this.getSystemStats()

    return `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <h1>Bienvenido, ${this.currentUser.nombre}</h1>
          <p>Panel de Control - Administrador</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-number">${adminData.totalUsuarios}</span>
            <span class="stat-label">Total Usuarios</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${adminData.totalPruebas}</span>
            <span class="stat-label">Total Pruebas</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${adminData.pruebasHoy}</span>
            <span class="stat-label">Pruebas Hoy</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${adminData.usuariosActivos}</span>
            <span class="stat-label">Usuarios Activos</span>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Resumen del Sistema</h2>
            </div>
            <div class="system-summary">
              ${this.renderSystemSummary(systemStats)}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Actividad Reciente</h2>
            </div>
            <div class="recent-activity">
              ${this.renderRecentActivity()}
            </div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Usuarios por Tipo</h2>
            </div>
            <div class="user-distribution">
              ${this.renderUserDistribution(adminData)}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Rendimiento del Sistema</h2>
            </div>
            <div class="system-performance">
              ${this.renderSystemPerformance()}
            </div>
          </div>
        </div>
      </div>
    `
  }

  // Data retrieval methods
  getStudentData() {
    const student = window.dataManager.getAllData().estudiantes.find((s) => s.id === this.currentUser.id)

    return student
      ? student.estadisticas
      : {
          pruebasRealizadas: 0,
          tiempoPromedio: 0,
          promedioPuntos: 0,
        }
  }

  getAvailableTestsForStudent() {
    return window.dataManager.getActiveTests().slice(0, 5)
  }

  getRecentResults(studentId, limit = 5) {
    return window.dataManager
      .getResultsByStudent(studentId)
      .sort((a, b) => new Date(b.fechaCompletado) - new Date(a.fechaCompletado))
      .slice(0, limit)
  }

  getTeacherData() {
    const allTests = window.dataManager.getTestsByTeacher(this.currentUser.id)
    const allResults = window.dataManager.getAllData().resultados

    const teacherResults = allResults.filter((result) => allTests.some((test) => test.id === result.pruebaId))

    const completedResults = teacherResults.filter((r) => r.completado)
    const uniqueStudents = [...new Set(teacherResults.map((r) => r.estudianteId))]

    const promedioGeneral =
      completedResults.length > 0
        ? completedResults.reduce((sum, r) => sum + r.puntosTotales, 0) / completedResults.length
        : 0

    const activeTests = allTests.filter((test) => {
      const now = new Date()
      const endDate = new Date(test.fechaFin)
      return test.activo && now <= endDate
    })

    return {
      pruebasCreadas: allTests.length,
      estudiantesEvaluados: uniqueStudents.length,
      promedioGeneral,
      pruebasActivas: activeTests.length,
      estadisticasMaterias: this.calculateSubjectStats(allTests, teacherResults),
    }
  }

  getTeacherTests() {
    return window.dataManager
      .getTestsByTeacher(this.currentUser.id)
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
      .slice(0, 5)
  }

  getTeacherRecentResults() {
    const teacherTests = window.dataManager.getTestsByTeacher(this.currentUser.id)
    const allResults = window.dataManager.getAllData().resultados

    return allResults
      .filter((result) => teacherTests.some((test) => test.id === result.pruebaId))
      .sort((a, b) => new Date(b.fechaCompletado) - new Date(a.fechaCompletado))
      .slice(0, 10)
  }

  getAdminData() {
    const allData = window.dataManager.getAllData()
    const today = new Date().toDateString()

    const pruebasHoy = allData.resultados.filter(
      (result) => new Date(result.fechaCompletado).toDateString() === today,
    ).length

    const usuariosActivos = [...allData.estudiantes, ...allData.docentes].filter((user) => user.activo).length

    return {
      totalUsuarios: allData.estudiantes.length + allData.docentes.length,
      totalPruebas: allData.pruebas.length,
      pruebasHoy,
      usuariosActivos,
      estudiantes: allData.estudiantes.length,
      docentes: allData.docentes.length,
    }
  }

  getSystemStats() {
    const allData = window.dataManager.getAllData()
    const totalResults = allData.resultados.length
    const completedResults = allData.resultados.filter((r) => r.completado).length

    return {
      totalResults,
      completedResults,
      completionRate: totalResults > 0 ? ((completedResults / totalResults) * 100).toFixed(1) : 0,
      averageScore: this.calculateAverageScore(),
      storageUsed: this.calculateStorageUsage(),
    }
  }

  // Rendering methods
  renderAvailableTests(tests) {
    if (tests.length === 0) {
      return '<p class="no-data">No hay pruebas disponibles en este momento.</p>'
    }

    return tests
      .map(
        (test) => `
      <div class="test-item">
        <div class="test-info">
          <h4>${test.nombre}</h4>
          <p>Duración: ${test.duracion} minutos</p>
          <p>Disponible hasta: ${new Date(test.fechaFin).toLocaleDateString()}</p>
        </div>
        <button class="btn-primary btn-small" onclick="window.app.startTest('${test.id}')">
          Iniciar
        </button>
      </div>
    `,
      )
      .join("")
  }

  renderRecentResults(results) {
    if (results.length === 0) {
      return '<p class="no-data">No hay resultados recientes.</p>'
    }

    return results
      .map((result) => {
        const test = window.dataManager.getAllData().pruebas.find((t) => t.id === result.pruebaId)
        const testName = test ? test.nombre : "Prueba eliminada"

        return `
        <div class="result-item">
          <div class="result-info">
            <h4>${testName}</h4>
            <p>Puntos: ${result.puntosTotales}/${result.puntosMaximos}</p>
            <p>Tiempo: ${this.formatTime(result.tiempoTotal)}</p>
            <small>${new Date(result.fechaCompletado).toLocaleDateString()}</small>
          </div>
          <div class="result-score ${this.getScoreClass(result.puntosTotales, result.puntosMaximos)}">
            ${((result.puntosTotales / result.puntosMaximos) * 100).toFixed(0)}%
          </div>
        </div>
      `
      })
      .join("")
  }

  renderTeacherTests(tests) {
    if (tests.length === 0) {
      return '<p class="no-data">No has creado pruebas aún.</p>'
    }

    return tests
      .map((test) => {
        const results = window.dataManager.getResultsByTest(test.id)
        const completedCount = results.filter((r) => r.completado).length

        return `
        <div class="test-item">
          <div class="test-info">
            <h4>${test.nombre}</h4>
            <p>Código: ${test.codigo}</p>
            <p>Completadas: ${completedCount}/${results.length}</p>
            <small>Creada: ${new Date(test.fechaCreacion).toLocaleDateString()}</small>
          </div>
          <div class="test-actions">
            <button class="btn-secondary btn-small" onclick="window.app.viewTestResults('${test.id}')">
              Ver Resultados
            </button>
          </div>
        </div>
      `
      })
      .join("")
  }

  renderProgressChart(results) {
    if (results.length === 0) {
      return '<p class="no-data">No hay datos suficientes para mostrar el progreso.</p>'
    }

    const chartData = results.slice(-10).map((result) => {
      const percentage = (result.puntosTotales / result.puntosMaximos) * 100
      return {
        date: new Date(result.fechaCompletado).toLocaleDateString(),
        score: percentage,
      }
    })

    const averageScore = chartData.reduce((sum, item) => sum + item.score, 0) / chartData.length

    return `
      <div class="progress-summary">
        <h4>Progreso Reciente</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${averageScore}%"></div>
        </div>
        <p>Promedio: ${averageScore.toFixed(1)}%</p>
      </div>
      <div class="score-history">
        <h5>Últimas 10 pruebas:</h5>
        ${chartData
          .map(
            (item) => `
          <div class="score-item">
            <span>${item.date}</span>
            <span class="score-value">${item.score.toFixed(1)}%</span>
          </div>
        `,
          )
          .join("")}
      </div>
    `
  }

  renderTeacherResults(results) {
    if (results.length === 0) {
      return '<p class="no-data">No hay resultados recientes.</p>'
    }

    return results
      .map((result) => {
        const test = window.dataManager.getAllData().pruebas.find((t) => t.id === result.pruebaId)
        const student = window.dataManager.getAllData().estudiantes.find((s) => s.id === result.estudianteId)

        const testName = test ? test.nombre : "Prueba eliminada"
        const studentName = student ? student.nombre : "Estudiante eliminado"

        return `
        <div class="result-item">
          <div class="result-info">
            <h4>${testName}</h4>
            <p>Estudiante: ${studentName}</p>
            <p>Tiempo: ${this.formatTime(result.tiempoTotal)}</p>
            <small>${new Date(result.fechaCompletado).toLocaleDateString()}</small>
          </div>
          <div class="result-score ${this.getScoreClass(result.puntosTotales, result.puntosMaximos)}">
            ${((result.puntosTotales / result.puntosMaximos) * 100).toFixed(0)}%
          </div>
        </div>
      `
      })
      .join("")
  }

  renderSystemSummary(stats) {
    return `
      <div class="system-summary">
        <div class="summary-item">
          <span class="summary-value">${stats.totalResults}</span>
          <span class="summary-label">Total Evaluaciones</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">${stats.completedResults}</span>
          <span class="summary-label">Completadas</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">${stats.completionRate}%</span>
          <span class="summary-label">Tasa de Finalización</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">${stats.averageScore}%</span>
          <span class="summary-label">Promedio General</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">${stats.storageUsed}</span>
          <span class="summary-label">Almacenamiento</span>
        </div>
      </div>
    `
  }

  renderRecentActivity() {
    const activities = this.getRecentActivities()

    if (activities.length === 0) {
      return '<p class="no-data">No hay actividad reciente.</p>'
    }

    return activities
      .map(
        (activity) => `
      <div class="activity-item">
        <div class="activity-icon">
          ${activity.icon}
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
        </div>
        <div class="activity-time">
          ${this.formatRelativeTime(activity.timestamp)}
        </div>
      </div>
    `,
      )
      .join("")
  }

  renderUserDistribution(adminData) {
    return `
      <div class="user-distribution">
        <div class="user-type-item">
          <span class="user-type-label">Estudiantes</span>
          <span class="user-type-count">${adminData.estudiantes}</span>
        </div>
        <div class="user-type-item">
          <span class="user-type-label">Docentes</span>
          <span class="user-type-count">${adminData.docentes}</span>
        </div>
        <div class="user-type-item">
          <span class="user-type-label">Total Activos</span>
          <span class="user-type-count">${adminData.usuariosActivos}</span>
        </div>
      </div>
    `
  }

  renderSystemPerformance() {
    const performance = this.getSystemPerformance()

    return `
      <div class="performance-metrics">
        <div class="metric-item">
          <span class="metric-value">${performance.responseTime}ms</span>
          <span class="metric-label">Tiempo de Respuesta</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">${performance.uptime}%</span>
          <span class="metric-label">Disponibilidad</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">${performance.activeUsers}</span>
          <span class="metric-label">Usuarios Activos</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">${performance.errorRate}%</span>
          <span class="metric-label">Tasa de Error</span>
        </div>
      </div>
    `
  }

  renderSubjectStats(subjectStats) {
    if (!subjectStats || subjectStats.length === 0) {
      return '<p class="no-data">No hay estadísticas por materia disponibles.</p>'
    }

    return `
      <div class="subject-stats">
        ${subjectStats
          .map(
            (subject) => `
          <div class="subject-item">
            <div class="subject-name">${subject.materia}</div>
            <div class="subject-metrics">
              <span>Pruebas: ${subject.totalPruebas}</span>
              <span>Promedio: ${subject.promedio.toFixed(1)}%</span>
              <span>Estudiantes: ${subject.estudiantes}</span>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `
  }

  // Utility methods
  formatTime(seconds) {
    if (!seconds) return "0m"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
  }

  getScoreClass(score, maxScore) {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return "score-excellent"
    if (percentage >= 60) return "score-good"
    if (percentage >= 40) return "score-fair"
    return "score-poor"
  }

  calculateAverageScore() {
    const results = window.dataManager.getAllData().resultados.filter((r) => r.completado)
    if (results.length === 0) return 0

    const totalPercentage = results.reduce(
      (sum, result) => sum + (result.puntosTotales / result.puntosMaximos) * 100,
      0,
    )

    return (totalPercentage / results.length).toFixed(1)
  }

  calculateStorageUsage() {
    const data = JSON.stringify(window.dataManager.getAllData())
    return (data.length / 1024).toFixed(1) + " KB"
  }

  setupDashboardEvents() {
    // Add any dashboard-specific event listeners here
    console.log("Dashboard events setup completed")
  }

  // Additional helper methods
  calculateSubjectStats(tests, results) {
    const subjectMap = new Map()

    tests.forEach((test) => {
      const testResults = results.filter((r) => r.pruebaId === test.id && r.completado)
      const materia = test.materia || "General"

      if (!subjectMap.has(materia)) {
        subjectMap.set(materia, {
          materia,
          totalPruebas: 0,
          totalResultados: 0,
          sumaPromedio: 0,
          estudiantes: new Set(),
        })
      }

      const subjectData = subjectMap.get(materia)
      subjectData.totalPruebas++
      subjectData.totalResultados += testResults.length

      testResults.forEach((result) => {
        subjectData.sumaPromedio += (result.puntosTotales / result.puntosMaximos) * 100
        subjectData.estudiantes.add(result.estudianteId)
      })
    })

    return Array.from(subjectMap.values()).map((subject) => ({
      ...subject,
      promedio: subject.totalResultados > 0 ? subject.sumaPromedio / subject.totalResultados : 0,
      estudiantes: subject.estudiantes.size,
    }))
  }

  getRecentActivities() {
    const activities = []
    const allData = window.dataManager.getAllData()

    // Recent test completions
    const recentResults = allData.resultados
      .filter((r) => r.completado)
      .sort((a, b) => new Date(b.fechaCompletado) - new Date(a.fechaCompletado))
      .slice(0, 5)

    recentResults.forEach((result) => {
      const student = allData.estudiantes.find((s) => s.id === result.estudianteId)
      const test = allData.pruebas.find((t) => t.id === result.pruebaId)

      if (student && test) {
        activities.push({
          icon: "✓",
          title: "Prueba Completada",
          description: `${student.nombre} completó "${test.nombre}"`,
          timestamp: result.fechaCompletado,
        })
      }
    })

    // Recent test creations
    const recentTests = allData.pruebas
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
      .slice(0, 3)

    recentTests.forEach((test) => {
      const teacher = allData.docentes.find((d) => d.id === test.creadorId)

      if (teacher) {
        activities.push({
          icon: "+",
          title: "Nueva Prueba",
          description: `${teacher.nombre} creó "${test.nombre}"`,
          timestamp: test.fechaCreacion,
        })
      }
    })

    return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)
  }

  getSystemPerformance() {
    // Simulate system performance metrics
    return {
      responseTime: Math.floor(Math.random() * 100) + 50,
      uptime: 99.9,
      activeUsers: this.getActiveUsersCount(),
      errorRate: (Math.random() * 2).toFixed(1),
    }
  }

  getActiveUsersCount() {
    // Count users who have been active in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const allData = window.dataManager.getAllData()

    return [...allData.estudiantes, ...allData.docentes].filter((user) => {
      const lastAccess = user.ultimoAcceso ? new Date(user.ultimoAcceso) : new Date(0)
      return lastAccess > oneDayAgo
    }).length
  }

  formatRelativeTime(timestamp) {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now - time) / (1000 * 60))

    if (diffInMinutes < 1) return "Ahora"
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    return `${Math.floor(diffInMinutes / 1440)}d`
  }
}

// Create global instance
window.dashboard = new Dashboard()
