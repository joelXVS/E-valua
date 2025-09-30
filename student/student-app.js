// student-app.js

let grades = { grades: [] };
let tests = { tests: [] };
let teachers = { teachers: [] };

function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', id);
  }
  return id;
}

async function loadInitialData() {
  try {
    const [gResp, tResp, teResp] = await Promise.all([
      fetch('../grades.json'),
      fetch('../tests.json'),
      fetch('../teachers.json')
    ]);
    grades = gResp.ok ? await gResp.json() : { grades: [] };
    tests = tResp.ok ? await tResp.json() : { tests: [] };
    teachers = teResp && teResp.ok ? await teResp.json() : { teachers: [] };
    console.log('Datos cargados:', { grades: grades.grades?.length, tests: tests.tests?.length, teachers: teachers.teachers?.length });
  } catch (err) {
    console.error('Error cargando datos:', err);
    const el = document.getElementById('startMsg');
    if (el) el.textContent = 'Error cargando datos iniciales. Revisa la consola.';
  }
}

function $(id) { return document.getElementById(id); }
function showSection(id) {
  document.querySelectorAll('main > section').forEach(sec => {
    sec.classList.add('hidden');
    sec.setAttribute('aria-hidden', 'true');
  });
  const section = $(id);
  section.classList.remove('hidden');
  section.setAttribute('aria-hidden', 'false');
}

// ---------- cargar cursos ----------
function loadGrades() {
  const select = $('gradeSelect');
  select.innerHTML = '<option value="">-- Seleccionar curso --</option>';
  (grades.grades || []).forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    select.appendChild(opt);
  });
}

// ---------- almacenamiento y bloqueo por estudiante ----------
function getBlockedStudents() {
  try {
    return JSON.parse(localStorage.getItem('blockedStudents') || '[]');
  } catch (_) {
    return [];
  }
}

function isStudentBlocked(_name, code) {
  const blocked = getBlockedStudents();
  const deviceId = getDeviceId();

  // Solo valida si el mismo dispositivo ya fue bloqueado para este código
  return blocked.some(b => b.code === code && b.deviceId === deviceId);
}

function blockStudent(_name, code, reason) {
  try {
    const blocked = getBlockedStudents();
    const deviceId = getDeviceId();

    // Evitar duplicados por si ya está bloqueado
    if (!blocked.some(b => b.code === code && b.deviceId === deviceId)) {
      blocked.push({
        code,
        deviceId,
        reason,
        when: new Date().toISOString()
      });
      localStorage.setItem('blockedStudents', JSON.stringify(blocked));
    }
  } catch (e) {
    console.error('Error bloqueando estudiante:', e);
  }
}

// cheat logs: por intento (se guarda también en localStorage bajo 'cheatLogs' por sesión)
function appendCheatLogForAttempt(sessionId, entry) {
  // sessionId: string (e.g., `${name}::${code}::${timestamp}`)
  try {
    const all = JSON.parse(localStorage.getItem('cheatLogs') || '{}');
    if (!all[sessionId]) all[sessionId] = [];
    all[sessionId].push(entry);
    localStorage.setItem('cheatLogs', JSON.stringify(all));
  } catch (e) {
    console.error('Error guardando cheat log:', e);
  }
}

function getCheatLogsForSession(sessionId) {
  try {
    const all = JSON.parse(localStorage.getItem('cheatLogs') || '{}');
    return all[sessionId] || [];
  } catch (e) {
    return [];
  }
}

// ---------- validaciones inicio ----------
function validateStartForm() {
  const name = $('studentName').value.trim();
  const grade = $('gradeSelect').value;
  const code = $('applyCode').value.trim();
  $('btnContinue').disabled = !(name && grade && code);
  const msg = $('startMsg');
  msg.textContent = '';
  if (code && isStudentBlocked(name, code)) {
    msg.textContent = 'Este dispositivo está bloqueado para esta prueba y no se puede iniciar.';
  }
}

function canStartExam() {
  const name = $('studentName').value.trim();
  const code = $('applyCode').value.trim();
  if (name.length < 16) {
    alert('El nombre completo debe tener al menos 16 caracteres.');
    return false;
  }
  if (code.length < 8) {
    alert('El código de aplicación debe tener al menos 8 caracteres.');
    return false;
  }
  if (isStudentBlocked(name, code)) {
    alert('No puedes iniciar la prueba: se detectó plagio desde este dispositivo. Este código está bloqueado.');
    return false;
  }
  return true;
}

// ----------------- Validación ventana de inicio/fin (fecha + hora) -----------------
function parseIsoOrTimeString(s) {
  // acepta "YYYY-MM-DDTHH:mm:ss" (ISO) o "HH:MM" (hora del día)
  if (!s) return null;
  if (s.includes('T')) return new Date(s);
  // formato HH:MM -> interpretarlo como hoy a esa hora
  const parts = s.split(':').map(Number);
  if (parts.length >= 2) {
    const d = new Date();
    d.setHours(parts[0], parts[1], 0, 0);
    return d;
  }
  return null;
}

function isTestOpen(test) {
  // Prioridad: startDateTime/endDateTime (ISO) si existen.
  const now = new Date();

  if (test.startDateTime || test.endDateTime) {
    const start = parseIsoOrTimeString(test.startDateTime);
    const end = parseIsoOrTimeString(test.endDateTime);
    if (start && end) {
      return now >= start && now <= end;
    }
  }

  // Si no hay info de horario, permitimos
  return true;
}

// ---------- variables examen ----------
let currentTest = null;
let currentQuestionIndex = 0;
let answers = {};
let timerInterval = null;
let examCheatCount = 0;
let examTerminatedForCheating = false;
let currentSessionId = ''; // id único para el intento actual
let currentCheatEvents = []; // en memoria hasta finalizar
let examStartTime = null;

