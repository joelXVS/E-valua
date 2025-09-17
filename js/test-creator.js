// Test Creator Module - Handles test creation and editing
class TestCreator {
  constructor() {
    this.currentTest = null
    this.currentStep = 1
    this.questions = []
    this.isEditing = false
    this.editingQuestionIndex = -1

    this.init()
  }

  init() {
    console.log("[v0] Test Creator initialized")
  }

  render(container) {
    if (!container) return

    container.innerHTML = this.getTestCreatorHTML()
    this.setupEventListeners()
    this.loadStep(1)
  }

  getTestCreatorHTML() {
    return `
      <div class="test-creator">
        <div class="test-creator-header">
          <h2>Crear Nueva Prueba</h2>
          <div class="test-creator-steps">
            <div class="step" data-step="1">
              <div class="step-number">1</div>
              <div class="step-label">Configuración</div>
            </div>
            <div class="step" data-step="2">
              <div class="step-number">2</div>
              <div class="step-label">Preguntas</div>
            </div>
            <div class="step" data-step="3">
              <div class="step-number">3</div>
              <div class="step-label">Revisión</div>
            </div>
          </div>
        </div>

        <div class="test-creator-content">
          <div id="step-1" class="creator-step">
            <!-- Step 1: Test Configuration -->
            <div class="test-config">
              <div class="config-group">
                <h3>Información Básica</h3>
                <div class="form-group">
                  <label for="test-title">Título de la Prueba</label>
                  <input type="text" id="test-title" placeholder="Ej: Examen de Matemáticas - Álgebra">
                </div>
                <div class="form-group">
                  <label for="test-description">Descripción</label>
                  <textarea id="test-description" placeholder="Descripción detallada de la prueba..."></textarea>
                </div>
                <div class="form-group">
                  <label for="test-subject">Materia</label>
                  <input type="text" id="test-subject" placeholder="Ej: Matemáticas">
                </div>
                <div class="form-group">
                  <label for="test-grade">Grado</label>
                  <input type="text" id="test-grade" placeholder="Ej: 10A">
                </div>
              </div>

              <div class="config-group">
                <h3>Configuración de Tiempo</h3>
                <div class="form-group">
                  <label for="test-time-limit">Tiempo Límite (minutos)</label>
                  <input type="number" id="test-time-limit" min="5" max="240" value="60">
                </div>
                <div class="form-group">
                  <label for="test-start-date">Fecha y Hora de Inicio</label>
                  <input type="datetime-local" id="test-start-date">
                </div>
                <div class="form-group">
                  <label for="test-end-date">Fecha y Hora de Fin</label>
                  <input type="datetime-local" id="test-end-date">
                </div>
              </div>

              <div class="config-group">
                <h3>Puntuación</h3>
                <div class="form-group">
                  <label for="points-correct">Puntos por Respuesta Correcta</label>
                  <input type="number" id="points-correct" min="0.1" max="10" step="0.1" value="1.0">
                  <span class="range-value">1.0 puntos</span>
                </div>
                <div class="form-group">
                  <label for="points-incorrect">Puntos Reducidos por Respuesta Incorrecta</label>
                  <input type="number" id="points-incorrect" min="0" max="5" step="0.1" value="0.0">
                  <span class="range-value">0.0 puntos</span>
                </div>
                <div class="form-group">
                  <label for="passing-score">Puntuación Mínima para Aprobar (%)</label>
                  <input type="number" id="passing-score" min="0" max="100" value="60">
                </div>
              </div>

              <div class="config-group">
                <h3>Opciones Avanzadas</h3>
                <div class="checkbox-group">
                  <input type="checkbox" id="randomize-questions">
                  <label for="randomize-questions">Aleatorizar orden de preguntas</label>
                </div>
                <div class="checkbox-group">
                  <input type="checkbox" id="randomize-options">
                  <label for="randomize-options">Aleatorizar opciones de respuesta</label>
                </div>
                <div class="checkbox-group">
                  <input type="checkbox" id="show-results">
                  <label for="show-results">Mostrar resultados al estudiante</label>
                </div>
                <div class="checkbox-group">
                  <input type="checkbox" id="prevent-cheating" checked>
                  <label for="prevent-cheating">Activar sistema anti-trampa</label>
                </div>
                <div class="checkbox-group">
                  <input type="checkbox" id="block-tab-switch" checked>
                  <label for="block-tab-switch">Bloquear cambio de pestañas</label>
                </div>
                <div class="checkbox-group">
                  <input type="checkbox" id="fullscreen-mode">
                  <label for="fullscreen-mode">Modo pantalla completa</label>
                </div>
                <div class="form-group">
                  <label for="custom-message">Mensaje personalizado para estudiantes</label>
                  <textarea id="custom-message" placeholder="Mensaje que verán los estudiantes antes de iniciar..."></textarea>
                </div>
              </div>
            </div>
          </div>

          <div id="step-2" class="creator-step hidden">
            <!-- Step 2: Questions -->
            <div class="questions-header">
              <h3>Preguntas de la Prueba</h3>
              <div class="questions-summary">
                <span id="questions-count">0 preguntas</span>
                <button class="btn-primary" id="add-question-btn">Agregar Pregunta</button>
              </div>
            </div>
            
            <div id="questions-container">
              <!-- Questions will be added here -->
            </div>

            <div class="question-types-help">
              <h4>Tipos de Preguntas Disponibles:</h4>
              <ul>
                <li><strong>Selección Múltiple:</strong> Una sola respuesta correcta</li>
                <li><strong>Múltiple Respuesta:</strong> Varias respuestas correctas posibles</li>
                <li><strong>Verdadero/Falso:</strong> Pregunta de dos opciones</li>
                <li><strong>Respuesta Abierta:</strong> Respuesta libre del estudiante</li>
              </ul>
            </div>
          </div>

          <div id="step-3" class="creator-step hidden">
            <!-- Step 3: Review -->
            <div class="test-preview">
              <div class="preview-header">
                <h3>Vista Previa de la Prueba</h3>
                <div class="preview-stats">
                  <span id="preview-questions-count">0 preguntas</span>
                  <span id="preview-total-points">0 puntos</span>
                  <span id="preview-estimated-time">0 min</span>
                </div>
              </div>
              <div id="preview-content">
                <!-- Preview content will be generated here -->
              </div>
            </div>
          </div>
        </div>

        <div class="test-creator-actions">
          <button class="btn-secondary" id="prev-step-btn" style="display: none;">Anterior</button>
          <button class="btn-primary" id="next-step-btn">Siguiente</button>
          <button class="btn-primary" id="save-test-btn" style="display: none;">Guardar Prueba</button>
          <button class="btn-secondary" id="cancel-btn">Cancelar</button>
        </div>
      </div>
    `
  }

