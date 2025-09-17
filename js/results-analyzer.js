// Results Analyzer - Handles test results analysis and statistics
class ResultsAnalyzer {
  constructor() {
    this.currentResults = []
    this.currentTest = null
    this.currentFilters = {
      testId: null,
      studentId: null,
      dateRange: null,
      minScore: null,
      maxScore: null,
    }
  }

  showResultsAnalyzer(testId = null) {
    try {
      const allData = window.dataManager.getAllData()
      const currentUser = window.auth.getCurrentUser()

      // Filter results based on user role
      this.currentResults = this.filterResultsByRole(allData.resultados, currentUser)

      if (testId) {
        this.currentResults = this.currentResults.filter((r) => r.pruebaId === testId)
        this.currentTest = allData.pruebas.find((p) => p.id === testId)
      }

      this.renderAnalyzerInterface()
    } catch (error) {
      console.error("Error loading results analyzer:", error)
      window.app.showAlert("Error al cargar el analizador de resultados", "error")
    }
  }

  filterResultsByRole(results, user) {
    switch (user.rol) {
      case "administrador":
        return results // Admin can see all results
      case "docente":
        // Teachers can only see results from their tests
        const allData = window.dataManager.getAllData()
        const teacherTests = allData.pruebas.filter((p) => p.creadoPor === user.id)
        const teacherTestIds = teacherTests.map((t) => t.id)
        return results.filter((r) => teacherTestIds.includes(r.pruebaId))
      case "estudiante":
        // Students can only see their own results
        return results.filter((r) => r.estudianteId === user.id)
      default:
        return []
    }
  }

  renderAnalyzerInterface() {
    const contentContainer = document.getElementById("content-container")
    const currentUser = window.auth.getCurrentUser()

    contentContainer.innerHTML = `
      <div class="results-analyzer-container">
        <!-- Header -->
        <div class="analyzer-header">
          <div class="header-content">
            <h1>Analizador de Resultados</h1>
            <p>Análisis detallado de resultados de evaluaciones</p>
          </div>
          <div class="header-actions">
            <button class="btn-secondary" onclick="window.resultsAnalyzer.exportResults()">
              📊 Exportar Datos
            </button>
            <button class="btn-primary" onclick="window.app.loadView('dashboard')">
              Volver al Dashboard
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="analyzer-filters">
          <div class="filters-row">
            ${
              currentUser.rol !== "estudiante"
                ? `
              <div class="filter-group">
                <label>Prueba:</label>
                <select id="test-filter" onchange="window.resultsAnalyzer.applyFilters()">
                  <option value="">Todas las pruebas</option>
                  ${this.renderTestOptions()}
                </select>
              </div>
            `
                : ""
            }
            
            ${
              currentUser.rol === "administrador"
                ? `
              <div class="filter-group">
                <label>Estudiante:</label>
                <select id="student-filter" onchange="window.resultsAnalyzer.applyFilters()">
                  <option value="">Todos los estudiantes</option>
                  ${this.renderStudentOptions()}
                </select>
              </div>
            `
                : ""
            }

            <div class="filter-group">
              <label>Rango de fechas:</label>
              <input type="date" id="date-from" onchange="window.resultsAnalyzer.applyFilters()">
              <span>a</span>
              <input type="date" id="date-to" onchange="window.resultsAnalyzer.applyFilters()">
            </div>

            <div class="filter-group">
              <label>Puntuación:</label>
              <input type="number" id="min-score" placeholder="Mín" min="0" max="100" 
                     onchange="window.resultsAnalyzer.applyFilters()">
              <span>-</span>
              <input type="number" id="max-score" placeholder="Máx" min="0" max="100" 
                     onchange="window.resultsAnalyzer.applyFilters()">
            </div>

            <button class="btn-secondary" onclick="window.resultsAnalyzer.clearFilters()">
              Limpiar Filtros
            </button>
          </div>
        </div>

        <!-- Statistics Overview -->
        <div class="statistics-overview">
          <div class="stats-grid" id="stats-grid">
            ${this.renderStatisticsCards()}
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
          <div class="charts-grid">
            <div class="chart-container">
              <h3>Distribución de Puntuaciones</h3>
              <canvas id="score-distribution-chart"></canvas>
            </div>
            <div class="chart-container">
              <h3>Rendimiento por Prueba</h3>
              <canvas id="test-performance-chart"></canvas>
            </div>
            ${
              currentUser.rol !== "estudiante"
                ? `
              <div class="chart-container">
                <h3>Progreso Temporal</h3>
                <canvas id="temporal-progress-chart"></canvas>
              </div>
              <div class="chart-container">
                <h3>Análisis por Pregunta</h3>
                <canvas id="question-analysis-chart"></canvas>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- Detailed Results Table -->
        <div class="results-table-section">
          <div class="table-header">
            <h3>Resultados Detallados</h3>
            <div class="table-controls">
              <input type="text" id="search-results" placeholder="Buscar..." 
                     onkeyup="window.resultsAnalyzer.searchResults()">
              <select id="sort-results" onchange="window.resultsAnalyzer.sortResults()">
                <option value="fecha-desc">Fecha (más reciente)</option>
                <option value="fecha-asc">Fecha (más antigua)</option>
                <option value="puntuacion-desc">Puntuación (mayor)</option>
                <option value="puntuacion-asc">Puntuación (menor)</option>
                <option value="nombre-asc">Nombre (A-Z)</option>
                <option value="nombre-desc">Nombre (Z-A)</option>
              </select>
            </div>
          </div>
          <div class="results-table-container">
            <table class="results-table" id="results-table">
              ${this.renderResultsTable()}
            </table>
          </div>
        </div>

        <!-- Individual Result Modal -->
        <div id="result-detail-modal" class="modal hidden">
          <div class="modal-content result-detail-modal">
            <div class="modal-header">
              <h3>Detalle del Resultado</h3>
              <button class="modal-close" onclick="window.resultsAnalyzer.closeResultModal()">&times;</button>
            </div>
            <div class="modal-body">
              <div id="result-detail-content"></div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="window.resultsAnalyzer.closeResultModal()">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    this.initializeCharts()
    this.setupEventListeners()
  }