// ---------- iniciar examen ----------
async function startExam() {
  if (!canStartExam()) return;

  const studentName = $('studentName').value.trim();
  const code = $('applyCode').value.trim();
  // buscar prueba por código
  currentTest = (tests.tests || []).find(t => t.code === code);
  if (!currentTest) {
    alert('Código inválido o prueba no encontrada.');
    return;
  }

  const selectedGradeText = $('gradeSelect').selectedOptions[0].textContent;
  const allowedGroups = currentTest.groups || [];
  if (Array.isArray(allowedGroups) && allowedGroups.length > 0 && !allowedGroups.includes(selectedGradeText)) {
    alert('La prueba no está disponible para el grupo/curso seleccionado.');
    return;
  }

  // validar ventana de la prueba (fecha + hora)
  if (!isTestOpen(currentTest)) {
    alert('La prueba no está disponible en este momento. Verifica la fecha y hora de apertura.');
    return;
  }

  // preparar metas
  $('metaName').textContent = studentName;
  $('metaGrade').textContent = selectedGradeText;
  $('testTitle').textContent = currentTest.name;
  $('testInstructions').textContent = `Duración: ${currentTest.time} minutos`;

  // estado
  currentQuestionIndex = 0;
  answers = {};
  examCheatCount = 0;
  examTerminatedForCheating = false;
  currentCheatEvents = [];

  // sessionId único para esta ejecución (usado para cheat logs)
  currentSessionId = `${studentName}::${code}::${new Date().toISOString()}`;

  // Guardamos el orden original de las preguntas
  currentTest.questions.forEach((q, idx) => q._originalIndex = idx);

  // Mezclamos para mostrar en orden aleatorio (sin perder el original)
  currentTest.questions = mezclarArray([...currentTest.questions]);

  // Mezclar opciones de las preguntas MCQ
  currentTest.questions.forEach(q => {
    if (q.type === 'mcq' && Array.isArray(q.options)) {
      // Guardar el índice correcto original
      const originalAnswerIndex = q.answer;
  
      // Convertimos todas las opciones a objetos {text, image, _originalIndex}
      q.options = q.options.map((opt, i) =>
        (typeof opt === 'string')
          ? { text: opt, _originalIndex: i }
          : { ...opt, _originalIndex: i }
      );
  
      // Mezclamos las opciones
      q.options = mezclarArray([...q.options]);
  
      // Buscar la nueva posición de la opción correcta
      q.answer = q.options.findIndex(opt => opt._originalIndex === originalAnswerIndex);
    }
  });

  // intentar fullscreen
  enterFullScreen();

  // enganchar listeners anti-trampa
  attachAntiCheatListeners();

  loadExamProgress();
  renderQuestion();
  examStartTime = Date.now();
  startTimer((currentTest.time || 0) * 60);
  showSection('exam');
}

// ---------- fullscreen ----------
function enterFullScreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
}

function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

// ---------- anti-cheat listeners ----------
function attachAntiCheatListeners() {
  examCheatCount = 0;
  examTerminatedForCheating = false;
  currentCheatEvents = currentCheatEvents || [];

  function recordEvent(kind) {
    examCheatCount++;
    const entry = { when: new Date().toISOString(), kind, count: examCheatCount };
    currentCheatEvents.push(entry);
    // persistimos por sesión
    appendCheatLogForAttempt(currentSessionId, entry);
    return entry;
  }

  let tabSwitchCount = 0; // contador de cambios de pestaña
  let visibilityLock = false; // evita bucles
  
  let blurCount = 0; // contador de cambios a segundo plano
  let blurLock = false; // evita spam de prompts

  function handleVisibilityChange() {
    if (document.hidden && !visibilityLock) {
      visibilityLock = true;
      tabSwitchCount++;

      // registrar evento en logs
      const ev = recordEvent('visibility-change');

      if (tabSwitchCount === 1) {
        alert('Atención: Cambio de pestaña detectado. Tienes 2 advertencias más antes de terminar la prueba.');
      } else if (tabSwitchCount >= 3) {
        alert('Se detectaron 3 cambios de pestaña. La prueba ha terminado.');
        examTerminatedForCheating = true;
        const name = $('studentName').value.trim();
        const code = $('applyCode').value.trim();
        recordEvent('visibility-violation');
        blockStudent(name, code, 'visibility-violation');
        finishExam(true);
      }

      setTimeout(() => visibilityLock = false, 1000);
    }
  }
  
  function handleWindowBlur() {
    if (!blurLock) {
      blurLock = true;
      blurCount++;
      recordEvent('window-blur');

      if (blurCount === 1) {
        alert('Atención: Se detectó que la pestaña quedó en segundo plano. Tienes 2 advertencias más.');
      } else if (blurCount >= 3) {
        alert('Se detectaron 3 cambios a segundo plano. La prueba ha terminado.');
        examTerminatedForCheating = true;
        const name = $('studentName').value.trim();
        const code = $('applyCode').value.trim();
        recordEvent('blur-violation');
        blockStudent(name, code, 'blur-violation');
        finishExam(true);
      }

      setTimeout(() => blurLock = false, 1000);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleWindowBlur);

  document._antiCheatHandles = { handleVisibilityChange, handleWindowBlur };
}

function detachAntiCheatListeners() {
  if (document._antiCheatHandles) {
    document.removeEventListener('visibilitychange', document._antiCheatHandles.handleVisibilityChange);
    window.removeEventListener('blur', document._antiCheatHandles.handleWindowBlur);
    delete document._antiCheatHandles;
  }
}

// ---------- timer ----------
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

// ---------- utilidad - mezclar preguntas ----------
function mezclarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // índice aleatorio entre 0 e i
    [array[i], array[j]] = [array[j], array[i]];   // intercambio de elementos
  }
  return array;
}