  setupEventListeners() {
    // Step navigation
    document.getElementById("next-step-btn")?.addEventListener("click", () => this.nextStep())
    document.getElementById("prev-step-btn")?.addEventListener("click", () => this.prevStep())
    document.getElementById("save-test-btn")?.addEventListener("click", () => this.saveTest())
    document.getElementById("cancel-btn")?.addEventListener("click", () => this.cancelCreation())

    // Add question button
    document.getElementById("add-question-btn")?.addEventListener("click", () => this.addQuestion())

    // Form inputs with live updates
    const inputs = ["points-correct", "points-incorrect"]
    inputs.forEach((id) => {
      const input = document.getElementById(id)
      if (input) {
        input.addEventListener("input", (e) => this.updateRangeValue(e.target))
      }
    })

    // Auto-generate test code when title changes
    const titleInput = document.getElementById("test-title")
    if (titleInput) {
      titleInput.addEventListener("input", () => this.generateTestCode())
    }

    // Set default dates
    this.setDefaultDates()
  }

  setDefaultDates() {
    const now = new Date()
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) // Week later

    const startInput = document.getElementById("test-start-date")
    const endInput = document.getElementById("test-end-date")

    if (startInput) {
      startInput.value = startDate.toISOString().slice(0, 16)
    }
    if (endInput) {
      endInput.value = endDate.toISOString().slice(0, 16)
    }
  }

  updateRangeValue(input) {
    const valueSpan = input.parentNode.querySelector(".range-value")
    if (valueSpan) {
      valueSpan.textContent = `${input.value} puntos`
    }
  }

  generateTestCode() {
    const title = document.getElementById("test-title")?.value || ""
    if (title.length > 0) {
      const words = title.split(" ").filter((w) => w.length > 2)
      const code = words
        .slice(0, 3)
        .map((w) => w.substring(0, 3).toUpperCase())
        .join("")
      const random = Math.random().toString(36).substr(2, 3).toUpperCase()
      this.generatedCode = `${code}${random}`
    }
  }

  loadStep(stepNumber) {
    // Update step indicators
    document.querySelectorAll(".step").forEach((step, index) => {
      step.classList.remove("active", "completed")
      if (index + 1 === stepNumber) {
        step.classList.add("active")
      } else if (index + 1 < stepNumber) {
        step.classList.add("completed")
      }
    })

    // Show/hide step content
    document.querySelectorAll(".creator-step").forEach((step, index) => {
      step.classList.toggle("hidden", index + 1 !== stepNumber)
    })

    // Update navigation buttons
    const prevBtn = document.getElementById("prev-step-btn")
    const nextBtn = document.getElementById("next-step-btn")
    const saveBtn = document.getElementById("save-test-btn")

    if (prevBtn) prevBtn.style.display = stepNumber > 1 ? "block" : "none"
    if (nextBtn) nextBtn.style.display = stepNumber < 3 ? "block" : "none"
    if (saveBtn) saveBtn.style.display = stepNumber === 3 ? "block" : "none"

    this.currentStep = stepNumber

    // Load step-specific content
    if (stepNumber === 2) {
      this.updateQuestionsCount()
    } else if (stepNumber === 3) {
      this.generatePreview()
    }
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      if (this.currentStep < 3) {
        this.loadStep(this.currentStep + 1)
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.loadStep(this.currentStep - 1)
    }
  }

  validateCurrentStep() {
    if (this.currentStep === 1) {
      return this.validateBasicConfig()
    } else if (this.currentStep === 2) {
      return this.validateQuestions()
    }
    return true
  }

  validateBasicConfig() {
    const title = document.getElementById("test-title")?.value
    const timeLimit = document.getElementById("test-time-limit")?.value
    const startDate = document.getElementById("test-start-date")?.value
    const endDate = document.getElementById("test-end-date")?.value

    if (!title || title.trim().length < 3) {
      this.showError("El título debe tener al menos 3 caracteres")
      return false
    }

    if (!timeLimit || timeLimit < 5) {
      this.showError("El tiempo límite debe ser de al menos 5 minutos")
      return false
    }

    if (!startDate || !endDate) {
      this.showError("Debe especificar las fechas de inicio y fin")
      return false
    }

    if (new Date(startDate) >= new Date(endDate)) {
      this.showError("La fecha de fin debe ser posterior a la fecha de inicio")
      return false
    }

    return true
  }

  validateQuestions() {
    if (this.questions.length === 0) {
      this.showError("Debe agregar al menos una pregunta")
      return false
    }

    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions[i]
      if (!question.question || question.question.trim().length < 5) {
        this.showError(`La pregunta ${i + 1} debe tener al menos 5 caracteres`)
        return false
      }

      if (question.type !== "open-ended") {
        if (!question.options || question.options.length < 2) {
          this.showError(`La pregunta ${i + 1} debe tener al menos 2 opciones`)
          return false
        }

        const hasCorrect = question.options.some((opt) => opt.isCorrect)
        if (!hasCorrect) {
          this.showError(`La pregunta ${i + 1} debe tener al menos una respuesta correcta`)
          return false
        }
      }
    }

    return true
  }

  addQuestion() {
    const questionIndex = this.questions.length
    const newQuestion = {
      id: `Q${questionIndex + 1}`,
      type: "multiple-choice",
      question: "",
      image: null,
      options: [
        { id: "A", text: "", image: null, isCorrect: false },
        { id: "B", text: "", image: null, isCorrect: false },
      ],
      points: Number.parseFloat(document.getElementById("points-correct")?.value || "1"),
      explanation: "",
    }

    this.questions.push(newQuestion)
    this.renderQuestion(questionIndex)
    this.updateQuestionsCount()

    // Scroll to new question
    setTimeout(() => {
      const questionElement = document.querySelector(`[data-question-index="${questionIndex}"]`)
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: "smooth" })
      }
    }, 100)
  }

  renderQuestion(questionIndex) {
    const container = document.getElementById("questions-container")
    if (!container) return

    const question = this.questions[questionIndex]
    const questionHTML = this.getQuestionHTML(question, questionIndex)

    const questionElement = document.createElement("div")
    questionElement.innerHTML = questionHTML
    container.appendChild(questionElement.firstElementChild)

    this.setupQuestionEventListeners(questionIndex)
  }

  getQuestionHTML(question, index) {
    return `
      <div class="question-creator" data-question-index="${index}">
        <div class="question-header">
          <div class="question-number">Pregunta ${index + 1}</div>
          <div class="question-actions">
            <button class="btn-small btn-edit" onclick="window.testCreator.editQuestion(${index})">
              Editar
            </button>
            <button class="btn-small btn-delete" onclick="window.testCreator.deleteQuestion(${index})">
              Eliminar
            </button>
          </div>
        </div>

        <div class="question-type-selector">
          <button class="type-btn ${question.type === "multiple-choice" ? "active" : ""}" 
                  onclick="window.testCreator.changeQuestionType(${index}, 'multiple-choice')">
            Selección Múltiple
          </button>
          <button class="type-btn ${question.type === "multiple-answer" ? "active" : ""}" 
                  onclick="window.testCreator.changeQuestionType(${index}, 'multiple-answer')">
            Múltiple Respuesta
          </button>
          <button class="type-btn ${question.type === "true-false" ? "active" : ""}" 
                  onclick="window.testCreator.changeQuestionType(${index}, 'true-false')">
            Verdadero/Falso
          </button>
          <button class="type-btn ${question.type === "open-ended" ? "active" : ""}" 
                  onclick="window.testCreator.changeQuestionType(${index}, 'open-ended')">
            Respuesta Abierta
          </button>
        </div>

        <div class="question-content">
          <div class="form-group">
            <label>Texto de la Pregunta</label>
            <textarea class="question-text" data-question-index="${index}" 
                      placeholder="Escriba aquí la pregunta...">${question.question}</textarea>
          </div>
          
          <div class="question-image-upload">
            <label class="image-upload-btn">
              <input type="file" accept="image/*" style="display: none;" 
                     onchange="window.testCreator.handleImageUpload(event, ${index}, 'question')">
              📷 Agregar Imagen a la Pregunta
            </label>
            ${question.image ? `<img src="${question.image}" class="image-preview" alt="Imagen de pregunta">` : ""}
          </div>
        </div>

        ${question.type !== "open-ended" ? this.getOptionsHTML(question, index) : ""}

        <div class="question-actions-footer">
          <div class="question-points">
            <label>Puntos:</label>
            <input type="number" class="points-input" min="0.1" max="10" step="0.1" 
                   value="${question.points}" data-question-index="${index}">
          </div>
          <div class="question-explanation">
            <label>Explicación (opcional):</label>
            <input type="text" class="explanation-input" 
                   placeholder="Explicación de la respuesta correcta..." 
                   value="${question.explanation}" data-question-index="${index}">
          </div>
        </div>
      </div>
    `
  }

  getOptionsHTML(question, questionIndex) {
    if (question.type === "true-false") {
      return `
        <div class="answer-options">
          <div class="answer-option">
            <div class="option-marker ${question.options[0]?.isCorrect ? "correct" : ""}">V</div>
            <input type="text" class="option-input" value="Verdadero" readonly>
            <div class="option-controls">
              <button class="btn-icon btn-correct ${question.options[0]?.isCorrect ? "active" : ""}" 
                      onclick="window.testCreator.toggleCorrectOption(${questionIndex}, 0)">
                ✓
              </button>
            </div>
          </div>
          <div class="answer-option">
            <div class="option-marker ${question.options[1]?.isCorrect ? "correct" : ""}">F</div>
            <input type="text" class="option-input" value="Falso" readonly>
            <div class="option-controls">
              <button class="btn-icon btn-correct ${question.options[1]?.isCorrect ? "active" : ""}" 
                      onclick="window.testCreator.toggleCorrectOption(${questionIndex}, 1)">
                ✓
              </button>
            </div>
          </div>
        </div>
      `
    }

    let optionsHTML = '<div class="answer-options">'

    question.options.forEach((option, optionIndex) => {
      optionsHTML += `
        <div class="answer-option">
          <div class="option-marker ${option.isCorrect ? "correct" : ""}">${option.id}</div>
          <input type="text" class="option-input" 
                 placeholder="Escriba la opción de respuesta..." 
                 value="${option.text}"
                 data-question-index="${questionIndex}" 
                 data-option-index="${optionIndex}">
          <div class="option-controls">
            <label class="image-upload-btn btn-icon">
              <input type="file" accept="image/*" style="display: none;" 
                     onchange="window.testCreator.handleImageUpload(event, ${questionIndex}, 'option', ${optionIndex})">
              📷
            </label>
            <button class="btn-icon btn-correct ${option.isCorrect ? "active" : ""}" 
                    onclick="window.testCreator.toggleCorrectOption(${questionIndex}, ${optionIndex})">
              ✓
            </button>
            ${
              question.options.length > 2
                ? `<button class="btn-icon btn-remove" 
                           onclick="window.testCreator.removeOption(${questionIndex}, ${optionIndex})">
                     ✕
                   </button>`
                : ""
            }
          </div>
        </div>
        ${option.image ? `<img src="${option.image}" class="option-image" alt="Imagen de opción">` : ""}
      `
    })

    if (question.options.length < 6) {
      optionsHTML += `
        <button class="add-option-btn" onclick="window.testCreator.addOption(${questionIndex})">
          + Agregar Opción
        </button>
      `
    }

    optionsHTML += "</div>"
    return optionsHTML
  }

  setupQuestionEventListeners(questionIndex) {
    // Question text
    const questionTextarea = document.querySelector(`textarea[data-question-index="${questionIndex}"]`)
    if (questionTextarea) {
      questionTextarea.addEventListener("input", (e) => {
        this.questions[questionIndex].question = e.target.value
      })
    }

    // Option inputs
    const optionInputs = document.querySelectorAll(`input.option-input[data-question-index="${questionIndex}"]`)
    optionInputs.forEach((input) => {
      input.addEventListener("input", (e) => {
        const optionIndex = Number.parseInt(e.target.getAttribute("data-option-index"))
        this.questions[questionIndex].options[optionIndex].text = e.target.value
      })
    })

    // Points input
    const pointsInput = document.querySelector(`input.points-input[data-question-index="${questionIndex}"]`)
    if (pointsInput) {
      pointsInput.addEventListener("input", (e) => {
        this.questions[questionIndex].points = Number.parseFloat(e.target.value)
      })
    }

    // Explanation input
    const explanationInput = document.querySelector(`input.explanation-input[data-question-index="${questionIndex}"]`)
    if (explanationInput) {
      explanationInput.addEventListener("input", (e) => {
        this.questions[questionIndex].explanation = e.target.value
      })
    }
  }

  changeQuestionType(questionIndex, newType) {
    const question = this.questions[questionIndex]
    question.type = newType

    // Reset options based on type
    if (newType === "true-false") {
      question.options = [
        { id: "V", text: "Verdadero", image: null, isCorrect: false },
        { id: "F", text: "Falso", image: null, isCorrect: false },
      ]
    } else if (newType === "open-ended") {
      question.options = []
    } else if (question.options.length < 2) {
      question.options = [
        { id: "A", text: "", image: null, isCorrect: false },
        { id: "B", text: "", image: null, isCorrect: false },
      ]
    }

    this.rerenderQuestion(questionIndex)
  }

  rerenderQuestion(questionIndex) {
    const questionElement = document.querySelector(`[data-question-index="${questionIndex}"]`)
    if (questionElement) {
      const newHTML = this.getQuestionHTML(this.questions[questionIndex], questionIndex)
      questionElement.outerHTML = newHTML
      this.setupQuestionEventListeners(questionIndex)
    }
  }

  toggleCorrectOption(questionIndex, optionIndex) {
    const question = this.questions[questionIndex]

    if (question.type === "multiple-choice" || question.type === "true-false") {
      // Single correct answer - uncheck others
      question.options.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex
      })
    } else {
      // Multiple correct answers allowed
      question.options[optionIndex].isCorrect = !question.options[optionIndex].isCorrect
    }

    this.rerenderQuestion(questionIndex)
  }

  addOption(questionIndex) {
    const question = this.questions[questionIndex]
    if (question.options.length >= 6) return

    const nextLetter = String.fromCharCode(65 + question.options.length) // A, B, C, etc.
    question.options.push({
      id: nextLetter,
      text: "",
      image: null,
      isCorrect: false,
    })

    this.rerenderQuestion(questionIndex)
  }

  removeOption(questionIndex, optionIndex) {
    const question = this.questions[questionIndex]
    if (question.options.length <= 2) return

    question.options.splice(optionIndex, 1)

    // Update option IDs
    question.options.forEach((option, index) => {
      option.id = String.fromCharCode(65 + index)
    })

    this.rerenderQuestion(questionIndex)
  }

  deleteQuestion(questionIndex) {
    if (confirm("¿Está seguro que desea eliminar esta pregunta?")) {
      this.questions.splice(questionIndex, 1)
      this.rerenderAllQuestions()
      this.updateQuestionsCount()
    }
  }

  rerenderAllQuestions() {
    const container = document.getElementById("questions-container")
    if (container) {
      container.innerHTML = ""
      this.questions.forEach((_, index) => {
        this.renderQuestion(index)
      })
    }
  }

  handleImageUpload(event, questionIndex, type, optionIndex = null) {
    const file = event.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      this.showError("La imagen no puede ser mayor a 5MB")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target.result

      if (type === "question") {
        this.questions[questionIndex].image = imageData
      } else if (type === "option") {
        this.questions[questionIndex].options[optionIndex].image = imageData
      }

      this.rerenderQuestion(questionIndex)
    }
    reader.readAsDataURL(file)
  }

  updateQuestionsCount() {
    const countElement = document.getElementById("questions-count")
    if (countElement) {
      const count = this.questions.length
      countElement.textContent = `${count} pregunta${count !== 1 ? "s" : ""}`
    }
  }

  generatePreview() {
    const previewContent = document.getElementById("preview-content")
    if (!previewContent) return

    // Update preview stats
    const totalPoints = this.questions.reduce((sum, q) => sum + q.points, 0)
    const estimatedTime = Math.max(this.questions.length * 2, 5) // 2 minutes per question minimum

    document.getElementById("preview-questions-count").textContent = `${this.questions.length} preguntas`
    document.getElementById("preview-total-points").textContent = `${totalPoints} puntos`
    document.getElementById("preview-estimated-time").textContent = `~${estimatedTime} min`

    // Generate preview HTML
    let previewHTML = `
      <div class="test-info-preview">
        <h4>${document.getElementById("test-title")?.value || "Sin título"}</h4>
        <p>${document.getElementById("test-description")?.value || "Sin descripción"}</p>
        <div class="test-details">
          <span><strong>Materia:</strong> ${document.getElementById("test-subject")?.value || "N/A"}</span>
          <span><strong>Grado:</strong> ${document.getElementById("test-grade")?.value || "N/A"}</span>
          <span><strong>Tiempo:</strong> ${document.getElementById("test-time-limit")?.value || "0"} minutos</span>
        </div>
      </div>
    `

    this.questions.forEach((question, index) => {
      previewHTML += `
        <div class="preview-question">
          <h4>Pregunta ${index + 1} (${question.points} puntos)</h4>
          <p>${question.question || "Sin texto"}</p>
          ${question.image ? `<img src="${question.image}" class="preview-image" alt="Imagen de pregunta">` : ""}
          
          ${
            question.type !== "open-ended"
              ? `
                <ul class="preview-options">
                  ${question.options
                    .map(
                      (option) => `
                    <li class="${option.isCorrect ? "correct" : ""}">
                      ${option.id}. ${option.text || "Opción vacía"}
                      ${option.image ? `<img src="${option.image}" class="preview-option-image" alt="Imagen de opción">` : ""}
                    </li>
                  `,
                    )
                    .join("")}
                </ul>
              `
              : '<p class="open-answer-preview">Respuesta abierta</p>'
          }
          
          ${question.explanation ? `<p class="explanation"><strong>Explicación:</strong> ${question.explanation}</p>` : ""}
        </div>
      `
    })

    previewContent.innerHTML = previewHTML
  }

  async saveTest() {
    if (!this.validateCurrentStep()) return

    try {
      const testData = this.collectTestData()
      const savedTest = await window.db.createTest(testData)

      this.showSuccess("Prueba creada exitosamente")

      // Reset creator
      setTimeout(() => {
        this.resetCreator()
        if (window.dashboardManager) {
          window.dashboardManager.showSection("my-tests")
        }
      }, 1500)
    } catch (error) {
      console.error("[v0] Error saving test:", error)
      this.showError("Error al guardar la prueba")
    }
  }

  collectTestData() {
    return {
      title: document.getElementById("test-title").value,
      code: this.generatedCode || this.generateRandomCode(),
      teacherId: window.authManager.getCurrentUser().id,
      subject: document.getElementById("test-subject").value,
      grade: document.getElementById("test-grade").value,
      description: document.getElementById("test-description").value,
      timeLimit: Number.parseInt(document.getElementById("test-time-limit").value) * 60, // Convert to seconds
      totalQuestions: this.questions.length,
      pointsPerCorrect: Number.parseFloat(document.getElementById("points-correct").value),
      pointsPerIncorrect: Number.parseFloat(document.getElementById("points-incorrect").value),
      passingScore: Number.parseFloat(document.getElementById("passing-score").value),
      maxAttempts: 1,
      showResults: document.getElementById("show-results").checked,
      randomizeQuestions: document.getElementById("randomize-questions").checked,
      randomizeOptions: document.getElementById("randomize-options").checked,
      preventCheating: document.getElementById("prevent-cheating").checked,
      blockTabSwitch: document.getElementById("block-tab-switch").checked,
      fullScreenMode: document.getElementById("fullscreen-mode").checked,
      customMessage: document.getElementById("custom-message").value,
      startDate: new Date(document.getElementById("test-start-date").value).toISOString(),
      endDate: new Date(document.getElementById("test-end-date").value).toISOString(),
      questions: this.questions,
    }
  }

  generateRandomCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase()
  }

  cancelCreation() {
    if (confirm("¿Está seguro que desea cancelar? Se perderán todos los cambios.")) {
      this.resetCreator()
      if (window.dashboardManager) {
        window.dashboardManager.showSection("overview")
      }
    }
  }

  resetCreator() {
    this.currentTest = null
    this.currentStep = 1
    this.questions = []
    this.isEditing = false
    this.editingQuestionIndex = -1
    this.generatedCode = null

    // Reset form
    const form = document.querySelector(".test-creator")
    if (form) {
      form.querySelectorAll("input, textarea, select").forEach((input) => {
        if (input.type === "checkbox") {
          input.checked = input.id === "prevent-cheating" || input.id === "block-tab-switch"
        } else if (input.type === "number") {
          input.value = input.getAttribute("value") || ""
        } else {
          input.value = ""
        }
      })
    }

    this.setDefaultDates()
    this.loadStep(1)
  }

  // Edit existing test
  async editTest(testId) {
    try {
      const test = window.db.data.tests.tests.find((t) => t.id === testId)
      if (!test) {
        this.showError("Prueba no encontrada")
        return
      }

      this.currentTest = test
      this.isEditing = true
      this.questions = [...test.questions]

      // Populate form with test data
      this.populateFormWithTestData(test)

      this.loadStep(1)
    } catch (error) {
      console.error("[v0] Error loading test for editing:", error)
      this.showError("Error al cargar la prueba")
    }
  }

  populateFormWithTestData(test) {
    document.getElementById("test-title").value = test.title
    document.getElementById("test-description").value = test.description || ""
    document.getElementById("test-subject").value = test.subject || ""
    document.getElementById("test-grade").value = test.grade || ""
    document.getElementById("test-time-limit").value = Math.floor(test.timeLimit / 60)
    document.getElementById("test-start-date").value = new Date(test.startDate).toISOString().slice(0, 16)
    document.getElementById("test-end-date").value = new Date(test.endDate).toISOString().slice(0, 16)
    document.getElementById("points-correct").value = test.pointsPerCorrect
    document.getElementById("points-incorrect").value = test.pointsPerIncorrect
    document.getElementById("passing-score").value = test.passingScore
    document.getElementById("randomize-questions").checked = test.randomizeQuestions
    document.getElementById("randomize-options").checked = test.randomizeOptions
    document.getElementById("show-results").checked = test.showResults
    document.getElementById("prevent-cheating").checked = test.preventCheating
    document.getElementById("block-tab-switch").checked = test.blockTabSwitch
    document.getElementById("fullscreen-mode").checked = test.fullScreenMode
    document.getElementById("custom-message").value = test.customMessage || ""

    this.generatedCode = test.code
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
}

// Initialize global test creator
window.TestCreator = TestCreator
