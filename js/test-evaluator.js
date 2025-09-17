// Test Evaluator - Handles test taking functionality
class TestEvaluator {
  constructor() {
    this.currentTest = null
    this.currentStudent = null
    this.currentQuestionIndex = 0
    this.answers = []
    this.startTime = null
    this.timeRemaining = 0
    this.timerInterval = null
    this.isSubmitting = false

    // Anti-cheat tracking
    this.tabSwitches = 0
    this.windowBlurs = 0
    this.fullScreenExits = 0
    this.cheatingDetected = false
    this.warningCount = 0

    this.init()
  }

  init() {
    console.log("[v0] Test Evaluator initialized")
    this.setupAntiCheatListeners()
  }

  async startTest(testId, studentId) {
    try {
      // Get test and student data
      this.currentTest = window.db.data.tests.tests.find((t) => t.id === testId)
      this.currentStudent = window.db.data.students.students.find((s) => s.id === studentId)

      if (!this.currentTest) {
        this.showError("Prueba no encontrada")
        return
      }

      if (!this.currentStudent) {
        this.showError("Estudiante no encontrado")
        return
      }

      // Check if test is available
      const now = new Date()
      const startDate = new Date(this.currentTest.startDate)
      const endDate = new Date(this.currentTest.endDate)

      if (now < startDate) {
        this.showError("La prueba aún no está disponible")
        return
      }

      if (now > endDate) {
        this.showError("La prueba ya no está disponible")
        return
      }

      // Check if student already completed the test
      const existingResult = window.db.getResultsForStudent(studentId).find((r) => r.testId === testId)

      if (existingResult) {
        this.showError("Ya has completado esta prueba")
        return
      }

      // Initialize test session
      this.initializeTestSession()

      // Show test screen
      this.showTestScreen()

      // Show custom message if exists
      if (this.currentTest.customMessage) {
        this.showTestInstructions()
      } else {
        this.startTestTimer()
      }
    } catch (error) {
      console.error("[v0] Error starting test:", error)
      this.showError("Error al iniciar la prueba")
    }
  }

  initializeTestSession() {
    this.currentQuestionIndex = 0
    this.answers = []
    this.startTime = new Date()
    this.timeRemaining = this.currentTest.timeLimit
    this.tabSwitches = 0
    this.windowBlurs = 0
    this.fullScreenExits = 0
    this.cheatingDetected = false
    this.warningCount = 0
    this.isSubmitting = false

    // Initialize answers array
    this.currentTest.questions.forEach((question, index) => {
      this.answers[index] = {
        questionId: question.id,
        answer: question.type === "multiple-answer" ? [] : null,
        timeSpent: 0,
        startTime: null,
      }
    })

    // Randomize questions if enabled
    if (this.currentTest.randomizeQuestions) {
      this.shuffleArray(this.currentTest.questions)
    }

    // Randomize options if enabled
    if (this.currentTest.randomizeOptions) {
      this.currentTest.questions.forEach((question) => {
        if (question.options && question.options.length > 0) {
          this.shuffleArray(question.options)
        }
      })
    }
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  showTestScreen() {
    // Hide all other screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.add("hidden")
    })

    // Show test screen
    const testScreen = document.getElementById("test-screen")
    testScreen.classList.remove("hidden")

    // Enable fullscreen if required
    if (this.currentTest.fullScreenMode) {
      this.enterFullScreen()
    }

    // Update test header
    this.updateTestHeader()

    // Load first question
    this.loadQuestion(0)