  renderTestOptions() {
    const allData = window.dataManager.getAllData()
    const currentUser = window.auth.getCurrentUser()

    let tests = allData.pruebas
    if (currentUser.rol === "docente") {
      tests = tests.filter((t) => t.creadoPor === currentUser.id)
    }

    return tests.map((test) => `<option value="${test.id}">${test.nombre} - ${test.materia}</option>`).join("")
  }

  renderStudentOptions() {
    const allData = window.dataManager.getAllData()
    return allData.estudiantes
      .map((student) => `<option value="${student.id}">${student.nombre} - ${student.codigo}</option>`)
      .join("")
  }

  renderStatisticsCards() {
    const stats = this.calculateStatistics()

    return `
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalResults}</div>
          <div class="stat-label">Total Resultados</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-value">${stats.averageScore.toFixed(1)}%</div>
          <div class="stat-label">Promedio General</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🏆</div>
        <div class="stat-content">
          <div class="stat-value">${stats.highestScore.toFixed(1)}%</div>
          <div class="stat-label">Puntuación Máxima</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📉</div>
        <div class="stat-content">
          <div class="stat-value">${stats.lowestScore.toFixed(1)}%</div>
          <div class="stat-label">Puntuación Mínima</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">${stats.passRate.toFixed(1)}%</div>
          <div class="stat-label">Tasa de Aprobación</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">${stats.averageTime}</div>
          <div class="stat-label">Tiempo Promedio</div>
        </div>
      </div>
    `
  }