// ---------- render pregunta ----------
function renderQuestion() {
  const q = currentTest.questions[currentQuestionIndex];
  const container = $('questionContainer');
  let inner = `<h3>${currentQuestionIndex + 1}. ${escapeHtml(q.title)}</h3>`;

  // Mostrar imagen si existe
  if (q.image) {
    inner += `<div><img src="${q.image}" alt="Imagen de la pregunta" style="max-width:100%; margin:8px 0;" /></div>`;
  }

  // ---------- TIPOS DE PREGUNTAS ----------
  if (q.type === 'mcq') {
    // Opción múltiple (una sola respuesta)
    inner += `<div class="options">${(q.options || []).map((opt, i) => `
      <label style="display:block; margin:6px 0;">
        <input type="radio" name="q${currentQuestionIndex}" value="${i}" 
          ${answers[q.title] == i ? 'checked' : ''}>
        ${escapeHtml(opt.text || opt)}
        ${opt.image ? `<div><img src="${opt.image}" alt="Opción ${i+1}" style="max-width:100px; margin-top:4px;" /></div>` : ''}
      </label>`).join('')}</div>`;

  } else if (q.type === 'tf') {
    // Verdadero / Falso
    inner += `<div class="options">
      <label><input type="radio" name="q${currentQuestionIndex}" value="1" ${answers[q.title]==1?'checked':''}> Verdadero</label>
      <label><input type="radio" name="q${currentQuestionIndex}" value="0" ${answers[q.title]==0?'checked':''}> Falso</label>
    </div>`;

  } else if (q.type === 'open') {
    // Respuesta abierta
    inner += `<textarea id="open_${currentQuestionIndex}" rows="5" style="width:100%" 
      placeholder="Escribe tu respuesta aquí...">${answers[q.title] || ''}</textarea>
      <p class="small">Responde en pocas líneas.</p>`;

  } else if (q.type === 'short') {
    // Respuesta corta
    inner += `<input type="text" id="short_${currentQuestionIndex}" style="width:100%; padding:8px;" 
      placeholder="Escribe tu respuesta breve..." value="${answers[q.title] || ''}" />`;

  } else if (q.type === 'multi') {
    // Respuesta múltiple (varias correctas)
    inner += `<div class="options">${(q.options || []).map((opt, i) => `
      <label style="display:block; margin:6px 0;">
        <input type="checkbox" name="q${currentQuestionIndex}" value="${i}" 
          ${Array.isArray(answers[q.title]) && answers[q.title].includes(i) ? 'checked' : ''}>
        ${escapeHtml(opt.text || opt)}
      </label>`).join('')}</div>`;

  } else if (q.type === 'likert') {
    // Escala de opinión
    inner += `<div class="options likert">` +
      (q.scale || ["Totalmente en desacuerdo","En desacuerdo","Neutral","De acuerdo","Totalmente de acuerdo"])
        .map((s, i) => `
          <label>
            <input type="radio" name="q${currentQuestionIndex}" value="${i}" 
              ${answers[q.title] == i ? 'checked' : ''}> ${escapeHtml(s)}
          </label>`).join('') +
      `</div>`;

  } else if (q.type === 'numeric') {
    // Numérica
    inner += `<input type="number" id="num_${currentQuestionIndex}" 
      class="numeric-input" value="${answers[q.title] || ''}" />`;

  } else if (q.type === 'match') {
    // Relacionar columnas (select)
    inner += `<div class="match-container">`;
    (q.pairs || []).forEach((p, i) => {
      const ans = answers[q.title]?.[i] || "";
      inner += `<div class="match-row">
        <span>${escapeHtml(p.left)}</span>
        <select id="match_${currentQuestionIndex}_${i}">
          <option value="">-- Selecciona --</option>
          ${p.right.map(r => `<option value="${escapeHtml(r)}" ${ans===r?'selected':''}>${escapeHtml(r)}</option>`).join('')}
        </select>
      </div>`;
    });
    inner += `</div>`;

  } else if (q.type === 'gaptext') {
    // Rellenar espacios arrastrando
    inner += `<p>${(q.text || "").replace(/\[\[(\d+)\]\]/g, (m, idx) => {
      const current = answers[q.title]?.[idx] || "";
      return `<span class="gap" data-gap="${idx}">${escapeHtml(current) || "______"}</span>`;
    })}</p>
    <div class="gap-options">
      ${(q.options || []).map(o => `<span class="gap-opt" draggable="true">${escapeHtml(o)}</span>`).join('')}
    </div>`;

  } else if (q.type === 'hotspot') {
    // Imagen interactiva (clic en zonas)
    inner += `<div class="hotspot-container">
      <img src="${q.image}" alt="Imagen interactiva" class="hotspot-img" />
    </div>
    <p class="small">Haz clic en la zona correspondiente.</p>`;

  } else if (q.type === 'ordering') {
    // Ordenar secuencia (drag & drop)
    inner += `<ul class="ordering" id="order_${currentQuestionIndex}">
      ${(answers[q.title] || q.items || []).map((item, i) => `
        <li class="order-item" draggable="true" data-idx="${i}">${escapeHtml(item)}</li>
      `).join('')}
    </ul>
    <p class="small">Arrastra los elementos para ponerlos en el orden correcto.</p>`;

  } else {
    inner += `<div class="small">Tipo de pregunta desconocido.</div>`;
  }

  container.innerHTML = inner;

  // ---------- LISTENERS PARA RESPUESTAS ----------
  // Radios (mcq, tf, likert)
  container.querySelectorAll('input[type=radio]').forEach(inp => {
    inp.addEventListener('change', () => {
      answers[q.title] = q.type === 'mcq' || q.type === 'tf' || q.type === 'likert'
        ? parseInt(inp.value) : inp.value;
      updateNavButtonsAndFinishButton();
    });
  });

  // Abierta
  const ta = container.querySelector(`#open_${currentQuestionIndex}`);
  if (ta) ta.addEventListener('input', () => {
    answers[q.title] = ta.value;
    updateNavButtonsAndFinishButton();
  });

  // Corta
  const shortInput = container.querySelector(`#short_${currentQuestionIndex}`);
  if (shortInput) shortInput.addEventListener('input', () => {
    answers[q.title] = shortInput.value.trim();
    updateNavButtonsAndFinishButton();
  });

  // Numérica
  const numInput = container.querySelector(`#num_${currentQuestionIndex}`);
  if (numInput) numInput.addEventListener('input', () => {
    answers[q.title] = numInput.value;
    updateNavButtonsAndFinishButton();
  });

  // Múltiple
  container.querySelectorAll(`input[type=checkbox][name=q${currentQuestionIndex}]`).forEach(chk => {
    chk.addEventListener('change', () => {
      answers[q.title] = Array.from(container.querySelectorAll(`input[name=q${currentQuestionIndex}]:checked`))
        .map(c => parseInt(c.value));
      updateNavButtonsAndFinishButton();
    });
  });

  // Match
  (q.pairs || []).forEach((p,i) => {
    const sel = container.querySelector(`#match_${currentQuestionIndex}_${i}`);
    if (sel) sel.addEventListener('change', () => {
      if (!answers[q.title]) answers[q.title] = {};
      answers[q.title][i] = sel.value;
      updateNavButtonsAndFinishButton();
    });
  });

  // GapText (drag & drop)
  container.querySelectorAll('.gap-opt').forEach(opt => {
    opt.addEventListener('dragstart', e => e.dataTransfer.setData("text/plain", opt.textContent));
  });
  container.querySelectorAll('.gap').forEach(span => {
    span.addEventListener('dragover', e => e.preventDefault());
    span.addEventListener('drop', e => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      span.textContent = text;
      if (!answers[q.title]) answers[q.title] = {};
      answers[q.title][span.dataset.gap] = text;
      // eliminar opción usada
      const optEl = [...container.querySelectorAll('.gap-opt')].find(o=>o.textContent===text);
      if(optEl) optEl.remove();
      updateNavButtonsAndFinishButton();
    });
  });

  // Ordering (drag & drop)
  const list = container.querySelector(`#order_${currentQuestionIndex}`);
  if (list) {
    let dragged;
    list.querySelectorAll('.order-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragged = item;
        e.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener('dragover', e => e.preventDefault());
      item.addEventListener('drop', e => {
        e.preventDefault();
        if (dragged && dragged !== item) {
          const rect = item.getBoundingClientRect();
          const isAfter = (e.clientY - rect.top) > rect.height / 2;
          list.insertBefore(dragged, isAfter ? item.nextSibling : item);
          answers[q.title] = [...list.querySelectorAll('.order-item')].map(li => li.textContent);
          updateNavButtonsAndFinishButton();
        }
      });
    });
  }

  // Hotspot (clic en imagen)
  if (q.type === 'hotspot') {
    const img = container.querySelector('.hotspot-img');
    img.addEventListener('click', e => {
      const rect = e.target.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width).toFixed(2);
      const y = ((e.clientY - rect.top) / rect.height).toFixed(2);
      answers[q.title] = { x, y };
      alert(`Seleccionaste la posición (${x}, ${y})`);
      updateNavButtonsAndFinishButton();
    });
  }

  // ---------- NAV ----------
  saveExamProgress();
  $('prevBtn').disabled = currentQuestionIndex === 0;
  $('nextBtn').disabled = currentQuestionIndex === currentTest.questions.length - 1;
  updateNavButtonsAndFinishButton();
}

