// Test Creator - Handles test creation and question building
class TestCreator {
  constructor() {
    this.currentTest = {
      nombre: "",
      descripcion: "",
      materia: "",
      duracion: 60,
      puntosPorCorrecta: 1,
      puntosReducidosPorIncorrecta: 0,
      fechaInicio: "",
      fechaFin: "",
      configuracion: {
        mostrarPuntaje: true,
        permitirRetroceso: true,
        mezclarPreguntas: false,
        mezclarRespuestas: false,
        bloquearCambioTab: false,
        mensajeAlerta: "No cambies de pestaña durante la prueba",
        mensajeFinal: "Has completado la prueba exitosamente",
      },
      preguntas: [],
    }
    this.currentQuestionIndex = -1
    this.questionTypes = {
      multiple: "Selección Múltiple",
      "true-false": "Verdadero/Falso",
      open: "Respuesta Abierta",
      "fill-blank": "Completar Espacios",
    }
  }

  loadCreateTestView() {
    const contentContainer = document.getElementById("content-container")

    contentContainer.innerHTML = `
      <div class="test-creator-container">
        <div class="creator-header">
          <h1>Crear Nueva Prueba</h1>
          <p>Configura los detalles de tu prueba y agrega preguntas</p>
        </div>

        <div class="creator-tabs">
          <button class="tab-btn active" data-tab="basic-info">Información Básica</button>
          <button class="tab-btn" data-tab="questions">Preguntas</button>
          <button class="tab-btn" data-tab="settings">Configuración</button>
          <button class="tab-btn" data-tab="preview">Vista Previa</button>
        </div>

        <div class="creator-content">
          <!-- Basic Info Tab -->
          <div class="tab-content active" id="basic-info">
            <div class="card">
              <div class="card-header">
                <h2 class="card-title">Información de la Prueba</h2>
              </div>
              <form id="test-basic-form" class="test-form">
                <div class="form-row">
                  <div class="form-group">
                    <label for="test-name">Nombre de la Prueba *</label>
                    <input type="text" id="test-name" name="nombre" required>
                  </div>
                  <div class="form-group">
                    <label for="test-subject">Materia</label>
                    <input type="text" id="test-subject" name="materia">
                  </div>
                </div>

                <div class="form-group">
                  <label for="test-description">Descripción</label>
                  <textarea id="test-description" name="descripcion" rows="3"></textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="test-duration">Duración (minutos) *</label>
                    <input type="number" id="test-duration" name="duracion" min="1" max="300" value="60" required>
                  </div>
                  <div class="form-group">
                    <label for="points-correct">Puntos por Correcta</label>
                    <input type="number" id="points-correct" name="puntosPorCorrecta" min="0.1" max="10" step="0.1" value="1">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="points-incorrect">Puntos Reducidos por Incorrecta</label>
                    <input type="number" id="points-incorrect" name="puntosReducidosPorIncorrecta" min="0" max="5" step="0.1" value="0">
                  </div>
                  <div class="form-group">
                    <label for="test-grade">Grado/Nivel</label>
                    <select id="test-grade" name="grado">
                      <option value="">Seleccionar...</option>
                      <option value="6">6°</option>
                      <option value="7">7°</option>
                      <option value="8">8°</option>
                      <option value="9">9°</option>
                      <option value="10">10°</option>
                      <option value="11">11°</option>
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="start-date">Fecha de Inicio *</label>
                    <input type="datetime-local" id="start-date" name="fechaInicio" required>
                  </div>
                  <div class="form-group">
                    <label for="end-date">Fecha de Fin *</label>
                    <input type="datetime-local" id="end-date" name="fechaFin" required>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <!-- Questions Tab -->
          <div class="tab-content" id="questions">
            <div class="questions-header">
              <h2>Preguntas de la Prueba</h2>
              <div class="questions-actions">
                <button class="btn-primary" onclick="window.testCreator.showAddQuestionModal()">
                  Agregar Pregunta
                </button>
                <span class="question-count">Total: <span id="question-counter">0</span> preguntas</span>
              </div>
            </div>

            <div class="questions-list" id="questions-list">
              <div class="no-questions">
                <p>No hay preguntas agregadas aún.</p>
                <p>Haz clic en "Agregar Pregunta" para comenzar.</p>
              </div>
            </div>
          </div>

          <!-- Settings Tab -->
          <div class="tab-content" id="settings">
            <div class="card">
              <div class="card-header">
                <h2 class="card-title">Configuración Avanzada</h2>
              </div>
              <form id="test-settings-form" class="test-form">
                <div class="settings-section">
                  <h3>Opciones de Visualización</h3>
                  <div class="checkbox-group">
                    <label class="checkbox-label">
                      <input type="checkbox" id="show-score" name="mostrarPuntaje" checked>
                      <span class="checkmark"></span>
                      Mostrar puntaje al finalizar
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" id="allow-back" name="permitirRetroceso" checked>
                      <span class="checkmark"></span>
                      Permitir retroceder a preguntas anteriores
                    </label>
                  </div>
                </div>

                <div class="settings-section">
                  <h3>Opciones de Aleatorización</h3>
                  <div class="checkbox-group">
                    <label class="checkbox-label">
                      <input type="checkbox" id="shuffle-questions" name="mezclarPreguntas">
                      <span class="checkmark"></span>
                      Mezclar orden de preguntas
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" id="shuffle-answers" name="mezclarRespuestas">
                      <span class="checkmark"></span>
                      Mezclar orden de respuestas
                    </label>
                  </div>
                </div>

                <div class="settings-section">
                  <h3>Seguridad Anti-Trampa</h3>
                  <div class="checkbox-group">
                    <label class="checkbox-label">
                      <input type="checkbox" id="block-tab-change" name="bloquearCambioTab">
                      <span class="checkmark"></span>
                      Bloquear cambio de pestaña/ventana
                    </label>
                  </div>
                  
                  <div class="form-group">
                    <label for="alert-message">Mensaje de Alerta Personalizado</label>
                    <textarea id="alert-message" name="mensajeAlerta" rows="2" placeholder="Mensaje que se mostrará si el estudiante intenta cambiar de pestaña">No cambies de pestaña durante la prueba</textarea>
                  </div>
                </div>

                <div class="settings-section">
                  <h3>Mensaje Final</h3>
                  <div class="form-group">
                    <label for="final-message">Mensaje al Completar la Prueba</label>
                    <textarea id="final-message" name="mensajeFinal" rows="3" placeholder="Mensaje que verá el estudiante al completar la prueba">Has completado la prueba exitosamente</textarea>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <!-- Preview Tab -->
          <div class="tab-content" id="preview">
            <div class="card">
              <div class="card-header">
                <h2 class="card-title">Vista Previa de la Prueba</h2>
              </div>
              <div id="test-preview">
                <p class="no-data">Completa la información básica y agrega preguntas para ver la vista previa.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="creator-actions">
          <button class="btn-secondary" onclick="window.app.loadView('dashboard')">Cancelar</button>
          <button class="btn-primary" onclick="window.testCreator.saveTest()">Guardar Prueba</button>
        </div>
      </div>

      <!-- Add Question Modal -->
      <div id="add-question-modal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="modal-title">Agregar Pregunta</h3>
            <button class="modal-close" onclick="window.testCreator.closeQuestionModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="question-form">
              <div class="form-group">
                <label for="question-type">Tipo de Pregunta *</label>
                <select id="question-type" name="tipo" required onchange="window.testCreator.onQuestionTypeChange()">
                  <option value="">Seleccionar tipo...</option>
                  <option value="multiple">Selección Múltiple</option>
                  <option value="true-false">Verdadero/Falso</option>
                  <option value="open">Respuesta Abierta</option>
                  <option value="fill-blank">Completar Espacios</option>
                </select>
              </div>

              <div class="form-group">
                <label for="question-text">Pregunta *</label>
                <div class="text-editor">
                  <div class="editor-toolbar">
                    <button type="button" class="editor-btn" onclick="window.testCreator.formatText('bold')"><b>B</b></button>
                    <button type="button" class="editor-btn" onclick="window.testCreator.formatText('italic')"><i>I</i></button>
                    <button type="button" class="editor-btn" onclick="window.testCreator.formatText('underline')"><u>U</u></button>
                    <button type="button" class="editor-btn" onclick="window.testCreator.insertList()">Lista</button>
                  </div>
                  <textarea id="question-text" name="pregunta" rows="3" required></textarea>
                </div>
              </div>

              <div class="form-group">
                <label for="question-image">Imagen (opcional)</label>
                <input type="file" id="question-image" name="imagen" accept="image/*" onchange="window.testCreator.handleImageUpload(event, 'question')">
                <div id="question-image-preview" class="image-preview"></div>
              </div>

              <div id="answers-section">
                <!-- Answers will be populated based on question type -->
              </div>

              <div class="form-group">
                <label for="question-points">Puntos para esta pregunta</label>
                <input type="number" id="question-points" name="puntos" min="0.1" max="10" step="0.1" value="1">
              </div>

              <div class="form-group">
                <label for="question-explanation">Explicación (opcional)</label>
                <textarea id="question-explanation" name="explicacion" rows="2" placeholder="Explicación que se mostrará después de responder"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="window.testCreator.closeQuestionModal()">Cancelar</button>
            <button class="btn-primary" onclick="window.testCreator.saveQuestion()">Guardar Pregunta</button>
          </div>
        </div>
      </div>
    `

    this.setupEventListeners()
    this.loadCurrentTest()
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab)
      })
    })

    // Form auto-save
    document.getElementById("test-basic-form").addEventListener("input", () => {
      this.saveCurrentFormData()
    })

    document.getElementById("test-settings-form").addEventListener("input", () => {
      this.saveCurrentFormData()
    })

    // Set default dates
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    document.getElementById("start-date").value = this.formatDateTimeLocal(tomorrow)
    document.getElementById("end-date").value = this.formatDateTimeLocal(nextWeek)
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active")
    })
    document.getElementById(tabName).classList.add("active")

    // Update preview if switching to preview tab
    if (tabName === "preview") {
      this.updatePreview()
    }
  }

  saveCurrentFormData() {
    const basicForm = document.getElementById("test-basic-form")
    const settingsForm = document.getElementById("test-settings-form")

    if (basicForm) {
      const formData = new FormData(basicForm)
      for (const [key, value] of formData.entries()) {
        this.currentTest[key] = value
      }
    }

    if (settingsForm) {
      const formData = new FormData(settingsForm)
      for (const [key, value] of formData.entries()) {
        this.currentTest.configuracion[key] = value
      }

      // Handle checkboxes
      const checkboxes = settingsForm.querySelectorAll('input[type="checkbox"]')
      checkboxes.forEach((checkbox) => {
        this.currentTest.configuracion[checkbox.name] = checkbox.checked
      })
    }
  }

  loadCurrentTest() {
    // Load saved test data if exists
    const savedTest = localStorage.getItem("current_test_draft")
    if (savedTest) {
      try {
        this.currentTest = { ...this.currentTest, ...JSON.parse(savedTest) }
        this.populateForm()
      } catch (error) {
        console.error("Error loading test draft:", error)
      }
    }
  }

  populateForm() {
    // Populate basic info
    Object.keys(this.currentTest).forEach((key) => {
      const input =
        document.getElementById(`test-${key}`) || document.getElementById(key.replace(/([A-Z])/g, "-$1").toLowerCase())
      if (input && typeof this.currentTest[key] !== "object") {
        input.value = this.currentTest[key]
      }
    })

    // Populate settings
    Object.keys(this.currentTest.configuracion).forEach((key) => {
      const input = document.getElementById(key.replace(/([A-Z])/g, "-$1").toLowerCase())
      if (input) {
        if (input.type === "checkbox") {
          input.checked = this.currentTest.configuracion[key]
        } else {
          input.value = this.currentTest.configuracion[key]
        }
      }
    })

    // Update questions list
    this.updateQuestionsList()
  }

  showAddQuestionModal() {
    this.currentQuestionIndex = -1
    document.getElementById("modal-title").textContent = "Agregar Pregunta"
    document.getElementById("question-form").reset()
    document.getElementById("answers-section").innerHTML = ""
    document.getElementById("add-question-modal").classList.remove("hidden")
  }

  editQuestion(index) {
    this.currentQuestionIndex = index
    const question = this.currentTest.preguntas[index]

    document.getElementById("modal-title").textContent = "Editar Pregunta"
    document.getElementById("question-type").value = question.tipo
    document.getElementById("question-text").value = question.pregunta
    document.getElementById("question-points").value = question.puntos || 1
    document.getElementById("question-explanation").value = question.explicacion || ""

    this.onQuestionTypeChange()
    this.populateAnswers(question)

    document.getElementById("add-question-modal").classList.remove("hidden")
  }

  closeQuestionModal() {
    document.getElementById("add-question-modal").classList.add("hidden")
    this.currentQuestionIndex = -1
  }

  onQuestionTypeChange() {
    const questionType = document.getElementById("question-type").value
    const answersSection = document.getElementById("answers-section")

    answersSection.innerHTML = ""

    switch (questionType) {
      case "multiple":
        this.createMultipleChoiceAnswers()
        break
      case "true-false":
        this.createTrueFalseAnswers()
        break
      case "open":
        this.createOpenAnswers()
        break
      case "fill-blank":
        this.createFillBlankAnswers()
        break
    }
  }

  createMultipleChoiceAnswers() {
    const answersSection = document.getElementById("answers-section")

    answersSection.innerHTML = `
      <div class="answers-header">
        <h4>Opciones de Respuesta</h4>
        <button type="button" class="btn-small btn-secondary" onclick="window.testCreator.addAnswerOption()">
          Agregar Opción
        </button>
      </div>
      <div id="answer-options">
        ${this.createAnswerOption(0, "", true)}
        ${this.createAnswerOption(1, "", false)}
        ${this.createAnswerOption(2, "", false)}
        ${this.createAnswerOption(3, "", false)}
      </div>
    `
  }

  createAnswerOption(index, text = "", isCorrect = false) {
    return `
      <div class="answer-option" data-index="${index}">
        <div class="answer-controls">
          <label class="radio-label">
            <input type="radio" name="correct-answer" value="${index}" ${isCorrect ? "checked" : ""}>
            <span class="radio-mark"></span>
            Correcta
          </label>
          <button type="button" class="btn-small btn-destructive" onclick="window.testCreator.removeAnswerOption(${index})">
            Eliminar
          </button>
        </div>
        <div class="answer-input-group">
          <textarea class="answer-text" placeholder="Opción de respuesta ${index + 1}" rows="2">${text}</textarea>
          <input type="file" class="answer-image" accept="image/*" onchange="window.testCreator.handleImageUpload(event, 'answer', ${index})">
          <div class="answer-image-preview" id="answer-image-preview-${index}"></div>
        </div>
      </div>
    `
  }

  createTrueFalseAnswers() {
    const answersSection = document.getElementById("answers-section")

    answersSection.innerHTML = `
      <div class="answers-header">
        <h4>Respuesta Correcta</h4>
      </div>
      <div class="true-false-options">
        <label class="radio-label">
          <input type="radio" name="true-false-answer" value="true" checked>
          <span class="radio-mark"></span>
          Verdadero
        </label>
        <label class="radio-label">
          <input type="radio" name="true-false-answer" value="false">
          <span class="radio-mark"></span>
          Falso
        </label>
      </div>
    `
  }

  createOpenAnswers() {
    const answersSection = document.getElementById("answers-section")

    answersSection.innerHTML = `
      <div class="answers-header">
        <h4>Respuestas Aceptadas (opcional)</h4>
        <p class="help-text">Puedes agregar palabras clave o frases que se considerarán correctas</p>
      </div>
      <div class="open-answers">
        <textarea id="open-keywords" placeholder="Palabras clave separadas por comas (ej: democracia, gobierno del pueblo, sistema político)" rows="3"></textarea>
        <label class="checkbox-label">
          <input type="checkbox" id="case-sensitive">
          <span class="checkmark"></span>
          Sensible a mayúsculas/minúsculas
        </label>
      </div>
    `
  }

  createFillBlankAnswers() {
    const answersSection = document.getElementById("answers-section")

    answersSection.innerHTML = `
      <div class="answers-header">
        <h4>Respuestas para los Espacios</h4>
        <p class="help-text">Usa [BLANK] en la pregunta para marcar los espacios a completar</p>
      </div>
      <div id="blank-answers">
        <div class="blank-answer">
          <label>Respuesta para espacio 1:</label>
          <input type="text" class="blank-input" placeholder="Respuesta correcta">
        </div>
      </div>
      <button type="button" class="btn-small btn-secondary" onclick="window.testCreator.addBlankAnswer()">
        Agregar Espacio
      </button>
    `
  }

  addAnswerOption() {
    const optionsContainer = document.getElementById("answer-options")
    const currentOptions = optionsContainer.children.length

    if (currentOptions < 6) {
      const newOption = document.createElement("div")
      newOption.innerHTML = this.createAnswerOption(currentOptions, "", false)
      optionsContainer.appendChild(newOption.firstElementChild)
    }
  }

  removeAnswerOption(index) {
    const option = document.querySelector(`[data-index="${index}"]`)
    if (option && document.getElementById("answer-options").children.length > 2) {
      option.remove()
      this.reindexAnswerOptions()
    }
  }

  reindexAnswerOptions() {
    const options = document.querySelectorAll(".answer-option")
    options.forEach((option, index) => {
      option.dataset.index = index
      const radio = option.querySelector('input[type="radio"]')
      const removeBtn = option.querySelector(".btn-destructive")
      const textarea = option.querySelector(".answer-text")

      if (radio) radio.value = index
      if (removeBtn) removeBtn.setAttribute("onclick", `window.testCreator.removeAnswerOption(${index})`)
      if (textarea) textarea.placeholder = `Opción de respuesta ${index + 1}`
    })
  }

  addBlankAnswer() {
    const container = document.getElementById("blank-answers")
    const currentBlanks = container.children.length

    const newBlank = document.createElement("div")
    newBlank.className = "blank-answer"
    newBlank.innerHTML = `
      <label>Respuesta para espacio ${currentBlanks + 1}:</label>
      <input type="text" class="blank-input" placeholder="Respuesta correcta">
      <button type="button" class="btn-small btn-destructive" onclick="this.parentElement.remove()">Eliminar</button>
    `

    container.appendChild(newBlank)
  }

  handleImageUpload(event, type, index = null) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target.result
      let previewContainer

      if (type === "question") {
        previewContainer = document.getElementById("question-image-preview")
      } else if (type === "answer") {
        previewContainer = document.getElementById(`answer-image-preview-${index}`)
      }

      if (previewContainer) {
        previewContainer.innerHTML = `
          <div class="image-preview-item">
            <img src="${imageData}" alt="Preview" style="max-width: 200px; max-height: 150px;">
            <button type="button" class="remove-image" onclick="window.testCreator.removeImage('${type}', ${index})">×</button>
          </div>
        `
      }
    }

    reader.readAsDataURL(file)
  }

  removeImage(type, index) {
    let previewContainer
    let fileInput

    if (type === "question") {
      previewContainer = document.getElementById("question-image-preview")
      fileInput = document.getElementById("question-image")
    } else if (type === "answer") {
      previewContainer = document.getElementById(`answer-image-preview-${index}`)
      fileInput = document.querySelector(`[data-index="${index}"] .answer-image`)
    }

    if (previewContainer) previewContainer.innerHTML = ""
    if (fileInput) fileInput.value = ""
  }

  formatText(command) {
    const textarea = document.getElementById("question-text")
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = textarea.value.substring(start, end)

    let formattedText = selectedText

    switch (command) {
      case "bold":
        formattedText = `**${selectedText}**`
        break
      case "italic":
        formattedText = `*${selectedText}*`
        break
      case "underline":
        formattedText = `__${selectedText}__`
        break
    }

    textarea.value = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end)
    textarea.focus()
    textarea.setSelectionRange(start, start + formattedText.length)
  }

  insertList() {
    const textarea = document.getElementById("question-text")
    const start = textarea.selectionStart
    const listText = "\n1. Opción 1\n2. Opción 2\n3. Opción 3\n"

    textarea.value = textarea.value.substring(0, start) + listText + textarea.value.substring(start)
    textarea.focus()
  }

  saveQuestion() {
    const form = document.getElementById("question-form")
    const formData = new FormData(form)

    const questionData = {
      tipo: formData.get("tipo"),
      pregunta: formData.get("pregunta"),
      puntos: Number.parseFloat(formData.get("puntos")) || 1,
      explicacion: formData.get("explicacion") || "",
      imagen: null, // Handle image data separately
    }

    // Validate required fields
    if (!questionData.tipo || !questionData.pregunta) {
      window.app.showAlert("Por favor completa todos los campos requeridos", "error")
      return
    }

    // Process answers based on question type
    switch (questionData.tipo) {
      case "multiple":
        questionData.respuestas = this.getMultipleChoiceAnswers()
        break
      case "true-false":
        questionData.respuestas = this.getTrueFalseAnswer()
        break
      case "open":
        questionData.respuestas = this.getOpenAnswers()
        break
      case "fill-blank":
        questionData.respuestas = this.getFillBlankAnswers()
        break
    }

    // Add or update question
    if (this.currentQuestionIndex >= 0) {
      this.currentTest.preguntas[this.currentQuestionIndex] = questionData
    } else {
      this.currentTest.preguntas.push(questionData)
    }

    this.updateQuestionsList()
    this.closeQuestionModal()
    this.saveDraft()

    window.app.showAlert("Pregunta guardada exitosamente", "success")
  }

  getMultipleChoiceAnswers() {
    const options = document.querySelectorAll(".answer-option")
    const correctAnswer = document.querySelector('input[name="correct-answer"]:checked')

    const answers = {
      opciones: [],
      correcta: correctAnswer ? Number.parseInt(correctAnswer.value) : 0,
    }

    options.forEach((option, index) => {
      const text = option.querySelector(".answer-text").value
      if (text.trim()) {
        answers.opciones.push({
          texto: text.trim(),
          imagen: null, // Handle image data
        })
      }
    })

    return answers
  }

  getTrueFalseAnswer() {
    const selectedAnswer = document.querySelector('input[name="true-false-answer"]:checked')
    return {
      correcta: selectedAnswer ? selectedAnswer.value === "true" : true,
    }
  }

  getOpenAnswers() {
    const keywords = document.getElementById("open-keywords").value
    const caseSensitive = document.getElementById("case-sensitive").checked

    return {
      palabrasClave: keywords ? keywords.split(",").map((k) => k.trim()) : [],
      sensibleMayusculas: caseSensitive,
    }
  }

  getFillBlankAnswers() {
    const blankInputs = document.querySelectorAll(".blank-input")
    const respuestas = []

    blankInputs.forEach((input) => {
      if (input.value.trim()) {
        respuestas.push(input.value.trim())
      }
    })

    return {
      respuestas,
    }
  }

  updateQuestionsList() {
    const questionsList = document.getElementById("questions-list")
    const questionCounter = document.getElementById("question-counter")

    questionCounter.textContent = this.currentTest.preguntas.length

    if (this.currentTest.preguntas.length === 0) {
      questionsList.innerHTML = `
        <div class="no-questions">
          <p>No hay preguntas agregadas aún.</p>
          <p>Haz clic en "Agregar Pregunta" para comenzar.</p>
        </div>
      `
      return
    }

    questionsList.innerHTML = this.currentTest.preguntas
      .map(
        (question, index) => `
      <div class="question-item">
        <div class="question-header">
          <span class="question-number">${index + 1}</span>
          <span class="question-type">${this.questionTypes[question.tipo]}</span>
          <span class="question-points">${question.puntos} pts</span>
        </div>
        <div class="question-content">
          <p class="question-text">${this.truncateText(question.pregunta, 100)}</p>
          ${this.renderQuestionPreview(question)}
        </div>
        <div class="question-actions">
          <button class="btn-small btn-secondary" onclick="window.testCreator.editQuestion(${index})">
            Editar
          </button>
          <button class="btn-small btn-destructive" onclick="window.testCreator.deleteQuestion(${index})">
            Eliminar
          </button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  renderQuestionPreview(question) {
    switch (question.tipo) {
      case "multiple":
        return `
          <div class="answer-preview">
            ${question.respuestas.opciones
              .map(
                (opcion, index) => `
              <div class="option-preview ${index === question.respuestas.correcta ? "correct" : ""}">
                ${String.fromCharCode(65 + index)}. ${this.truncateText(opcion.texto, 50)}
              </div>
            `,
              )
              .join("")}
          </div>
        `
      case "true-false":
        return `
          <div class="answer-preview">
            <span class="tf-answer ${question.respuestas.correcta ? "correct" : ""}">
              Respuesta: ${question.respuestas.correcta ? "Verdadero" : "Falso"}
            </span>
          </div>
        `
      case "open":
        return `
          <div class="answer-preview">
            <span class="open-keywords">
              Palabras clave: ${question.respuestas.palabrasClave.join(", ") || "Ninguna especificada"}
            </span>
          </div>
        `
      case "fill-blank":
        return `
          <div class="answer-preview">
            <span class="blank-count">
              ${question.respuestas.respuestas.length} espacios a completar
            </span>
          </div>
        `
      default:
        return ""
    }
  }

  deleteQuestion(index) {
    if (confirm("¿Estás seguro de que quieres eliminar esta pregunta?")) {
      this.currentTest.preguntas.splice(index, 1)
      this.updateQuestionsList()
      this.saveDraft()
      window.app.showAlert("Pregunta eliminada", "success")
    }
  }

  updatePreview() {
    const previewContainer = document.getElementById("test-preview")

    if (!this.currentTest.nombre || this.currentTest.preguntas.length === 0) {
      previewContainer.innerHTML =
        '<p class="no-data">Completa la información básica y agrega preguntas para ver la vista previa.</p>'
      return
    }

    const totalPoints = this.currentTest.preguntas.reduce((sum, q) => sum + (q.puntos || 1), 0)

    previewContainer.innerHTML = `
      <div class="test-preview-content">
        <div class="preview-header">
          <h3>${this.currentTest.nombre}</h3>
          <p>${this.currentTest.descripcion || "Sin descripción"}</p>
          <div class="preview-info">
            <span>Duración: ${this.currentTest.duracion} minutos</span>
            <span>Preguntas: ${this.currentTest.preguntas.length}</span>
            <span>Puntos totales: ${totalPoints}</span>
          </div>
        </div>
        
        <div class="preview-questions">
          ${this.currentTest.preguntas
            .map(
              (question, index) => `
            <div class="preview-question">
              <div class="preview-question-header">
                <span class="preview-question-number">${index + 1}.</span>
                <span class="preview-question-points">(${question.puntos} pts)</span>
              </div>
              <div class="preview-question-text">${question.pregunta}</div>
              ${this.renderPreviewAnswers(question)}
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
  }

  renderPreviewAnswers(question) {
    switch (question.tipo) {
      case "multiple":
        return `
          <div class="preview-answers">
            ${question.respuestas.opciones
              .map(
                (opcion, index) => `
              <div class="preview-option">
                <input type="radio" name="preview-q" disabled>
                <label>${String.fromCharCode(65 + index)}. ${opcion.texto}</label>
              </div>
            `,
              )
              .join("")}
          </div>
        `
      case "true-false":
        return `
          <div class="preview-answers">
            <div class="preview-option">
              <input type="radio" name="preview-tf" disabled>
              <label>Verdadero</label>
            </div>
            <div class="preview-option">
              <input type="radio" name="preview-tf" disabled>
              <label>Falso</label>
            </div>
          </div>
        `
      case "open":
        return `
          <div class="preview-answers">
            <textarea placeholder="Escribe tu respuesta aquí..." disabled rows="3"></textarea>
          </div>
        `
      case "fill-blank":
        return `
          <div class="preview-answers">
            <p class="fill-blank-instruction">Completa los espacios en blanco</p>
            <div class="blank-inputs">
              ${question.respuestas.respuestas
                .map(
                  (_, index) => `
                <input type="text" placeholder="Espacio ${index + 1}" disabled>
              `,
                )
                .join("")}
            </div>
          </div>
        `
      default:
        return ""
    }
  }

  saveTest() {
    this.saveCurrentFormData()

    // Validate test data
    if (!this.currentTest.nombre || !this.currentTest.fechaInicio || !this.currentTest.fechaFin) {
      window.app.showAlert("Por favor completa todos los campos requeridos", "error")
      this.switchTab("basic-info")
      return
    }

    if (this.currentTest.preguntas.length === 0) {
      window.app.showAlert("Debes agregar al menos una pregunta", "error")
      this.switchTab("questions")
      return
    }

    // Validate dates
    const startDate = new Date(this.currentTest.fechaInicio)
    const endDate = new Date(this.currentTest.fechaFin)

    if (startDate >= endDate) {
      window.app.showAlert("La fecha de fin debe ser posterior a la fecha de inicio", "error")
      this.switchTab("basic-info")
      return
    }

    try {
      // Add creator information
      this.currentTest.creadorId = window.authManager.getCurrentUser().id
      this.currentTest.creadorNombre = window.authManager.getCurrentUser().nombre

      // Save test to data manager
      const savedTest = window.dataManager.createTest(this.currentTest)

      // Clear draft
      localStorage.removeItem("current_test_draft")

      // Reset current test
      this.currentTest = {
        nombre: "",
        descripcion: "",
        materia: "",
        duracion: 60,
        puntosPorCorrecta: 1,
        puntosReducidosPorIncorrecta: 0,
        fechaInicio: "",
        fechaFin: "",
        configuracion: {
          mostrarPuntaje: true,
          permitirRetroceso: true,
          mezclarPreguntas: false,
          mezclarRespuestas: false,
          bloquearCambioTab: false,
          mensajeAlerta: "No cambies de pestaña durante la prueba",
          mensajeFinal: "Has completado la prueba exitosamente",
        },
        preguntas: [],
      }

      window.app.showAlert("Prueba creada exitosamente", "success")
      window.app.loadView("my-tests")
    } catch (error) {
      console.error("Error saving test:", error)
      window.app.showAlert("Error al guardar la prueba", "error")
    }
  }

  saveDraft() {
    this.saveCurrentFormData()
    localStorage.setItem("current_test_draft", JSON.stringify(this.currentTest))
  }

  // Utility methods
  formatDateTimeLocal(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")

    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  populateAnswers(question) {
    // Populate answers when editing a question
    setTimeout(() => {
      switch (question.tipo) {
        case "multiple":
          const options = document.querySelectorAll(".answer-text")
          const correctRadio = document.querySelector(
            `input[name="correct-answer"][value="${question.respuestas.correcta}"]`,
          )

          question.respuestas.opciones.forEach((opcion, index) => {
            if (options[index]) {
              options[index].value = opcion.texto
            }
          })

          if (correctRadio) {
            correctRadio.checked = true
          }
          break

        case "true-false":
          const tfRadio = document.querySelector(
            `input[name="true-false-answer"][value="${question.respuestas.correcta ? "true" : "false"}"]`,
          )
          if (tfRadio) {
            tfRadio.checked = true
          }
          break

        case "open":
          const keywordsInput = document.getElementById("open-keywords")
          const caseSensitiveCheck = document.getElementById("case-sensitive")

          if (keywordsInput) {
            keywordsInput.value = question.respuestas.palabrasClave.join(", ")
          }
          if (caseSensitiveCheck) {
            caseSensitiveCheck.checked = question.respuestas.sensibleMayusculas
          }
          break

        case "fill-blank":
          const container = document.getElementById("blank-answers")
          container.innerHTML = ""

          question.respuestas.respuestas.forEach((respuesta, index) => {
            const blankDiv = document.createElement("div")
            blankDiv.className = "blank-answer"
            blankDiv.innerHTML = `
              <label>Respuesta para espacio ${index + 1}:</label>
              <input type="text" class="blank-input" value="${respuesta}" placeholder="Respuesta correcta">
              ${index > 0 ? '<button type="button" class="btn-small btn-destructive" onclick="this.parentElement.remove()">Eliminar</button>' : ""}
            `
            container.appendChild(blankDiv)
          })
          break
      }
    }, 100)
  }
}

// Create global instance
window.testCreator = new TestCreator()