  renderResultsTable() {
    const filteredResults = this.getFilteredResults()
    const allData = window.dataManager.getAllData()
    const currentUser = window.auth.getCurrentUser()

    if (filteredResults.length === 0) {
      return `
        <thead>
          <tr>
            <th>Fecha</th>
            ${currentUser.rol !== "estudiante" ? "<th>Estudiante</th>" : ""}
            <th>Prueba</th>
            <th>Puntuación</th>
            <th>Tiempo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="${currentUser.rol !== "estudiante" ? "7" : "6"}" class="no-results">
              No se encontraron resultados con los filtros aplicados
            </td>
          </tr>
        </tbody>
      `
    }

    const tableRows = filteredResults
      .map((result) => {
        const student = allData.estudiantes.find((s) => s.id === result.estudianteId)
        const test = allData.pruebas.find((t) => t.id === result.pruebaId)
        const percentage = ((result.puntosTotales / result.puntosMaximos) * 100).toFixed(1)
        const timeFormatted = this.formatTime(result.tiempoTotal)
        const date = new Date(result.fechaCompletado).toLocaleDateString()

        return `
        <tr class="result-row" onclick="window.resultsAnalyzer.showResultDetail('${result.id}')">
          <td>${date}</td>
          ${currentUser.rol !== "estudiante" ? `<td>${student?.nombre || "N/A"}</td>` : ""}
          <td>${test?.nombre || "N/A"}</td>
          <td>
            <div class="score-cell">
              <span class="score-percentage ${this.getScoreClass(percentage)}">${percentage}%</span>
              <span class="score-points">${result.puntosTotales}/${result.puntosMaximos}</span>
            </div>
          </td>
          <td>${timeFormatted}</td>
          <td>
            <span class="status-badge ${result.completado ? "completed" : "incomplete"}">
              ${result.completado ? "Completado" : "Incompleto"}
            </span>
            ${result.autoEnviado ? '<span class="auto-submit-badge">Auto-enviado</span>' : ""}
            ${result.cheatingFlags?.length > 0 ? '<span class="warning-badge">Advertencias</span>' : ""}
          </td>
          <td>
            <button class="btn-small btn-primary" onclick="event.stopPropagation(); window.resultsAnalyzer.showResultDetail('${result.id}')">
              Ver Detalle
            </button>
          </td>
        </tr>
      `
      })
      .join("")

    return `
      <thead>
        <tr>
          <th>Fecha</th>
          ${currentUser.rol !== "estudiante" ? "<th>Estudiante</th>" : ""}
          <th>Prueba</th>
          <th>Puntuación</th>
          <th>Tiempo</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    `
  }

  calculateStatistics() {
    const results = this.getFilteredResults()

    if (results.length === 0) {
      return {
        totalResults: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0,
        averageTime: "0m 0s",
      }
    }

    const scores = results.map((r) => (r.puntosTotales / r.puntosMaximos) * 100)
    const times = results.map((r) => r.tiempoTotal)
    const passThreshold = 60 // 60% to pass

    return {
      totalResults: results.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      passRate: (scores.filter((s) => s >= passThreshold).length / scores.length) * 100,
      averageTime: this.formatTime(times.reduce((a, b) => a + b, 0) / times.length),
    }
  }

  initializeCharts() {
    // Simple chart implementation using Canvas API
    this.drawScoreDistributionChart()
    this.drawTestPerformanceChart()

    const currentUser = window.auth.getCurrentUser()
    if (currentUser.rol !== "estudiante") {
      this.drawTemporalProgressChart()
      this.drawQuestionAnalysisChart()
    }
  }