function updateNavButtonsAndFinishButton() {
  const total = currentTest.questions.length;
  let answeredCount = 0;
  currentTest.questions.forEach(q => {
    const a = answers[q.title];
    if (a !== undefined && a !== null && String(a).trim() !== '') answeredCount++;
  });
  $('finishBtn').disabled = answeredCount < currentTest.questions.length;
}

function saveExamProgress() {
  try {
    const progress = {
      currentTestCode: currentTest?.code || '',
      currentQuestionIndex,
      // Guardamos respuestas asociadas al índice original
      answers: Object.fromEntries(
        Object.entries(answers).map(([title, val]) => {
          const q = (currentTest.questions || []).find(qq => qq.title === title);
          return [q?._originalIndex ?? title, val];
        })
      ),
      remainingTime: $('timer').textContent, // ⏱ guardamos lo que queda (ej: "12:34")
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('examProgress', JSON.stringify(progress));
  } catch (e) {
    console.error('Error guardando progreso:', e);
  }
}

function loadExamProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('examProgress') || '{}');
    if (saved && saved.currentTestCode === currentTest?.code) {
      currentQuestionIndex = saved.currentQuestionIndex || 0;
      answers = {};
      (currentTest.questions || []).forEach(q => {
        const val = saved.answers?.[q._originalIndex];
        if (val !== undefined) answers[q.title] = val;
      });

      // restaurar tiempo
      if (saved.remainingTime) {
        const [min, sec] = saved.remainingTime.split(':').map(Number);
        const seconds = (min * 60) + sec;
        startTimer(seconds);
      } else {
        startTimer((currentTest.time || 0) * 60);
      }
    }
  } catch (e) {
    console.error('Error cargando progreso:', e);
  }
}

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

