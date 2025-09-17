// Test Evaluator - Handles test taking, timer, and anti-cheat features
class TestEvaluator {
  constructor() {
    this.currentTest = null
    this.currentStudent = null
    this.startTime = null
    this.endTime = null
    this.timeRemaining = 0
    this.timer = null
    this.currentQuestionIndex = 0
    this.answers = {}
    this.isTestActive = false
    this.tabChangeCount = 0
    this.visibilityChangeCount = 0
    this.cheatingFlags = []
    this.autoSaveInterval = null
    this.warningShown = false
  }

  startTest(testId, studentId) {
    try {
      // Get test and student data
      const allData = window.dataManager.getAllData()
      this.currentTest = allData.pruebas.find((t) => t.id === testId)
      this.currentStudent = allData.estudiantes.find((s) => s.id === studentId)

      if (!this.currentTest || !this.currentStudent) {
        throw new Error("Prueba o estudiante no encontrado")
      }

      // Check if test is available
      const now = new Date()
      const startDate = new Date(this.currentTest.fechaInicio)
      const endDate = new Date(this.currentTest.fechaFin)

      if (now < startDate) {
        throw new Error("La prueba aún no está disponible")
      }

      if (now > endDate) {
        throw new Error("La prueba ya ha finalizado")
      }

      // Check if student has already taken the test
      const existingResult = allData.resultados.find(
        (r) => r.pruebaId === testId && r.estudianteId === studentId && r.completado,
      )

      if (existingResult) {
        throw new Error("Ya has completado esta prueba")
      }

      // Initialize test session
      this.initializeTestSession()
      this.showTestInterface()
    } catch (error) {
      console.error("Error starting test:", error)
      window.app.showAlert(error.message, "error")
    }
  }

  initializeTestSession() {
    this.startTime = new Date()
    this.timeRemaining = this.currentTest.duracion * 60 // Convert to seconds
    this.currentQuestionIndex = 0
    this.answers = {}
    this.isTestActive = true
    this.tabChangeCount = 0
    this.visibilityChangeCount = 0
    this.cheatingFlags = []
    this.warningShown = false

    // Shuffle questions if configured
    if (this.currentTest.configuracion.mezclarPreguntas) {
      this.currentTest.preguntas = this.shuffleArray([...this.currentTest.preguntas])
    }

    // Shuffle answers for multiple choice questions if configured
    if (this.currentTest.configuracion.mezclarRespuestas) {
      this.currentTest.preguntas.forEach((question) => {
        if (question.tipo === "multiple" && question.respuestas.opciones) {
          const correctIndex = question.respuestas.correcta
          const correctOption = question.respuestas.opciones[correctIndex]

          question.respuestas.opciones = this.shuffleArray([...question.respuestas.opciones])
          question.respuestas.correcta = question.respuestas.opciones.findIndex(
            (option) => option.texto === correctOption.texto,
          )
        }
      })
    }

    // Setup anti-cheat monitoring
    this.setupAntiCheatMonitoring()

    // Setup auto-save
    this.setupAutoSave()
  }