  drawScoreDistributionChart() {
    const canvas = document.getElementById("score-distribution-chart")
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const results = this.getFilteredResults()

    // Set canvas size
    canvas.width = 400
    canvas.height = 300

    if (results.length === 0) {
      ctx.fillStyle = "#6b7280"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("No hay datos para mostrar", canvas.width / 2, canvas.height / 2)
      return
    }

    // Calculate score ranges
    const ranges = [
      { label: "0-20%", min: 0, max: 20, count: 0, color: "#dc2626" },
      { label: "21-40%", min: 21, max: 40, count: 0, color: "#f59e0b" },
      { label: "41-60%", min: 41, max: 60, count: 0, color: "#eab308" },
      { label: "61-80%", min: 61, max: 80, count: 0, color: "#84cc16" },
      { label: "81-100%", min: 81, max: 100, count: 0, color: "#15803d" },
    ]

    results.forEach((result) => {
      const percentage = (result.puntosTotales / result.puntosMaximos) * 100
      ranges.forEach((range) => {
        if (percentage >= range.min && percentage <= range.max) {
          range.count++
        }
      })
    })

    // Draw bars
    const barWidth = 60
    const barSpacing = 20
    const maxCount = Math.max(...ranges.map((r) => r.count))
    const chartHeight = 200
    const chartTop = 50

    ranges.forEach((range, index) => {
      const x = 50 + index * (barWidth + barSpacing)
      const barHeight = maxCount > 0 ? (range.count / maxCount) * chartHeight : 0
      const y = chartTop + chartHeight - barHeight

      // Draw bar
      ctx.fillStyle = range.color
      ctx.fillRect(x, y, barWidth, barHeight)

      // Draw count on top of bar
      ctx.fillStyle = "#374151"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(range.count.toString(), x + barWidth / 2, y - 5)

      // Draw label
      ctx.fillText(range.label, x + barWidth / 2, chartTop + chartHeight + 20)
    })

    // Draw title
    ctx.fillStyle = "#374151"
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Distribución de Puntuaciones", canvas.width / 2, 25)
  }