// ---------- evaluación ----------
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normalizar respuestas abiertas
function normalizeText(txt) {
  return txt
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // elimina tildes
    .trim()
    .replace(/\s+/g, " "); // quita espacios dobles
}

// Evaluación de respuesta abierta con keywords + longitud + antitramposos
function evaluateOpenAnswer(answerText, q, test) {
  const text = String(answerText || '').trim();
  const lower = normalizeText(text);

  // Palabras clave (si existen)
  const kw = q.keywords || [];
  let totalWeight = 0;
  kw.forEach(k => totalWeight += Number(k.weight) || 0);

  // freeAnswerLength desde pregunta o test
  const qLen = (typeof q.freeAnswerLength === 'number') ? q.freeAnswerLength : undefined;
  const tLen = (typeof test.freeAnswerLength === 'number') ? test.freeAnswerLength : 0;
  const threshold = (qLen !== undefined) ? qLen : tLen;

  // --- 1) Evaluación por keywords ---
  let foundWeightSum = 0;
  const found = [];
  if (kw.length > 0 && totalWeight > 0) {
    kw.forEach(k => {
      const w = Number(k.weight) || 0;
      const re = new RegExp(`\\b${escapeRegExp(String(k.word).toLowerCase())}\\b`, 'g');
      const matches = lower.match(re);
      const count = matches ? matches.length : 0;
      if (count > 0) {
        foundWeightSum += w * count;
        found.push({ word: k.word, count, weight: w });
      }
    });
  }
  const keywordRatio = totalWeight > 0 ? Math.min(foundWeightSum / totalWeight, 1) : 0;

  // --- 2) Evaluación por longitud ---
  let lengthRatio = 0;
  if (threshold > 0) {
    const cleaned = lower.replace(/[^a-záéíóúüñ\s]/gi, " "); // quitar rarezas
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    const uniqueWords = [...new Set(words)];

    // condición antitramposos: si 70%+ de las palabras son repeticiones, cuenta como 0
    const repetitionRatio = uniqueWords.length / (words.length || 1);
    if (repetitionRatio < 0.3) {
      lengthRatio = 0; // mucha repetición → trampa
    } else {
      lengthRatio = text.length >= threshold ? 1 : 0;
    }
  }

  // --- 3) Combinar ---
  // Si hay keywords → mezcla keywordRatio y lengthRatio
  // Si no → sólo longitud
  let finalRatio = 0;
  if (kw.length > 0) {
    // promedio simple (puedes cambiarlo a ponderado)
    finalRatio = (keywordRatio + lengthRatio) / 2;
  } else {
    finalRatio = lengthRatio;
  }

  return {
    scoreRatio: Math.max(0, Math.min(1, finalRatio)),
    found,
    usedMode: (kw.length > 0 ? 'keywords+length' : 'length')
  };
}

// ---------- formatear respuestas usuario ----------
function formatAnswer(q, ans) {
  if (ans === undefined || ans === null || ans === "" || (typeof ans === "object" && Object.keys(ans).length === 0)) {
    return "Sin responder";
  }

  switch (q.type) {
    case "mcq":
      // opción múltiple (una sola)
      return q.options && q.options[ans] 
        ? (q.options[ans].text || q.options[ans]) 
        : String(ans);

    case "tf":
      // verdadero/falso
      return ans == 1 ? "Verdadero" : "Falso";

    case "open":
    case "short":
      // respuesta libre
      return String(ans);

    case "multi":
      // selección múltiple (varias correctas)
      return Array.isArray(ans) && q.options 
        ? ans.map(i => q.options[i].text || q.options[i]).join(", ") 
        : String(ans);

    case "likert":
      // escala de opinión
      return q.scale && q.scale[ans] ? q.scale[ans] : String(ans);

    case "numeric":
      // numérica
      return String(ans);

    case "match":
      // correspondencia
      return Object.entries(ans)
        .map(([i, v]) => `${q.pairs[i].left} → ${v}`)
        .join("; ");

    case "gaptext":
      // completar espacios
      return Object.entries(ans)
        .map(([i, v]) => `${i}: ${v}`)
        .join(", ");

    case "ordering":
      // ordenar secuencia
      return Array.isArray(ans) ? ans.join(" → ") : String(ans);

    case "hotspot":
      // clic en zona de imagen
      return ans.x && ans.y 
        ? `Coordenadas: (${ans.x}, ${ans.y})` 
        : String(ans);

    default:
      return String(ans);
  }
}

// ---------- formatear respuestas correctas ----------
function formatCorrectAnswer(q) {
  if (q.type === "mcq") {
    return q.options && q.options[q.answer]
      ? (q.options[q.answer].text || q.options[q.answer])
      : String(q.answer);

  } else if (q.type === "tf") {
    return q.answer == 1 ? "Verdadero" : "Falso";

  } else if (q.type === "open" || q.type === "short") {
    return q.answer ? String(q.answer) : "(respuesta abierta)";

  } else if (q.type === "multi") {
    return Array.isArray(q.answer) && q.options
      ? q.answer.map(i => q.options[i].text || q.options[i]).join(", ")
      : String(q.answer);

  } else if (q.type === "likert") {
    return q.scale && q.answer !== undefined
      ? q.scale[q.answer]
      : "(no aplica)";

  } else if (q.type === "numeric") {
    return String(q.answer);

  } else if (q.type === "match") {
    return (q.pairs || [])
      .map(p => `${p.left} → ${p.correct}`)
      .join("; ");

  } else if (q.type === "gaptext") {
    return q.answers
      ? Object.entries(q.answers)
          .map(([i,v]) => `${i}: ${v}`)
          .join(", ")
      : "(sin clave)";

  } else if (q.type === "ordering") {
    return q.correct ? q.correct.join(" → ") : "(sin clave)";

  } else if (q.type === "hotspot") {
    return q.correctArea
      ? `Área válida: (${q.correctArea.x1}, ${q.correctArea.y1}) a (${q.correctArea.x2}, ${q.correctArea.y2})`
      : "(sin clave)";

  } else {
    return "(sin clave)";
  }
}