    // Setup navigation
    this.setupTestNavigation()
  }

  showTestInstructions() {
    const modal = document.createElement("div")
    modal.className = "modal"
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Instrucciones de la Prueba</h3>
        </div>
        <div class="modal-body">
          <h4>${this.currentTest.title}</h4>
          <p><strong>Tiempo límite:</strong> ${Math.floor(this.currentTest.timeLimit / 60)} minutos</p>
          <p><strong>Total de preguntas:</strong> ${this.currentTest.questions.length}</p>
          <p><strong>Puntos por pregunta correcta:</strong> ${this.currentTest.pointsPerCorrect}</p>
          ${
            this.currentTest.pointsPerIncorrect > 0
              ? `<p><strong>Puntos descontados por incorrecta:</strong> ${this.currentTest.pointsPerIncorrect}</p>`
              : ""
          }
          
          <div class="instructions-message">
            <p>${this.currentTest.customMessage}</p>
          </div>
          
          <div class="instructions-rules">
            <h5>Reglas importantes:</h5>
            <ul>
              <li>Una vez iniciada, la prueba no se puede pausar</li>
              <li>Las respuestas se guardan automáticamente</li>
              <li>Al finalizar el tiempo, la prueba se enviará automáticamente</li>
              ${this.currentTest.preventCheating ? "<li>⚠️ Sistema anti-trampa activado</li>" : ""}
              ${this.currentTest.blockTabSwitch ? "<li>⚠️ No cambiar de pestaña durante la prueba</li>" : ""}
              ${this.currentTest.fullScreenMode ? "<li>⚠️ La prueba se ejecutará en pantalla completa</li>" : ""}
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="this.closest('.modal').remove(); window.testEvaluator.cancelTest()">
            Cancelar
          </button>
          <button class="btn-primary" onclick="this.closest('.modal').remove(); window.testEvaluator.startTestTimer()">
            Iniciar Prueba
          </button>
        </div>
      </div>
    `

    document.body.appendChild(modal)
  }

  startTestTimer() {
    this.startTime = new Date()
    this.answers[this.currentQuestionIndex].startTime = new Date()

    this.timerInterval = setInterval(() => {
      this.timeRemaining--
      this.updateTimer()

      if (this.timeRemaining <= 0) {
        this.timeUp()
      }
    }, 1000)

    // Enable anti-cheat if configured
    if (this.currentTest.preventCheating) {
      this.enableAntiCheat()
    }
  }

  updateTestHeader() {
    document.getElementById("test-title").textContent = this.currentTest.title
    this.updateTimer()
    this.updateProgress()
  }

  updateTimer() {
    const timerDisplay = document.getElementById("timer-display")
    const hours = Math.floor(this.timeRemaining / 3600)
    const minutes = Math.floor((this.timeRemaining % 3600) / 60)
    const seconds = this.timeRemaining % 60

    const timeString =
      hours > 0
        ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    timerDisplay.textContent = timeString

    // Change color based on remaining time
    timerDisplay.className = ""
    if (this.timeRemaining <= 300) {
      // 5 minutes
      timerDisplay.classList.add("danger")
    } else if (this.timeRemaining <= 600) {
      // 10 minutes
      timerDisplay.classList.add("warning")
    }
  }

  updateProgress() {
    const counter = document.getElementById("question-counter")
    const progressFill = document.getElementById("progress-fill")

    counter.textContent = `${this.currentQuestionIndex + 1} de ${this.currentTest.questions.length}`

    const progress = ((this.currentQuestionIndex + 1) / this.currentTest.questions.length) * 100
    progressFill.style.width = `${progress}%`
  }

  loadQuestion(questionIndex) {
    if (questionIndex < 0 || questionIndex >= this.currentTest.questions.length) {
      return
    }

    // Save time spent on previous question
    if (this.answers[this.currentQuestionIndex] && this.answers[this.currentQuestionIndex].startTime) {
      const timeSpent = (new Date() - this.answers[this.currentQuestionIndex].startTime) / 1000
      this.answers[this.currentQuestionIndex].timeSpent += timeSpent
    }

    this.currentQuestionIndex = questionIndex
    const question = this.currentTest.questions[questionIndex]

    // Start timing for new question
    this.answers[questionIndex].startTime = new Date()

    this.renderQuestion(question, questionIndex)
    this.updateProgress()
    this.updateNavigationButtons()
  }

  renderQuestion(question, questionIndex) {
    const container = document.getElementById("question-container")

    let questionHTML = `
      <div class="question-header">
        <div class="question-number-badge">Pregunta ${questionIndex + 1}</div>
        <div class="question-points">${question.points} puntos</div>
      </div>
      
      <div class="question-text">${question.question}</div>
      
      ${question.image ? `<img src="${question.image}" class="question-image" alt="Imagen de pregunta">` : ""}
    `

    if (question.type === "open-ended") {
      questionHTML += `
        <div class="answer-section">
          <textarea class="open-answer" placeholder="Escriba su respuesta aquí..." 
                    data-question-index="${questionIndex}">${this.answers[questionIndex].answer || ""}</textarea>
        </div>
      `
    } else {
      questionHTML += '<div class="answer-options">'

      question.options.forEach((option, optionIndex) => {
        const inputType = question.type === "multiple-answer" ? "checkbox" : "radio"
        const inputName = `question-${questionIndex}`
        const isChecked = this.isOptionSelected(questionIndex, option.id)

        questionHTML += `
          <div class="answer-option ${isChecked ? "selected" : ""}">
            <input type="${inputType}" 
                   name="${inputName}" 
                   value="${option.id}"
                   id="option-${questionIndex}-${optionIndex}"
                   ${isChecked ? "checked" : ""}
                   onchange="window.testEvaluator.handleAnswerChange(${questionIndex}, '${option.id}', this.checked)">
            <label for="option-${questionIndex}-${optionIndex}" class="option-text">
              ${option.text}
              ${option.image ? `<img src="${option.image}" class="option-image" alt="Imagen de opción">` : ""}
            </label>
          </div>
        `
      })

      questionHTML += "</div>"
    }

    container.innerHTML = questionHTML

    // Setup event listeners for open-ended questions
    if (question.type === "open-ended") {
      const textarea = container.querySelector(".open-answer")
      textarea.addEventListener("input", (e) => {
        this.answers[questionIndex].answer = e.target.value
        this.autoSave()
      })
    }
  }

  isOptionSelected(questionIndex, optionId) {
    const answer = this.answers[questionIndex].answer

    if (Array.isArray(answer)) {
      return answer.includes(optionId)
    } else {
      return answer === optionId
    }
  }

  handleAnswerChange(questionIndex, optionId, isChecked) {
    const question = this.currentTest.questions[questionIndex]

    if (question.type === "multiple-answer") {
      if (!Array.isArray(this.answers[questionIndex].answer)) {
        this.answers[questionIndex].answer = []
      }

      if (isChecked) {
        if (!this.answers[questionIndex].answer.includes(optionId)) {
          this.answers[questionIndex].answer.push(optionId)
        }
      } else {
        this.answers[questionIndex].answer = this.answers[questionIndex].answer.filter((id) => id !== optionId)
      }
    } else {
      this.answers[questionIndex].answer = isChecked ? optionId : null
    }

    // Update visual selection
    this.updateAnswerSelection(questionIndex)
    this.autoSave()
  }

  updateAnswerSelection(questionIndex) {
    const options = document.querySelectorAll(".answer-option")
    options.forEach((option) => {
      const input = option.querySelector("input")
      if (input.checked) {
        option.classList.add("selected")
      } else {
        option.classList.remove("selected")
      }
    })
  }

  setupTestNavigation() {
    const prevBtn = document.getElementById("prev-question")
    const nextBtn = document.getElementById("next-question")
    const finishBtn = document.getElementById("finish-test")

    prevBtn.addEventListener("click", () => this.previousQuestion())
    nextBtn.addEventListener("click", () => this.nextQuestion())
    finishBtn.addEventListener("click", () => this.finishTest())
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById("prev-question")
    const nextBtn = document.getElementById("next-question")
    const finishBtn = document.getElementById("finish-test")

    prevBtn.disabled = this.currentQuestionIndex === 0

    if (this.currentQuestionIndex === this.currentTest.questions.length - 1) {
      nextBtn.style.display = "none"
      finishBtn.style.display = "block"
    } else {
      nextBtn.style.display = "block"
      finishBtn.style.display = "none"
    }
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.loadQuestion(this.currentQuestionIndex - 1)
    }
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.currentTest.questions.length - 1) {
      this.loadQuestion(this.currentQuestionIndex + 1)
    }
  }

  async finishTest() {
    if (this.isSubmitting) return

    const unansweredCount = this.answers.filter(
      (answer) => answer.answer === null || (Array.isArray(answer.answer) && answer.answer.length === 0),
    ).length

    if (unansweredCount > 0) {
      const confirmSubmit = confirm(
        `Tienes ${unansweredCount} pregunta(s) sin responder. ¿Estás seguro que deseas enviar la prueba?`,
      )
      if (!confirmSubmit) return
    }

    this.isSubmitting = true
    await this.submitTest()
  }

  async submitTest() {
    try {
      // Stop timer
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
      }

      // Calculate final time spent on current question
      if (this.answers[this.currentQuestionIndex] && this.answers[this.currentQuestionIndex].startTime) {
        const timeSpent = (new Date() - this.answers[this.currentQuestionIndex].startTime) / 1000
        this.answers[this.currentQuestionIndex].timeSpent += timeSpent
      }

      // Calculate results
      const results = this.calculateResults()

      // Save results to database
      await window.db.saveTestResult(results)

      // Show completion screen
      this.showCompletionScreen(results)
    } catch (error) {
      console.error("[v0] Error submitting test:", error)
      this.showError("Error al enviar la prueba")
      this.isSubmitting = false
    }
  }

  calculateResults() {
    let correctAnswers = 0
    let incorrectAnswers = 0
    let totalScore = 0
    const maxScore = this.currentTest.questions.reduce((sum, q) => sum + q.points, 0)

    const detailedAnswers = this.answers.map((answer, index) => {
      const question = this.currentTest.questions[index]
      let isCorrect = false
      let points = 0

      if (question.type === "open-ended") {
        // Open-ended questions need manual grading
        points = 0
        isCorrect = null // Will be graded later
      } else {
        // Check if answer is correct
        if (question.type === "multiple-answer") {
          const correctOptions = question.options.filter((opt) => opt.isCorrect).map((opt) => opt.id)
          const studentAnswer = answer.answer || []

          isCorrect =
            correctOptions.length === studentAnswer.length && correctOptions.every((id) => studentAnswer.includes(id))
        } else {
          const correctOption = question.options.find((opt) => opt.isCorrect)
          isCorrect = correctOption && answer.answer === correctOption.id
        }

        if (isCorrect) {
          points = question.points
          correctAnswers++
        } else if (answer.answer !== null && (Array.isArray(answer.answer) ? answer.answer.length > 0 : true)) {
          points = -this.currentTest.pointsPerIncorrect
          incorrectAnswers++
        }
      }

      totalScore += points

      return {
        questionId: question.id,
        selectedOption: question.type === "multiple-answer" ? null : answer.answer,
        selectedOptions: question.type === "multiple-answer" ? answer.answer : null,
        answer: question.type === "open-ended" ? answer.answer : null,
        isCorrect: isCorrect,
        timeSpent: Math.round(answer.timeSpent),
        points: points,
      }
    })

    const totalTime = Math.round((new Date() - this.startTime) / 1000)
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
    const passed = percentage >= this.currentTest.passingScore

    return {
      testId: this.currentTest.id,
      studentId: this.currentStudent.id,
      studentCode: this.currentStudent.code,
      startTime: this.startTime.toISOString(),
      endTime: new Date().toISOString(),
      timeSpent: totalTime,
      totalQuestions: this.currentTest.questions.length,
      answeredQuestions: this.answers.filter(
        (a) => a.answer !== null && (Array.isArray(a.answer) ? a.answer.length > 0 : true),
      ).length,
      correctAnswers: correctAnswers,
      incorrectAnswers: incorrectAnswers,
      score: Math.max(0, totalScore),
      maxScore: maxScore,
      percentage: Math.max(0, percentage),
      passed: passed,
      cheatingDetected: this.cheatingDetected,
      tabSwitches: this.tabSwitches,
      fullScreenExits: this.fullScreenExits,
      status: "completed",
      answers: detailedAnswers,
    }
  }

  showCompletionScreen(results) {
    const testScreen = document.getElementById("test-screen")

    let completionHTML = `
      <div class="test-completion">
        <div class="completion-icon">✅</div>
        <h2>¡Prueba Completada!</h2>
        <div class="completion-message">
          ${
            this.currentTest.showResults
              ? `<p>Has completado la prueba "${this.currentTest.title}"</p>`
              : "<p>Tu prueba ha sido enviada exitosamente. Los resultados serán publicados por tu profesor.</p>"
          }
        </div>
    `

    if (this.currentTest.showResults) {
      completionHTML += `
        <div class="completion-stats">
          <div class="completion-stat">
            <h4>${results.score.toFixed(1)}</h4>
            <p>Puntuación Final</p>
          </div>
          <div class="completion-stat">
            <h4>${results.percentage.toFixed(1)}%</h4>
            <p>Porcentaje</p>
          </div>
          <div class="completion-stat">
            <h4>${results.correctAnswers}/${results.totalQuestions}</h4>
            <p>Respuestas Correctas</p>
          </div>
          <div class="completion-stat">
            <h4>${this.formatTime(results.timeSpent)}</h4>
            <p>Tiempo Total</p>
          </div>
        </div>
        
        <div class="completion-result">
          <h3 class="${results.passed ? "passed" : "failed"}">
            ${results.passed ? "🎉 ¡APROBADO!" : "❌ No Aprobado"}
          </h3>
          <p>Puntuación mínima requerida: ${this.currentTest.passingScore}%</p>
        </div>
      `
    }

    completionHTML += `
        <div class="completion-actions">
          <button class="btn-primary" onclick="window.testEvaluator.returnToDashboard()">
            Volver al Dashboard
          </button>
        </div>
      </div>
    `

    testScreen.innerHTML = completionHTML

    // Disable anti-cheat
    this.disableAntiCheat()

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }

  timeUp() {
    if (this.isSubmitting) return

    this.showWarning("¡Tiempo agotado! La prueba se enviará automáticamente.")

    setTimeout(() => {
      this.submitTest()
    }, 2000)
  }

  cancelTest() {
    if (confirm("¿Estás seguro que deseas cancelar la prueba? Se perderá todo el progreso.")) {
      this.cleanup()
      this.returnToDashboard()
    }
  }

  returnToDashboard() {
    this.cleanup()

    // Show dashboard
    document.getElementById("test-screen").classList.add("hidden")
    document.getElementById("dashboard-screen").classList.remove("hidden")

    if (window.dashboardManager) {
      window.dashboardManager.showSection("overview")
    }
  }

  cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }

    this.disableAntiCheat()

    if (document.fullscreenElement) {
      document.exitFullscreen()
    }

    // Reset state
    this.currentTest = null
    this.currentStudent = null
    this.currentQuestionIndex = 0
    this.answers = []
    this.startTime = null
    this.timeRemaining = 0
    this.isSubmitting = false
  }

  // Anti-cheat functionality
  setupAntiCheatListeners() {
    // These are set up in main.js as global listeners
  }

  enableAntiCheat() {
    if (window.authManager) {
      window.authManager.enableAntiCheat()
    }
  }

  disableAntiCheat() {
    if (window.authManager) {
      window.authManager.disableAntiCheat()
    }
  }

  recordTabSwitch() {
    if (!this.currentTest || !this.currentTest.blockTabSwitch) return

    this.tabSwitches++
    this.warningCount++
    this.cheatingDetected = true

    this.showCheatWarning(
      "⚠️ Cambio de pestaña detectado",
      `Advertencia ${this.warningCount}/3: No cambies de pestaña durante la prueba.`,
    )

    if (this.warningCount >= 3) {
      this.showError("Demasiadas violaciones detectadas. La prueba se enviará automáticamente.")
      setTimeout(() => this.submitTest(), 2000)
    }
  }

  recordWindowBlur() {
    if (!this.currentTest || !this.currentTest.preventCheating) return

    this.windowBlurs++
    if (this.windowBlurs > 2) {
      this.cheatingDetected = true
    }
  }

  recordWindowFocus() {
    // Record when window regains focus
  }

  recordFullScreenExit() {
    if (!this.currentTest || !this.currentTest.fullScreenMode) return

    this.fullScreenExits++
    this.warningCount++
    this.cheatingDetected = true

    this.showCheatWarning(
      "⚠️ Salida de pantalla completa detectada",
      `Advertencia ${this.warningCount}/3: Mantén la pantalla completa durante la prueba.`,
    )

    // Try to re-enter fullscreen
    setTimeout(() => this.enterFullScreen(), 1000)
  }

  showCheatWarning(title, message) {
    const warning = document.createElement("div")
    warning.className = "cheat-warning"
    warning.innerHTML = `
      <div class="cheat-warning-content">
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="cheat-counter">3</div>
        <p>La prueba continuará en <span id="cheat-countdown">3</span> segundos...</p>
      </div>
    `

    document.body.appendChild(warning)

    let countdown = 3
    const countdownInterval = setInterval(() => {
      countdown--
      const countdownEl = document.getElementById("cheat-countdown")
      const counterEl = warning.querySelector(".cheat-counter")

      if (countdownEl) countdownEl.textContent = countdown
      if (counterEl) counterEl.textContent = countdown

      if (countdown <= 0) {
        clearInterval(countdownInterval)
        warning.remove()
      }
    }, 1000)
  }

  enterFullScreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("[v0] Could not enter fullscreen:", err)
      })
    }
  }

  // Auto-save functionality
  autoSave() {
    // Save current progress to localStorage
    const saveData = {
      testId: this.currentTest?.id,
      studentId: this.currentStudent?.id,
      answers: this.answers,
      currentQuestionIndex: this.currentQuestionIndex,
      startTime: this.startTime,
      timeRemaining: this.timeRemaining,
      timestamp: new Date().toISOString(),
    }

    try {
      localStorage.setItem("evalua_test_progress", JSON.stringify(saveData))
    } catch (error) {
      console.warn("[v0] Could not auto-save progress:", error)
    }
  }

  loadSavedProgress() {
    try {
      const savedData = localStorage.getItem("evalua_test_progress")
      if (savedData) {
        const progress = JSON.parse(savedData)

        // Check if saved progress is recent (within 1 hour)
        const saveTime = new Date(progress.timestamp)
        const now = new Date()
        const hoursDiff = (now - saveTime) / (1000 * 60 * 60)

        if (hoursDiff < 1 && progress.testId && progress.studentId) {
          return progress
        }
      }
    } catch (error) {
      console.warn("[v0] Could not load saved progress:", error)
    }

    return null
  }

  clearSavedProgress() {
    localStorage.removeItem("evalua_test_progress")
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

  showWarning(message) {
    if (window.authManager) {
      window.authManager.showMessage(message, "warning")
    }
  }
}

// Initialize global test evaluator
window.TestEvaluator = TestEvaluator