  drawTestPerformanceChart() {
    const canvas = document.getElementById("test-performance-chart")
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const results = this.getFilteredResults()
    const allData = window.dataManager.getAllData()

    canvas.width = 400
    canvas.height = 300

    if (results.length === 0) {
      ctx.fillStyle = "#6b7280"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("No hay datos para mostrar", canvas.width / 2, canvas.height / 2)
      return
    }

    // Group results by test
    const testPerformance = {}
    results.forEach((result) => {
      const test = allData.pruebas.find((t) => t.id === result.pruebaId)
      const testName = test ? test.nombre : "Prueba desconocida"

      if (!testPerformance[testName]) {
        testPerformance[testName] = { scores: [], total: 0 }
      }

      testPerformance[testName].scores.push((result.puntosTotales / result.puntosMaximos) * 100)
      testPerformance[testName].total++
    })

    // Calculate averages
    const testData = Object.entries(testPerformance)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        count: data.total,
      }))
      .slice(0, 5) // Show only top 5 tests

    if (testData.length === 0) return

    // Draw bars
    const barWidth = 50
    const barSpacing = 30
    const maxAverage = Math.max(...testData.map((t) => t.average))
    const chartHeight = 200
    const chartTop = 50

    testData.forEach((test, index) => {
      const x = 50 + index * (barWidth + barSpacing)
      const barHeight = (test.average / 100) * chartHeight
      const y = chartTop + chartHeight - barHeight

      // Draw bar
      const hue = (test.average / 100) * 120 // Green for high scores, red for low
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
      ctx.fillRect(x, y, barWidth, barHeight)

      // Draw average on top
      ctx.fillStyle = "#374151"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(`${test.average.toFixed(1)}%`, x + barWidth / 2, y - 5)

      // Draw test name (rotated)
      ctx.save()
      ctx.translate(x + barWidth / 2, chartTop + chartHeight + 15)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(test.name, 0, 0)
      ctx.restore()
    })

    // Draw title
    ctx.fillStyle = "#374151"
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Rendimiento Promedio por Prueba", canvas.width / 2, 25)
  }

  drawTemporalProgressChart() {
    const canvas = document.getElementById("temporal-progress-chart")
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const results = this.getFilteredResults()

    canvas.width = 400
    canvas.height = 300

    if (results.length === 0) {
      ctx.fillStyle = "#6b7280"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("No hay datos para mostrar", canvas.width / 2, canvas.height / 2)
      return
    }

    // Group by month
    const monthlyData = {}
    results.forEach((result) => {
      const date = new Date(result.fechaCompletado)
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { scores: [], count: 0 }
      }

      monthlyData[monthKey].scores.push((result.puntosTotales / result.puntosMaximos) * 100)
      monthlyData[monthKey].count++
    })

    const sortedMonths = Object.keys(monthlyData).sort().slice(-6) // Last 6 months
    const chartData = sortedMonths.map((month) => ({
      month: month.split("-")[1] + "/" + month.split("-")[0].slice(-2),
      average: monthlyData[month].scores.reduce((a, b) => a + b, 0) / monthlyData[month].scores.length,
    }))

    if (chartData.length === 0) return

    // Draw line chart
    const chartWidth = 300
    const chartHeight = 200
    const chartLeft = 50
    const chartTop = 50

    // Draw axes
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(chartLeft, chartTop)
    ctx.lineTo(chartLeft, chartTop + chartHeight)
    ctx.lineTo(chartLeft + chartWidth, chartTop + chartHeight)
    ctx.stroke()

    // Draw line
    ctx.strokeStyle = "#15803d"
    ctx.lineWidth = 2
    ctx.beginPath()

    chartData.forEach((point, index) => {
      const x = chartLeft + (index / (chartData.length - 1)) * chartWidth
      const y = chartTop + chartHeight - (point.average / 100) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      // Draw point
      ctx.fillStyle = "#15803d"
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()

      // Draw label
      ctx.fillStyle = "#374151"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(point.month, x, chartTop + chartHeight + 20)
      ctx.fillText(`${point.average.toFixed(1)}%`, x, y - 10)
    })

    ctx.stroke()

    // Draw title
    ctx.fillStyle = "#374151"
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Progreso Temporal (Últimos 6 meses)", canvas.width / 2, 25)
  }

  drawQuestionAnalysisChart() {
    const canvas = document.getElementById("question-analysis-chart")
    if (!canvas || !this.currentTest) return

    const ctx = canvas.getContext("2d")
    const results = this.getFilteredResults().filter((r) => r.pruebaId === this.currentTest.id)

    canvas.width = 400
    canvas.height = 300

    if (results.length === 0) {
      ctx.fillStyle = "#6b7280"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("Selecciona una prueba específica", canvas.width / 2, canvas.height / 2)
      return
    }

    // Calculate question success rates
    const questionStats = this.currentTest.preguntas
      .map((question, index) => {
        const correctCount = results.reduce((count, result) => {
          const detail = result.detalleRespuestas?.find((d) => d.questionIndex === index)
          return count + (detail?.isCorrect ? 1 : 0)
        }, 0)

        return {
          index: index + 1,
          successRate: results.length > 0 ? (correctCount / results.length) * 100 : 0,
        }
      })
      .slice(0, 10) // Show first 10 questions

    // Draw bars
    const barWidth = 25
    const barSpacing = 5
    const chartHeight = 200
    const chartTop = 50

    questionStats.forEach((stat, index) => {
      const x = 50 + index * (barWidth + barSpacing)
      const barHeight = (stat.successRate / 100) * chartHeight
      const y = chartTop + chartHeight - barHeight

      // Color based on success rate
      const hue = (stat.successRate / 100) * 120
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
      ctx.fillRect(x, y, barWidth, barHeight)

      // Draw percentage
      ctx.fillStyle = "#374151"
      ctx.font = "10px Arial"
      ctx.textAlign = "center"
      ctx.fillText(`${stat.successRate.toFixed(0)}%`, x + barWidth / 2, y - 5)

      // Draw question number
      ctx.fillText(`P${stat.index}`, x + barWidth / 2, chartTop + chartHeight + 15)
    })

    // Draw title
    ctx.fillStyle = "#374151"
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Tasa de Éxito por Pregunta", canvas.width / 2, 25)
  }

  applyFilters() {
    const testFilter = document.getElementById("test-filter")?.value
    const studentFilter = document.getElementById("student-filter")?.value
    const dateFrom = document.getElementById("date-from")?.value
    const dateTo = document.getElementById("date-to")?.value
    const minScore = document.getElementById("min-score")?.value
    const maxScore = document.getElementById("max-score")?.value

    this.currentFilters = {
      testId: testFilter || null,
      studentId: studentFilter || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      minScore: minScore ? Number.parseFloat(minScore) : null,
      maxScore: maxScore ? Number.parseFloat(maxScore) : null,
    }

    // Update interface
    document.getElementById("stats-grid").innerHTML = this.renderStatisticsCards()
    document.getElementById("results-table").innerHTML = this.renderResultsTable()
    this.initializeCharts()
  }

  clearFilters() {
    this.currentFilters = {
      testId: null,
      studentId: null,
      dateFrom: null,
      dateTo: null,
      minScore: null,
      maxScore: null,
    }

    // Clear form inputs
    const inputs = ["test-filter", "student-filter", "date-from", "date-to", "min-score", "max-score"]
    inputs.forEach((id) => {
      const element = document.getElementById(id)
      if (element) element.value = ""
    })

    this.applyFilters()
  }

  getFilteredResults() {
    let filtered = [...this.currentResults]

    if (this.currentFilters.testId) {
      filtered = filtered.filter((r) => r.pruebaId === this.currentFilters.testId)
    }

    if (this.currentFilters.studentId) {
      filtered = filtered.filter((r) => r.estudianteId === this.currentFilters.studentId)
    }

    if (this.currentFilters.dateFrom) {
      const fromDate = new Date(this.currentFilters.dateFrom)
      filtered = filtered.filter((r) => new Date(r.fechaCompletado) >= fromDate)
    }

    if (this.currentFilters.dateTo) {
      const toDate = new Date(this.currentFilters.dateTo)
      toDate.setHours(23, 59, 59, 999) // End of day
      filtered = filtered.filter((r) => new Date(r.fechaCompletado) <= toDate)
    }

    if (this.currentFilters.minScore !== null) {
      filtered = filtered.filter((r) => {
        const percentage = (r.puntosTotales / r.puntosMaximos) * 100
        return percentage >= this.currentFilters.minScore
      })
    }

    if (this.currentFilters.maxScore !== null) {
      filtered = filtered.filter((r) => {
        const percentage = (r.puntosTotales / r.puntosMaximos) * 100
        return percentage <= this.currentFilters.maxScore
      })
    }

    return filtered
  }

  searchResults() {
    const searchTerm = document.getElementById("search-results").value.toLowerCase()
    const allData = window.dataManager.getAllData()

    if (!searchTerm) {
      this.applyFilters()
      return
    }

    const filtered = this.getFilteredResults().filter((result) => {
      const student = allData.estudiantes.find((s) => s.id === result.estudianteId)
      const test = allData.pruebas.find((t) => t.id === result.pruebaId)

      return (
        student?.nombre.toLowerCase().includes(searchTerm) ||
        student?.codigo.toLowerCase().includes(searchTerm) ||
        test?.nombre.toLowerCase().includes(searchTerm) ||
        test?.materia.toLowerCase().includes(searchTerm)
      )
    })

    this.renderFilteredTable(filtered)
  }

  sortResults() {
    const sortBy = document.getElementById("sort-results").value
    const allData = window.dataManager.getAllData()
    const filtered = this.getFilteredResults()

    switch (sortBy) {
      case "fecha-desc":
        filtered.sort((a, b) => new Date(b.fechaCompletado) - new Date(a.fechaCompletado))
        break
      case "fecha-asc":
        filtered.sort((a, b) => new Date(a.fechaCompletado) - new Date(b.fechaCompletado))
        break
      case "puntuacion-desc":
        filtered.sort((a, b) => b.puntosTotales / b.puntosMaximos - a.puntosTotales / a.puntosMaximos)
        break
      case "puntuacion-asc":
        filtered.sort((a, b) => a.puntosTotales / a.puntosMaximos - b.puntosTotales / b.puntosMaximos)
        break
      case "nombre-asc":
        filtered.sort((a, b) => {
          const studentA = allData.estudiantes.find((s) => s.id === a.estudianteId)
          const studentB = allData.estudiantes.find((s) => s.id === b.estudianteId)
          return (studentA?.nombre || "").localeCompare(studentB?.nombre || "")
        })
        break
      case "nombre-desc":
        filtered.sort((a, b) => {
          const studentA = allData.estudiantes.find((s) => s.id === a.estudianteId)
          const studentB = allData.estudiantes.find((s) => s.id === b.estudianteId)
          return (studentB?.nombre || "").localeCompare(studentA?.nombre || "")
        })
        break
    }

    this.renderFilteredTable(filtered)
  }

  renderFilteredTable(results) {
    // Update the current results temporarily for table rendering
    const originalResults = this.currentResults
    this.currentResults = results

    document.getElementById("results-table").innerHTML = this.renderResultsTable()

    // Restore original results
    this.currentResults = originalResults
  }

  showResultDetail(resultId) {
    const result = this.currentResults.find((r) => r.id === resultId)
    if (!result) return

    const allData = window.dataManager.getAllData()
    const student = allData.estudiantes.find((s) => s.id === result.estudianteId)
    const test = allData.pruebas.find((t) => t.id === result.pruebaId)

    const percentage = ((result.puntosTotales / result.puntosMaximos) * 100).toFixed(1)
    const timeFormatted = this.formatTime(result.tiempoTotal)
    const date = new Date(result.fechaCompletado).toLocaleString()

    let detailHTML = `
      <div class="result-detail-header">
        <div class="result-basic-info">
          <h4>${test?.nombre || "Prueba desconocida"}</h4>
          <p><strong>Estudiante:</strong> ${student?.nombre || "N/A"} (${student?.codigo || "N/A"})</p>
          <p><strong>Fecha:</strong> ${date}</p>
          <p><strong>Tiempo utilizado:</strong> ${timeFormatted}</p>
        </div>
        <div class="result-score-summary">
          <div class="score-circle ${this.getScoreClass(percentage)}">
            <span class="score-percentage">${percentage}%</span>
            <span class="score-points">${result.puntosTotales}/${result.puntosMaximos} puntos</span>
          </div>
        </div>
      </div>

      ${result.autoEnviado ? '<div class="alert alert-warning">Esta prueba fue enviada automáticamente al terminar el tiempo.</div>' : ""}
      
      ${
        result.cheatingFlags?.length > 0
          ? `
        <div class="alert alert-danger">
          <strong>Advertencias registradas (${result.cheatingFlags.length}):</strong>
          <ul>
            ${result.cheatingFlags
              .map(
                (flag) => `
              <li>${this.formatCheatingFlag(flag)}</li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
    `

    if (result.detalleRespuestas && result.detalleRespuestas.length > 0) {
      detailHTML += `
        <div class="question-details">
          <h5>Detalle por pregunta:</h5>
          <div class="question-details-list">
            ${result.detalleRespuestas
              .map((detail, index) => {
                const question = test?.preguntas[detail.questionIndex]
                return `
                <div class="question-detail-item ${detail.isCorrect ? "correct" : "incorrect"}">
                  <div class="question-detail-header">
                    <span class="question-number">Pregunta ${detail.questionIndex + 1}</span>
                    <span class="question-result ${detail.isCorrect ? "correct" : "incorrect"}">
                      ${detail.isCorrect ? "✓ Correcta" : "✗ Incorrecta"}
                    </span>
                    <span class="question-points">${detail.pointsEarned}/${detail.maxPoints} pts</span>
                  </div>
                  ${
                    question
                      ? `
                    <div class="question-text">${this.truncateText(question.pregunta, 100)}</div>
                    <div class="user-answer">
                      <strong>Respuesta del estudiante:</strong> 
                      ${this.formatUserAnswer(question, detail.userAnswer)}
                    </div>
                  `
                      : ""
                  }
                </div>
              `
              })
              .join("")}
          </div>
        </div>
      `
    }

    document.getElementById("result-detail-content").innerHTML = detailHTML
    document.getElementById("result-detail-modal").classList.remove("hidden")
  }

  closeResultModal() {
    document.getElementById("result-detail-modal").classList.add("hidden")
  }

  formatCheatingFlag(flag) {
    const time = new Date(flag.timestamp).toLocaleTimeString()

    switch (flag.type) {
      case "visibility_change":
        return `${time}: Cambio de pestaña/ventana (${flag.count} veces)`
      case "window_blur":
        return `${time}: Pérdida de foco de ventana (${flag.count} veces)`
      case "blocked_shortcut":
        return `${time}: Intento de usar atajo bloqueado (${flag.key})`
      default:
        return `${time}: ${flag.type}`
    }
  }

  formatUserAnswer(question, answer) {
    if (answer === undefined || answer === null || answer === "") {
      return "<em>Sin responder</em>"
    }

    switch (question.tipo) {
      case "multiple":
        const option = question.respuestas.opciones[answer]
        return option ? `${String.fromCharCode(65 + answer)}. ${option.texto}` : "Respuesta inválida"
      case "true-false":
        return answer ? "Verdadero" : "Falso"
      case "open":
        return `<div class="open-answer-text">${answer}</div>`
      case "fill-blank":
        return Array.isArray(answer) ? answer.join(", ") : answer
      default:
        return "Tipo de respuesta desconocido"
    }
  }

  exportResults() {
    try {
      const results = this.getFilteredResults()
      const allData = window.dataManager.getAllData()

      // Prepare data for export
      const exportData = results.map((result) => {
        const student = allData.estudiantes.find((s) => s.id === result.estudianteId)
        const test = allData.pruebas.find((t) => t.id === result.pruebaId)
        const percentage = ((result.puntosTotales / result.puntosMaximos) * 100).toFixed(1)

        return {
          Fecha: new Date(result.fechaCompletado).toLocaleDateString(),
          Estudiante: student?.nombre || "N/A",
          Código: student?.codigo || "N/A",
          Prueba: test?.nombre || "N/A",
          Materia: test?.materia || "N/A",
          "Puntuación (%)": percentage,
          Puntos: `${result.puntosTotales}/${result.puntosMaximos}`,
          "Tiempo (min)": Math.round(result.tiempoTotal / 60),
          Estado: result.completado ? "Completado" : "Incompleto",
          "Auto-enviado": result.autoEnviado ? "Sí" : "No",
          Advertencias: result.cheatingFlags?.length || 0,
        }
      })

      // Convert to CSV
      const headers = Object.keys(exportData[0] || {})
      const csvContent = [
        headers.join(","),
        ...exportData.map((row) => headers.map((header) => `"${row[header]}"`).join(",")),
      ].join("\n")

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `resultados_evaluacion_${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.app.showAlert("Datos exportados exitosamente", "success")
    } catch (error) {
      console.error("Error exporting results:", error)
      window.app.showAlert("Error al exportar los datos", "error")
    }
  }

  setupEventListeners() {
    // Add any additional event listeners here
  }

  // Utility methods
  getScoreClass(percentage) {
    const score = Number.parseFloat(percentage)
    if (score >= 80) return "excellent"
    if (score >= 60) return "good"
    if (score >= 40) return "fair"
    return "poor"
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }
}

// Create global instance
window.resultsAnalyzer = new ResultsAnalyzer()