// ---------- enviar correo al docente ----------
function enviarResultadosAlDocente(test, studentName, grade, score, details) {
  // Buscar docente en teachers.json que tenga asignado este test
  const teacher = (teachers.teachers || []).find(t => (t.tests || []).includes(test.code));
  const teacherEmail = teacher ? teacher.email : null;

  if (!teacherEmail) {
    console.warn("No se encontró correo de docente para este test:", test.code);
    return;
  }

  const payload = {
    teacherEmail,
    studentName,
    grade,
    testName: test.name,
    score,
    details
  };

  fetch("https://script.google.com/macros/s/AKfycbysyiyKbGNlgWmmdMHnyJSQWg8blFikEd2Vp9KxBUKjWz4gg-UgC4Paa5I7xUFc5X-EUQ/exec", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(r => r.text())
  .then(res => console.log("Correo enviado:", res))
  .catch(err => console.error("Error enviando correo:", err));
}

// ---------- terminar examen ----------
function finishExam(cheatingForced = false) {
  clearInterval(timerInterval);
  detachAntiCheatListeners();
  exitFullScreen();

  const studentName = $('studentName').value.trim();
  const code = $('applyCode').value.trim();

  let totalScore = 0;
  const details = [];

  (currentTest.questions || []).forEach((q, idx) => {
    const studentAns = answers[q.title];
    let qPoints = 0;
    const possiblePoints = (currentTest.points && currentTest.points.ok) ? Number(currentTest.points.ok) : 1;

    // ---------------- TIPOS DE PREGUNTAS ----------------
    if (q.type === 'mcq') {
      if (studentAns !== undefined && parseInt(studentAns) === parseInt(q.answer)) {
        qPoints = possiblePoints;
      } else if (studentAns !== undefined) {
        qPoints = (currentTest.points && currentTest.points.bad) ? -Math.abs(Number(currentTest.points.bad)) : 0;
      }

    } else if (q.type === 'tf') {
      if (studentAns !== undefined && parseInt(studentAns) === parseInt(q.answer)) {
        qPoints = possiblePoints;
      } else if (studentAns !== undefined) {
        qPoints = (currentTest.points && currentTest.points.bad) ? -Math.abs(Number(currentTest.points.bad)) : 0;
      }

    } else if (q.type === 'open' || q.type === 'short') {
      const evalData = evaluateOpenAnswer(String(studentAns || ''), q, currentTest);
      qPoints = Math.round((possiblePoints * evalData.scoreRatio) * 1000) / 1000;

    } else if (q.type === 'multi') {
      const correct = Array.isArray(q.answer) ? q.answer.sort().join(',') : '';
      const given = Array.isArray(studentAns) ? studentAns.sort().join(',') : '';
      qPoints = (correct === given) ? possiblePoints : 0;

    } else if (q.type === 'likert') {
      qPoints = possiblePoints; // no hay correcto/incorrecto

    } else if (q.type === 'numeric') {
      qPoints = (parseFloat(studentAns) === parseFloat(q.answer)) ? possiblePoints : 0;

    } else if (q.type === 'match') {
      let matches = 0;
      (q.pairs || []).forEach((p,i) => {
        if (studentAns && studentAns[i] === p.correct) matches++;
      });
      qPoints = (matches / (q.pairs?.length || 1)) * possiblePoints;

    } else if (q.type === 'gaptext') {
      let matches = 0;
      const total = Object.keys(q.answers || {}).length;
      if (total > 0) {
        Object.entries(q.answers).forEach(([i, val]) => {
          if (studentAns && studentAns[i] === val) matches++;
        });
        qPoints = (matches / total) * possiblePoints;
      }

    } else if (q.type === 'hotspot') {
      if (studentAns && q.correctArea) {
        const { x, y } = studentAns;
        const { x1, y1, x2, y2 } = q.correctArea; // área rectangular
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
          qPoints = possiblePoints;
        }
      }

    } else if (q.type === 'ordering') {
      const correct = (q.correct || []).join(',');
      const given = (studentAns || []).join(',');
      qPoints = (correct === given) ? possiblePoints : 0;
    }

    totalScore += qPoints;

    // ---------------- DETALLES ----------------
    const answered = studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '';

    const detail = {
      index: (q._originalIndex !== undefined ? q._originalIndex + 1 : idx + 1),
      title: q.title,
      type: q.type,
      answered,
      studentAnswer: formatAnswer(q, studentAns),
      correctAnswer: formatCorrectAnswer(q),
      points: qPoints
    };

    if (q.type === 'open' || q.type === 'short') {
      detail.openEval = evaluateOpenAnswer(String(studentAns || ''), q, currentTest);
    }

    details.push(detail);
  });

  totalScore = Math.round(totalScore * 1000) / 1000;

  // cheat logs
  const cheatLogs = getCheatLogsForSession(currentSessionId) || currentCheatEvents || [];

  // mostrar sección de resultados
  showSection('result');
  const elapsedMs = Date.now() - examStartTime;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const min = String(Math.floor(elapsedSec / 60));
  const sec = String(elapsedSec % 60).padStart(2, '0');
  $('resultSummary').textContent = `Puntaje: ${totalScore} ≈ ${totalScore.toFixed(1)} \n Tiempo: ${min}:${sec}`;

  const showCorrect = !!currentTest.showCorrect;

  const detailsHtml = details.map(d => {
    let tipoLiteral = {
      mcq: "Selección múltiple",
      tf: "Verdadero/Falso",
      open: "Respuesta abierta",
      short: "Respuesta corta",
      multi: "Respuesta múltiple",
      likert: "Escala Likert",
      numeric: "Numérica",
      match: "Correspondencia",
      gaptext: "Completar espacios",
      hotspot: "Imagen interactiva",
      ordering: "Ordenar secuencia"
    }[d.type] || "Otro";

    return `<div style="margin-bottom:8px;">
      <strong>${d.index}. ${escapeHtml(d.title)}</strong><br/>
      Tipo: ${tipoLiteral}<br/>
      ${d.answered 
        ? `<strong>Tu respuesta:</strong> ${escapeHtml(String(d.studentAnswer))}`
        : `<strong>Tu respuesta:</strong> <em>Sin responder</em>`}<br/>
      ${showCorrect ? `<strong>Respuesta correcta:</strong> ${escapeHtml(String(d.correctAnswer))}<br/>` : ''}
      <strong>Puntos obtenidos:</strong> ${d.points}<br/>
      ${d.type === 'open' || d.type === 'short' ? `<div class="small">Palabras clave detectadas: ${d.openEval?.found?.map(f=>escapeHtml(f.word)+' (x'+f.count+')').join(', ') || 'Ninguna'}</div>` : ''}
    </div><hr/>`;
  }).join('');

  $('detailedAnswers').innerHTML = `<div style="text-align:center;"><strong>Resumen de la prueba:</strong></div>
    <div style="margin-top:8px">${detailsHtml}</div>
    <div style="margin-top:8px; text-align: center;"><strong>Eventos de seguridad:</strong> ${cheatLogs.length ? cheatLogs.map(e=>`${e.when} (${e.kind})`).join(', ') : 'Ninguno'}</div>`;

  // guardar resultado
  try {
    const stored = JSON.parse(localStorage.getItem('results') || '[]');
    stored.push({
      student: studentName,
      grade: $('gradeSelect').selectedOptions[0].textContent,
      test: currentTest.name,
      testCode: currentTest.code,
      timestamp: new Date().toISOString(),
      score: totalScore,
      details,
      cheatLogs
    });
    localStorage.setItem('results', JSON.stringify(stored));
  } catch (e) { console.error('Error guardando resultado:', e); }

  // mensaje al docente
  const teacher = (teachers.teachers || [])[0] || {}; 
  let msg = "Envia estos resultados en PDF al docente ";
  if (teacher.name) msg += teacher.name;
  if (teacher.email) msg += " al correo " + teacher.email;
  if (teacher.phone) msg += " o número de teléfono " + teacher.phone;
  const msgEl = document.createElement("p");
  msgEl.className = "small";
  msgEl.style.marginTop = "12px";
  msgEl.textContent = msg;
  $('result').appendChild(msgEl);

  enviarResultadosAlDocente(currentTest, studentName, $('metaGrade').textContent, totalScore, JSON.stringify(details, null, 2));

  if (examTerminatedForCheating) {
    alert('La prueba terminó por comportamiento no permitido. Tu intento fue registrado y tu acceso bloqueado.');
  } else {
    localStorage.removeItem('examProgress');
  }
}