  showTestInterface() {
    const contentContainer = document.getElementById("content-container")

    contentContainer.innerHTML = `
      <div class="test-evaluator-container">
        <!-- Test Header -->
        <div class="test-header">
          <div class="test-info">
            <h1>${this.currentTest.nombre}</h1>
            <p>${this.currentTest.descripcion || ""}</p>
            <div class="test-meta">
              <span>Estudiante: ${this.currentStudent.nombre}</span>
              <span>Preguntas: ${this.currentTest.preguntas.length}</span>
              <span>Duración: ${this.currentTest.duracion} minutos</span>
            </div>
          </div>
          
          <div class="test-timer">
            <div class="timer-display" id="timer-display">
              <span class="timer-label">Tiempo restante:</span>
              <span class="timer-value" id="timer-value">--:--</span>
            </div>
            <div class="timer-progress">
              <div class="timer-progress-bar" id="timer-progress-bar"></div>
            </div>
          </div>
        </div>

        <!-- Question Navigation -->
        <div class="question-navigation">
          <div class="question-counter">
            Pregunta <span id="current-question-number">1</span> de ${this.currentTest.preguntas.length}
          </div>
          <div class="question-indicators" id="question-indicators">
            ${this.renderQuestionIndicators()}
          </div>
        </div>

        <!-- Question Content -->
        <div class="question-container" id="question-container">
          ${this.renderCurrentQuestion()}
        </div>

        <!-- Navigation Controls -->
        <div class="test-controls">
          <button class="btn-secondary" id="prev-btn" onclick="window.testEvaluator.previousQuestion()" 
                  ${this.currentQuestionIndex === 0 || !this.currentTest.configuracion.permitirRetroceso ? "disabled" : ""}>
            Anterior
          </button>
          
          <div class="control-center">
            <button class="btn-secondary" onclick="window.testEvaluator.showReviewModal()">
              Revisar Respuestas
            </button>
            <button class="btn-destructive" onclick="window.testEvaluator.showSubmitConfirmation()">
              Finalizar Prueba
            </button>
          </div>
          
          <button class="btn-primary" id="next-btn" onclick="window.testEvaluator.nextQuestion()">
            ${this.currentQuestionIndex === this.currentTest.preguntas.length - 1 ? "Finalizar" : "Siguiente"}
          </button>
        </div>

        <!-- Warning Modal -->
        <div id="warning-modal" class="modal hidden">
          <div class="modal-content warning-modal">
            <div class="modal-header">
              <h3>⚠️ Advertencia</h3>
            </div>
            <div class="modal-body">
              <p id="warning-message"></p>
              <p><strong>Esta acción ha sido registrada.</strong></p>
            </div>
            <div class="modal-footer">
              <button class="btn-primary" onclick="window.testEvaluator.closeWarningModal()">
                Entendido
              </button>
            </div>
          </div>
        </div>

        <!-- Review Modal -->
        <div id="review-modal" class="modal hidden">
          <div class="modal-content review-modal">
            <div class="modal-header">
              <h3>Revisar Respuestas</h3>
              <button class="modal-close" onclick="window.testEvaluator.closeReviewModal()">&times;</button>
            </div>
            <div class="modal-body">
              <div id="review-content"></div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="window.testEvaluator.closeReviewModal()">
                Cerrar
              </button>
            </div>
          </div>
        </div>

        <!-- Submit Confirmation Modal -->
        <div id="submit-modal" class="modal hidden">
          <div class="modal-content submit-modal">
            <div class="modal-header">
              <h3>Confirmar Envío</h3>
            </div>
            <div class="modal-body">
              <p>¿Estás seguro de que quieres finalizar la prueba?</p>
              <div class="submit-summary">
                <p>Preguntas respondidas: <span id="answered-count">0</span> de ${this.currentTest.preguntas.length}</p>
                <p>Tiempo utilizado: <span id="time-used">0</span></p>
              </div>
              <p><strong>Una vez enviada, no podrás hacer cambios.</strong></p>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="window.testEvaluator.closeSubmitModal()">
                Cancelar
              </button>
              <button class="btn-destructive" onclick="window.testEvaluator.submitTest()">
                Finalizar Prueba
              </button>
            </div>
          </div>
        </div>

        <!-- Results Modal -->
        <div id="results-modal" class="modal hidden">
          <div class="modal-content results-modal">
            <div class="modal-header">
              <h3>Prueba Completada</h3>
            </div>
            <div class="modal-body">
              <div id="results-content"></div>
            </div>
            <div class="modal-footer">
              <button class="btn-primary" onclick="window.testEvaluator.returnToDashboard()">
                Volver al Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    this.startTimer()
    this.updateQuestionIndicators()
    this.setupTestEventListeners()
  }

  renderQuestionIndicators() {
    return this.currentTest.preguntas
      .map(
        (_, index) => `
      <div class="question-indicator ${index === this.currentQuestionIndex ? "current" : ""} ${this.answers[index] ? "answered" : ""}" 
           onclick="window.testEvaluator.goToQuestion(${index})">
        ${index + 1}
      </div>
    `,
      )
      .join("")
  }

  renderCurrentQuestion() {
    const question = this.currentTest.preguntas[this.currentQuestionIndex]
    const savedAnswer = this.answers[this.currentQuestionIndex]

    const questionHTML = `
      <div class="question-content">
        <div class="question-header">
          <div class="question-points">
            ${question.puntos || 1} punto${(question.puntos || 1) !== 1 ? "s" : ""}
          </div>
        </div>
        
        <div class="question-text">
          ${this.formatQuestionText(question.pregunta)}
        </div>
        
        ${question.imagen ? `<div class="question-image"><img src="${question.imagen}" alt="Imagen de la pregunta"></div>` : ""}
        
        <div class="question-answers">
          ${this.renderAnswerOptions(question, savedAnswer)}
        </div>
      </div>
    `

    return questionHTML
  }

  renderAnswerOptions(question, savedAnswer) {
    switch (question.tipo) {
      case "multiple":
        return this.renderMultipleChoice(question, savedAnswer)
      case "true-false":
        return this.renderTrueFalse(question, savedAnswer)
      case "open":
        return this.renderOpenAnswer(question, savedAnswer)
      case "fill-blank":
        return this.renderFillBlank(question, savedAnswer)
      default:
        return "<p>Tipo de pregunta no soportado</p>"
    }
  }

  renderMultipleChoice(question, savedAnswer) {
    return `
      <div class="multiple-choice-options">
        ${question.respuestas.opciones
          .map(
            (opcion, index) => `
          <label class="option-label">
            <input type="radio" name="question-${this.currentQuestionIndex}" value="${index}" 
                   ${savedAnswer === index ? "checked" : ""} 
                   onchange="window.testEvaluator.saveAnswer(${index})">
            <span class="option-mark"></span>
            <span class="option-text">
              ${String.fromCharCode(65 + index)}. ${opcion.texto}
              ${opcion.imagen ? `<img src="${opcion.imagen}" alt="Opción ${index + 1}" class="option-image">` : ""}
            </span>
          </label>
        `,
          )
          .join("")}
      </div>
    `
  }

  renderTrueFalse(question, savedAnswer) {
    return `
      <div class="true-false-options">
        <label class="option-label">
          <input type="radio" name="question-${this.currentQuestionIndex}" value="true" 
                 ${savedAnswer === true ? "checked" : ""} 
                 onchange="window.testEvaluator.saveAnswer(true)">
          <span class="option-mark"></span>
          <span class="option-text">Verdadero</span>
        </label>
        <label class="option-label">
          <input type="radio" name="question-${this.currentQuestionIndex}" value="false" 
                 ${savedAnswer === false ? "checked" : ""} 
                 onchange="window.testEvaluator.saveAnswer(false)">
          <span class="option-mark"></span>
          <span class="option-text">Falso</span>
        </label>
      </div>
    `
  }

  renderOpenAnswer(question, savedAnswer) {
    return `
      <div class="open-answer">
        <textarea class="open-answer-text" placeholder="Escribe tu respuesta aquí..." 
                  rows="5" onchange="window.testEvaluator.saveAnswer(this.value)">${savedAnswer || ""}</textarea>
        <div class="answer-info">
          <small>Respuesta abierta - Escribe tu respuesta de forma clara y completa</small>
        </div>
      </div>
    `
  }

  renderFillBlank(question, savedAnswer) {
    const blanks = question.respuestas.respuestas || []
    const answers = savedAnswer || []

    return `
      <div class="fill-blank-answer">
        <div class="blank-instruction">
          <p>Completa los espacios en blanco:</p>
        </div>
        <div class="blank-inputs">
          ${blanks
            .map(
              (_, index) => `
            <div class="blank-input-group">
              <label>Espacio ${index + 1}:</label>
              <input type="text" class="blank-input" placeholder="Tu respuesta" 
                     value="${answers[index] || ""}" 
                     onchange="window.testEvaluator.saveFillBlankAnswer(${index}, this.value)">
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
  }

  formatQuestionText(text) {
    // Convert markdown-like formatting to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/__(.*?)__/g, "<u>$1</u>")
      .replace(/\n/g, "<br>")
  }

  saveAnswer(answer) {
    this.answers[this.currentQuestionIndex] = answer
    this.updateQuestionIndicators()
    this.autoSaveProgress()
  }

  saveFillBlankAnswer(blankIndex, value) {
    if (!this.answers[this.currentQuestionIndex]) {
      this.answers[this.currentQuestionIndex] = []
    }
    this.answers[this.currentQuestionIndex][blankIndex] = value
    this.updateQuestionIndicators()
    this.autoSaveProgress()
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.currentTest.preguntas.length - 1) {
      this.currentQuestionIndex++
      this.updateQuestionDisplay()
    } else {
      this.showSubmitConfirmation()
    }
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0 && this.currentTest.configuracion.permitirRetroceso) {
      this.currentQuestionIndex--
      this.updateQuestionDisplay()
    }
  }

  goToQuestion(index) {
    if (index >= 0 && index < this.currentTest.preguntas.length) {
      this.currentQuestionIndex = index
      this.updateQuestionDisplay()
    }
  }

  updateQuestionDisplay() {
    document.getElementById("question-container").innerHTML = this.renderCurrentQuestion()
    document.getElementById("current-question-number").textContent = this.currentQuestionIndex + 1
    this.updateQuestionIndicators()
    this.updateNavigationButtons()
  }

  updateQuestionIndicators() {
    document.getElementById("question-indicators").innerHTML = this.renderQuestionIndicators()
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById("prev-btn")
    const nextBtn = document.getElementById("next-btn")

    prevBtn.disabled = this.currentQuestionIndex === 0 || !this.currentTest.configuracion.permitirRetroceso
    nextBtn.textContent =
      this.currentQuestionIndex === this.currentTest.preguntas.length - 1 ? "Finalizar" : "Siguiente"
  }

  startTimer() {
    this.updateTimerDisplay()

    this.timer = setInterval(() => {
      this.timeRemaining--
      this.updateTimerDisplay()

      if (this.timeRemaining <= 0) {
        this.timeUp()
      } else if (this.timeRemaining <= 300 && !this.warningShown) {
        // 5 minutes warning
        this.showTimeWarning()
        this.warningShown = true
      }
    }, 1000)
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeRemaining / 60)
    const seconds = this.timeRemaining % 60
    const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    document.getElementById("timer-value").textContent = timeString

    // Update progress bar
    const totalTime = this.currentTest.duracion * 60
    const progress = ((totalTime - this.timeRemaining) / totalTime) * 100
    document.getElementById("timer-progress-bar").style.width = `${progress}%`

    // Change color when time is running low
    const timerValue = document.getElementById("timer-value")
    if (this.timeRemaining <= 300) {
      // 5 minutes
      timerValue.style.color = "var(--destructive)"
    } else if (this.timeRemaining <= 600) {
      // 10 minutes
      timerValue.style.color = "#f59e0b"
    }
  }

  showTimeWarning() {
    this.showWarning("Quedan menos de 5 minutos para finalizar la prueba.")
  }

  timeUp() {
    clearInterval(this.timer)
    this.showWarning("El tiempo ha terminado. La prueba se enviará automáticamente.")

    setTimeout(() => {
      this.submitTest(true) // Auto-submit
    }, 3000)
  }

  setupAntiCheatMonitoring() {
    if (!this.currentTest.configuracion.bloquearCambioTab) return

    // Tab/Window change detection
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.isTestActive) {
        this.visibilityChangeCount++
        this.cheatingFlags.push({
          type: "visibility_change",
          timestamp: new Date().toISOString(),
          count: this.visibilityChangeCount,
        })

        this.showWarning(this.currentTest.configuracion.mensajeAlerta || "No cambies de pestaña durante la prueba")
      }
    })

    // Window focus/blur detection
    window.addEventListener("blur", () => {
      if (this.isTestActive) {
        this.tabChangeCount++
        this.cheatingFlags.push({
          type: "window_blur",
          timestamp: new Date().toISOString(),
          count: this.tabChangeCount,
        })
      }
    })

    // Prevent right-click context menu
    document.addEventListener("contextmenu", (e) => {
      if (this.isTestActive) {
        e.preventDefault()
        this.showWarning("El menú contextual está deshabilitado durante la prueba")
      }
    })

    // Prevent common keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (this.isTestActive) {
        // Prevent F12, Ctrl+Shift+I, Ctrl+U, etc.
        if (
          e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && e.key === "I") ||
          (e.ctrlKey && e.key === "u") ||
          (e.ctrlKey && e.shiftKey && e.key === "C")
        ) {
          e.preventDefault()
          this.cheatingFlags.push({
            type: "blocked_shortcut",
            timestamp: new Date().toISOString(),
            key: e.key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
          })
          this.showWarning("Los atajos de teclado están deshabilitados durante la prueba")
        }
      }
    })
  }

  setupAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      this.autoSaveProgress()
    }, 30000) // Auto-save every 30 seconds
  }

  autoSaveProgress() {
    const progressData = {
      testId: this.currentTest.id,
      studentId: this.currentStudent.id,
      answers: this.answers,
      currentQuestionIndex: this.currentQuestionIndex,
      timeRemaining: this.timeRemaining,
      cheatingFlags: this.cheatingFlags,
      lastSaved: new Date().toISOString(),
    }

    localStorage.setItem("test_progress", JSON.stringify(progressData))
  }

  setupTestEventListeners() {
    // Prevent page refresh/close during test
    window.addEventListener("beforeunload", (e) => {
      if (this.isTestActive) {
        e.preventDefault()
        e.returnValue = "Tienes una prueba en progreso. ¿Estás seguro de que quieres salir?"
        return e.returnValue
      }
    })
  }

  showWarning(message) {
    document.getElementById("warning-message").textContent = message
    document.getElementById("warning-modal").classList.remove("hidden")
  }

  closeWarningModal() {
    document.getElementById("warning-modal").classList.add("hidden")
  }

  showReviewModal() {
    const reviewContent = document.getElementById("review-content")
    const answeredCount = Object.keys(this.answers).length

    let reviewHTML = `
      <div class="review-summary">
        <p><strong>Progreso:</strong> ${answeredCount} de ${this.currentTest.preguntas.length} preguntas respondidas</p>
      </div>
      <div class="review-questions">
    `

    this.currentTest.preguntas.forEach((question, index) => {
      const hasAnswer = this.answers.hasOwnProperty(index)
      const answerText = this.getAnswerText(question, this.answers[index])

      reviewHTML += `
        <div class="review-question ${hasAnswer ? "answered" : "unanswered"}">
          <div class="review-question-header">
            <span class="review-question-number">${index + 1}</span>
            <span class="review-question-status">${hasAnswer ? "Respondida" : "Sin responder"}</span>
            <button class="btn-small btn-secondary" onclick="window.testEvaluator.goToQuestionFromReview(${index})">
              Ir a pregunta
            </button>
          </div>
          <div class="review-question-text">${this.truncateText(question.pregunta, 100)}</div>
          ${hasAnswer ? `<div class="review-answer">Respuesta: ${answerText}</div>` : ""}
        </div>
      `
    })

    reviewHTML += "</div>"
    reviewContent.innerHTML = reviewHTML
    document.getElementById("review-modal").classList.remove("hidden")
  }

  closeReviewModal() {
    document.getElementById("review-modal").classList.add("hidden")
  }

  goToQuestionFromReview(index) {
    this.closeReviewModal()
    this.goToQuestion(index)
  }

  showSubmitConfirmation() {
    const answeredCount = Object.keys(this.answers).length
    const timeUsed = this.formatTime(this.currentTest.duracion * 60 - this.timeRemaining)

    document.getElementById("answered-count").textContent = answeredCount
    document.getElementById("time-used").textContent = timeUsed
    document.getElementById("submit-modal").classList.remove("hidden")
  }

  closeSubmitModal() {
    document.getElementById("submit-modal").classList.add("hidden")
  }

  submitTest(autoSubmit = false) {
    try {
      this.isTestActive = false
      this.endTime = new Date()

      // Clear timers and intervals
      if (this.timer) clearInterval(this.timer)
      if (this.autoSaveInterval) clearInterval(this.autoSaveInterval)

      // Calculate results
      const results = this.calculateResults()

      // Save results to data manager
      const resultData = {
        pruebaId: this.currentTest.id,
        estudianteId: this.currentStudent.id,
        respuestas: this.answers,
        puntosTotales: results.score,
        puntosMaximos: results.maxScore,
        tiempoTotal: Math.floor(this.currentTest.duracion * 60 - this.timeRemaining),
        completado: true,
        autoEnviado: autoSubmit,
        cheatingFlags: this.cheatingFlags,
        detalleRespuestas: results.details,
      }

      window.dataManager.saveTestResult(resultData)

      // Clear progress data
      localStorage.removeItem("test_progress")

      // Show results
      this.showResults(results, autoSubmit)
    } catch (error) {
      console.error("Error submitting test:", error)
      window.app.showAlert("Error al enviar la prueba", "error")
    }
  }

  calculateResults() {
    let score = 0
    let maxScore = 0
    const details = []

    this.currentTest.preguntas.forEach((question, index) => {
      const questionPoints = question.puntos || 1
      maxScore += questionPoints

      const userAnswer = this.answers[index]
      let isCorrect = false
      let pointsEarned = 0

      if (userAnswer !== undefined && userAnswer !== null && userAnswer !== "") {
        switch (question.tipo) {
          case "multiple":
            isCorrect = userAnswer === question.respuestas.correcta
            break
          case "true-false":
            isCorrect = userAnswer === question.respuestas.correcta
            break
          case "open":
            isCorrect = this.evaluateOpenAnswer(userAnswer, question.respuestas)
            break
          case "fill-blank":
            isCorrect = this.evaluateFillBlankAnswer(userAnswer, question.respuestas)
            break
        }

        if (isCorrect) {
          pointsEarned = questionPoints
        } else {
          pointsEarned = -Math.min(this.currentTest.puntosReducidosPorIncorrecta || 0, questionPoints)
        }
      }

      score += pointsEarned

      details.push({
        questionIndex: index,
        userAnswer,
        isCorrect,
        pointsEarned,
        maxPoints: questionPoints,
      })
    })

    // Ensure score doesn't go below 0
    score = Math.max(0, score)

    return {
      score,
      maxScore,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      details,
    }
  }

  evaluateOpenAnswer(userAnswer, correctAnswers) {
    if (!correctAnswers.palabrasClave || correctAnswers.palabrasClave.length === 0) {
      return true // If no keywords specified, consider it correct (manual review needed)
    }

    const userText = correctAnswers.sensibleMayusculas ? userAnswer : userAnswer.toLowerCase()

    return correctAnswers.palabrasClave.some((keyword) => {
      const searchKeyword = correctAnswers.sensibleMayusculas ? keyword : keyword.toLowerCase()
      return userText.includes(searchKeyword.trim())
    })
  }

  evaluateFillBlankAnswer(userAnswers, correctAnswers) {
    if (!Array.isArray(userAnswers) || !Array.isArray(correctAnswers.respuestas)) {
      return false
    }

    return correctAnswers.respuestas.every((correctAnswer, index) => {
      const userAnswer = userAnswers[index]
      if (!userAnswer) return false

      return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    })
  }

  showResults(results, autoSubmit) {
    this.closeSubmitModal()

    const resultsContent = document.getElementById("results-content")
    const percentage = results.percentage.toFixed(1)

    let resultsHTML = `
      <div class="results-summary">
        <div class="results-score">
          <div class="score-circle ${this.getScoreClass(percentage)}">
            <span class="score-percentage">${percentage}%</span>
            <span class="score-points">${results.score}/${results.maxScore} puntos</span>
          </div>
        </div>
        
        <div class="results-info">
          <h4>${this.getScoreMessage(percentage)}</h4>
          <div class="results-details">
            <p><strong>Tiempo utilizado:</strong> ${this.formatTime(this.currentTest.duracion * 60 - this.timeRemaining)}</p>
            <p><strong>Preguntas respondidas:</strong> ${Object.keys(this.answers).length} de ${this.currentTest.preguntas.length}</p>
            ${autoSubmit ? "<p><strong>Nota:</strong> La prueba se envió automáticamente al terminar el tiempo.</p>" : ""}
            ${this.cheatingFlags.length > 0 ? `<p class="warning-text"><strong>Advertencias registradas:</strong> ${this.cheatingFlags.length}</p>` : ""}
          </div>
        </div>
      </div>
      
      ${
        this.currentTest.configuracion.mensajeFinal
          ? `
        <div class="final-message">
          <p>${this.currentTest.configuracion.mensajeFinal}</p>
        </div>
      `
          : ""
      }
    `

    // Show detailed results if configured
    if (this.currentTest.configuracion.mostrarPuntaje) {
      resultsHTML += `
        <div class="detailed-results">
          <h5>Detalle por pregunta:</h5>
          <div class="question-results">
            ${results.details
              .map(
                (detail, index) => `
              <div class="question-result ${detail.isCorrect ? "correct" : "incorrect"}">
                <span class="question-number">${index + 1}</span>
                <span class="question-status">${detail.isCorrect ? "✓" : "✗"}</span>
                <span class="question-points">${detail.pointsEarned}/${detail.maxPoints} pts</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
    }

    resultsContent.innerHTML = resultsHTML
    document.getElementById("results-modal").classList.remove("hidden")
  }

  getScoreClass(percentage) {
    if (percentage >= 80) return "excellent"
    if (percentage >= 60) return "good"
    if (percentage >= 40) return "fair"
    return "poor"
  }

  getScoreMessage(percentage) {
    if (percentage >= 90) return "¡Excelente trabajo!"
    if (percentage >= 80) return "¡Muy bien hecho!"
    if (percentage >= 70) return "Buen trabajo"
    if (percentage >= 60) return "Trabajo satisfactorio"
    if (percentage >= 50) return "Necesitas mejorar"
    return "Debes estudiar más"
  }

  returnToDashboard() {
    // Clean up
    this.currentTest = null
    this.currentStudent = null
    this.answers = {}
    this.isTestActive = false

    if (this.timer) clearInterval(this.timer)
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval)

    // Remove event listeners
    window.removeEventListener("beforeunload", this.beforeUnloadHandler)

    // Return to dashboard
    window.app.loadView("dashboard")
  }

  // Utility methods
  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
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

  getAnswerText(question, answer) {
    if (answer === undefined || answer === null || answer === "") {
      return "Sin responder"
    }

    switch (question.tipo) {
      case "multiple":
        const option = question.respuestas.opciones[answer]
        return option ? `${String.fromCharCode(65 + answer)}. ${option.texto}` : "Respuesta inválida"
      case "true-false":
        return answer ? "Verdadero" : "Falso"
      case "open":
        return this.truncateText(answer, 50)
      case "fill-blank":
        return Array.isArray(answer) ? answer.join(", ") : answer
      default:
        return "Tipo de respuesta desconocido"
    }
  }
}

// Create global instance
window.testEvaluator = new TestEvaluator()
