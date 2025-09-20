// ======================
// Datos precargados
// ======================
import grades from './grades.json' assert { type: 'json' };
import tests from './tests.json' assert { type: 'json' };

// Variables globales
let currentTest = null;
let currentQuestionIndex = 0;
let answers = {};
let timerInterval = null;

// ======================
// Utilidades
// ======================
function $(id) {
  return document.getElementById(id);
}
function showSection(id) {
  document.querySelectorAll('main > section').forEach(sec => {
    sec.classList.add('hidden');
    sec.setAttribute('aria-hidden', 'true');
  });
  const section = $(id);
  section.classList.remove('hidden');
  section.setAttribute('aria-hidden', 'false');
}

// ======================
// Inicializar select de cursos
// ======================
function loadGrades() {
  const select = $('gradeSelect');
  grades.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    select.appendChild(opt);
  });
}

// ======================
// Validación de inicio
// ======================
function validateStartForm() {
  const name = $('studentName').value.trim();
  const grade = $('gradeSelect').value;
  const code = $('applyCode').value.trim();
  $('btnContinue').disabled = !(name && grade && code);
}

// ======================
// Iniciar prueba
// ======================
function startExam() {
  const code = $('applyCode').value.trim();
  currentTest = tests.find(t => t.code === code);
  if (!currentTest) {
    alert('Código inválido o prueba no encontrada.');
    return;
  }

  $('metaName').textContent = $('studentName').value;
  $('metaGrade').textContent = $('gradeSelect').selectedOptions[0].textContent;
  $('testTitle').textContent = currentTest.name;
  $('testInstructions').textContent = `Duración: ${currentTest.time} minutos`;

  currentQuestionIndex = 0;
  answers = {};
  renderQuestion();

  startTimer(currentTest.time * 60);

  showSection('exam');
}

// ======================
// Timer
// ======================
function startTimer(seconds) {
  let remaining = seconds;
  function update() {
    const min = String(Math.floor(remaining / 60)).padStart(2, '0');
    const sec = String(remaining % 60).padStart(2, '0');
    $('timer').textContent = `${min}:${sec}`;
    if (remaining <= 0) {
      finishExam();
    } else {
      remaining--;
    }
  }
  clearInterval(timerInterval);
  update();
  timerInterval = setInterval(update, 1000);
}

// ======================
// Renderizar pregunta
// ======================
function renderQuestion() {
  const q = currentTest.questions[currentQuestionIndex];
  const container = $('questionContainer');
  container.innerHTML = `
    <h3>${q.text}</h3>
    <div class="options">
      ${q.options.map((opt, i) => `
        <label>
          <input type="radio" name="q${q.id}" value="${i}" ${answers[q.id] == i ? 'checked' : ''}>
          ${opt}
        </label>
      `).join('')}
    </div>
  `;

  // Guardar respuesta al cambiar
  container.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', () => {
      answers[q.id] = parseInt(inp.value);
    });
  });

  // Habilitar/deshabilitar botones
  $('prevBtn').disabled = currentQuestionIndex === 0;
  $('nextBtn').disabled = currentQuestionIndex === currentTest.questions.length - 1;
  $('finishBtn').disabled = Object.keys(answers).length < currentTest.questions.length;
}

// ======================
// Navegación
// ======================
function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}
function nextQuestion() {
  if (currentQuestionIndex < currentTest.questions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  }
}

// ======================
// Terminar prueba
// ======================
function finishExam() {
  clearInterval(timerInterval);
  showSection('result');

  let score = 0;
  currentTest.questions.forEach(q => {
    if (answers[q.id] === q.correct) {
      score += currentTest.points.ok;
    } else {
      score -= currentTest.points.bad;
    }
  });

  $('resultSummary').textContent = `Puntaje: ${score}`;
  $('detailedAnswers').innerHTML = currentTest.questions.map(q => {
    const ans = answers[q.id];
    const correct = q.correct;
    return `<div>
      <strong>${q.text}</strong><br/>
      Tu respuesta: ${ans !== undefined ? q.options[ans] : 'Sin responder'}<br/>
      Correcta: ${q.options[correct]}
    </div>`;
  }).join('<hr/>');
}

// ======================
// Descargar resultados
// ======================
function downloadResults() {
  const data = {
    student: $('studentName').value,
    grade: $('gradeSelect').selectedOptions[0].textContent,
    test: currentTest.name,
    answers
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'result.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ======================
// Eventos
// ======================
window.addEventListener('DOMContentLoaded', () => {
  loadGrades();
  $('studentName').addEventListener('input', validateStartForm);
  $('gradeSelect').addEventListener('change', validateStartForm);
  $('applyCode').addEventListener('input', validateStartForm);
  $('btnContinue').addEventListener('click', startExam);
  $('prevBtn').addEventListener('click', prevQuestion);
  $('nextBtn').addEventListener('click', nextQuestion);
  $('finishBtn').addEventListener('click', finishExam);
  $('downloadBtn').addEventListener('click', downloadResults);
  $('backBtn').addEventListener('click', () => location.reload());
});