// ---------- descargar JSON ----------
// Incluye cheatLogs del intento
function downloadResults() {
  if (!currentTest) return;
  const data = {
    student: $('studentName').value.trim(),
    grade: $('gradeSelect').selectedOptions[0].textContent,
    test: currentTest.name,
    testCode: currentTest.code,
    timestamp: new Date().toISOString(),
    answers,
    cheatLogs: getCheatLogsForSession(currentSessionId) || currentCheatEvents || []
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "resultado.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- truncar texto PDF ---------- //
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;             
}

// ---------- exportar PDF ----------
function downloadResultsPdf() {
  if (!currentTest) return;
  let lastStored = null;
  try {
    const stored = JSON.parse(localStorage.getItem('results') || '[]');
    lastStored = stored.length ? stored[stored.length - 1] : null;
  } catch (e) {
    lastStored = null;
  }

  // si no hay detalles en lastStored, tomamos los que se están mostrando en memoria
  const docData = lastStored && lastStored.details?.length
    ? lastStored
    : {
        student: $('studentName').value.trim(),
        grade: $('gradeSelect').selectedOptions[0].textContent,
        test: currentTest.name,
        testCode: currentTest.code,
        timestamp: new Date().toISOString(),
        score: $('resultSummary').textContent || '',
        details: (typeof details !== 'undefined') ? details : [],
        cheatLogs: getCheatLogsForSession(currentSessionId) || currentCheatEvents || []
      };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'letter');

  // Cabecera
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(truncateText(`Resultados — ${docData.test}`, 80), 40, 40, { maxWidth: 500 });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  let y = 90;
  doc.text(`Estudiante: ${docData.student}`, 40, y); y += 15;
  doc.text(`Curso: ${docData.grade}`, 40, y); y += 15;
  doc.text(`Código de prueba: ${docData.testCode}`, 40, y); y += 15;
  doc.text(`Fecha: ${docData.timestamp}`, 40, y); y += 15;
  doc.text(`Puntaje: ${docData.score !== undefined ? String(docData.score) : ''}`, 40, y); 
  y += 30;

  // Tabla de resultados bonitos con colores
  if (docData.details && docData.details.length) {
    const rows = docData.details.map(d => [
      d.index || '',
      truncateText(String(d.title || ''), 60),
      String(
        d.type === 'mcq'
          ? (d.studentAnswer?.text || d.studentAnswer || '')
          : d.type === 'tf'
            ? (d.studentAnswer === '1' ? 'VERDADERO' : d.studentAnswer === '0' ? 'FALSO' : d.studentAnswer || '')
            : d.studentAnswer || ''
      ),
      d.points || ''
    ]);
    
    doc.autoTable({
      startY: y,
      head: [['N°', 'Pregunta', 'Respuesta alumno', 'Puntos']],
      body: rows,
      styles: {
        fontSize: 9,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: [200, 200, 200]
      },
      headStyles: {
        fillColor: [41, 128, 185], // azul bonito
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.4,
        lineColor: [180, 180, 180]
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 40, right: 40 }
    });

    y = doc.lastAutoTable.finalY + 20;
  }

  // Eventos de seguridad (plagio, trampas, etc.)
  if ((docData.cheatLogs || []).length) {
    doc.setFontSize(12);
    doc.setTextColor(200, 0, 0);
    doc.text('Eventos de seguridad detectados:', 40, y);
    y += 10;

    const cheatRows = (docData.cheatLogs || []).map(e => [
      e.when ? new Date(e.when).toLocaleString("es-CO", { 
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      }) : '',
      e.kind || ''
    ]);

    doc.autoTable({
      startY: y,
      head: [['Fecha/Hora', 'Evento']],
      body: cheatRows,
      styles: {
        fontSize: 9,
        halign: 'center',
        lineWidth: 0.2,
        lineColor: [200, 200, 200]
      },
      headStyles: {
        fillColor: [192, 57, 43], // rojo
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.4,
        lineColor: [180, 180, 180]
      },
      alternateRowStyles: {
        fillColor: [252, 230, 230]
      },
      margin: { left: 40, right: 40 }
    });
  }

  // Guardar archivo
  doc.save(`${docData.testCode || 'result'}-${(docData.student||'estudiante').replace(/\s+/g,'_')}.pdf`);
}

// ---------- descargar Certificado aparte ----------
function downloadCertificate() {
  if (!currentTest) return;

  let lastStored = null;
  try {
    const stored = JSON.parse(localStorage.getItem('results') || '[]');
    lastStored = stored.length ? stored[stored.length - 1] : null;
  } catch (e) {
    lastStored = null;
  }

  const docData = lastStored || {
    student: $('studentName').value.trim(),
    grade: $('gradeSelect').selectedOptions[0]?.textContent || '',
    test: currentTest.name,
    testCode: currentTest.code,
    timestamp: new Date().toISOString(),
    score: $('resultSummary').textContent || '',
    cheatLogs: getCheatLogsForSession(currentSessionId) || currentCheatEvents || []
  };

  const teacher = (teachers.teachers || []).find(t => (t.tests || []).includes(currentTest.code));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Bordes dobles
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(6);
  doc.rect(20, 20, pageWidth - 40, pageHeight - 40);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(2);
  doc.rect(35, 35, pageWidth - 70, pageHeight - 70);

  // Fuente académica
  doc.setFont("times", "normal");

  // Logo (si existe)
  try {
    const img = new Image();
    img.src = "../utils/logo.png";
    doc.addImage(img, "PNG", pageWidth/2 - 40, 50, 80, 80);
  } catch (_) {}

  // Encabezado
  doc.setFontSize(26);
  doc.setTextColor(0, 70, 140);
  doc.text("CERTIFICADO DE APLICACIÓN", pageWidth/2, 160, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(80, 80, 80);
  doc.text("Esta prueba fue presentada por:", pageWidth/2, 200, { align: "center" });

  // Nombre del estudiante
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold");
  doc.text(docData.student, pageWidth/2, 240, { align: "center" });
  doc.setFont("times", "normal");

  // Información de la prueba
  doc.setFontSize(14);
  doc.text(`Realizada el ${new Date().toLocaleString('es-CO',{dateStyle:'full', timeStyle:'short'})}`, pageWidth/2, 280, { align: "center" });
  
  let y = 304;
  const info = [
    `Del curso: ${docData.grade}`,
    `Prueba aplicada: ${docData.test}`,
    `Código de aplicación: ${docData.testCode}`,
    `Docente: ${teacher ? teacher.name : '-'}`,
    `Puntaje obtenido: ${docData.score}`,
    `Intentos de trampa detectados: ${(docData.cheatLogs || []).length}`,
  ];
  info.forEach(line => { doc.text(line, pageWidth/2, y, { align: "center" }); y += 24; });

  // Pie - firma del docente (colocada al final seguro)
  const firmaY = pageHeight - 100;
  doc.setFontSize(12);
  doc.text("_____________________________", pageWidth/2, firmaY, { align: "center" });
  doc.text("Firma docente autorizado", pageWidth/2, firmaY + 20, { align: "center" });

  // Guardar
  doc.save(`certificado-${(docData.student||'estudiante').replace(/\s+/g,'_')}.pdf`);
}

// ---------- eventos DOM ----------
window.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  loadGrades();
  $('studentName').addEventListener('input', validateStartForm);
  $('gradeSelect').addEventListener('change', validateStartForm);
  $('applyCode').addEventListener('input', validateStartForm);
  $('btnContinue').addEventListener('click', startExam);
  $('prevBtn').addEventListener('click', prevQuestion);
  $('nextBtn').addEventListener('click', nextQuestion);
  $('finishBtn').addEventListener('click', () => finishExam(false));
  $('downloadBtn').addEventListener('click', downloadResults);
  $('downloadPdfBtn').addEventListener('click', downloadResultsPdf);
  $('downloadCertBtn').addEventListener('click', downloadCertificate);
  $('backBtn').addEventListener('click', () => location.reload());
});

// prevenir cierre accidental durante examen
window.addEventListener('beforeunload', function (e) {
  if (!document.querySelector('#exam').classList.contains('hidden')) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
  return undefined;
});
