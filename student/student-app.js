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

// ---------- generar código de resultado (11 dígitos) ----------
function generateResultCode() {
  // genera un número aleatorio de 11 dígitos como string, con ceros a la izquierda si hace falta
  return String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
}

// ---------- generar código de exportación (6 dígitos) ----------
function generateExportCode() {
  // genera un número aleatorio de 6 dígitos como string, con ceros a la izquierda si hace falta
  return String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
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

// ----------------- Retake cooldown helpers -----------------
const RETAKE_COOLDOWN_MINUTES = 60;

function getLastAttemptKey(testCode, deviceId) {
  return `lastAttempt::${testCode}::${deviceId}`;
}

function setLastAttemptTime(testCode, deviceId, whenIso) {
  try { localStorage.setItem(getLastAttemptKey(testCode, deviceId), whenIso || new Date().toISOString()); }
  catch(e){ console.warn(e); }
}

function getLastAttemptTime(testCode, deviceId) {
  try { const v = localStorage.getItem(getLastAttemptKey(testCode, deviceId)); return v ? new Date(v) : null; }
  catch(e){ return null; }
}

function minutesSince(date) { if (!date) return Infinity; return (Date.now() - date.getTime())/1000/60; }

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
  const rawCode = $('applyCode').value.trim();
  const override = rawCode.endsWith(':NEW!');
  const code = override ? rawCode.replace(/:NEW!$/, '') : rawCode;
  const grade = $('gradeSelect').value;

  // Elemento donde mostramos el mensaje de inicio
  const msgEl = $('startMsg');
  if (msgEl) {
    msgEl.textContent = '';
    msgEl.style.color = ''; // reset color
  }

  // básico: activar/desactivar botón según campos mínimos
  let canContinue = Boolean(name && grade && code);

  // Validaciones adicionales y mensajes visuales
  if (code && isStudentBlocked(name, code)) {
    // dispositivo bloqueado para esta prueba
    if (msgEl) {
      msgEl.textContent = 'Este dispositivo está bloqueado para esta prueba y no se puede iniciar.';
      msgEl.style.color = 'crimson';
    }
    canContinue = false;
  } else if (code) {
    // revisar cooldown de reintento (si existe lastAttempt)
    // nota: getLastAttemptTime espera el código limpio (sin :NEW!)
    const deviceId = getDeviceId();
    const last = getLastAttemptTime(code, deviceId);

    if (!override && last) {
      const mins = minutesSince(last);
      if (mins < RETAKE_COOLDOWN_MINUTES) {
        const remaining = Math.ceil(RETAKE_COOLDOWN_MINUTES - mins);
        if (msgEl) {
          msgEl.textContent = `No puedes volver a presentar esta prueba todavía. Espera ${remaining} minuto(s).`;
          msgEl.style.color = '#b45309'; // naranja/advertencia
        }
        canContinue = false;
      } else {
        // si ya pasó el tiempo, no mostrar nada
        if (msgEl) {
          msgEl.textContent = '';
          msgEl.style.color = '';
        }
      }
    } else if (override) {
      // mostrar indicador de override (opcional)
      if (msgEl) {
        msgEl.textContent = "Código con sufijo ':NEW!' detectado — se omitirá la espera de reintentos.";
        msgEl.style.color = 'green';
      }
    }
  }

  // Actualizar estado del botón
  $('btnContinue').disabled = !canContinue;
}

function canStartExam() {
  const name = $('studentName').value.trim();
  const rawCode = $('applyCode').value.trim();
  const override = rawCode.endsWith(':NEW!');
  const code = override ? rawCode.replace(/:NEW!$/, '') : rawCode;

  if (name.length <= 16) {
    alert('El nombre completo debe tener al menos 16 caracteres.');
    return false;
  }
  if (code.length <= 8) {
    alert('El código de aplicación debe tener al menos 8 caracteres.');
    return false;
  }
  if (isStudentBlocked(name, code)) {
    alert('No puedes iniciar la prueba: se detectó plagio desde este dispositivo. Este código está bloqueado.');
    return false;
  }

  // cooldown check
  const deviceId = getDeviceId();
  const last = getLastAttemptTime(code, deviceId);
  if (!override && last) {
    const mins = minutesSince(last);
    if (mins < RETAKE_COOLDOWN_MINUTES) {
      const remaining = Math.ceil(RETAKE_COOLDOWN_MINUTES - mins);
      alert(`No puedes volver a presentar esta prueba todavía. Debes esperar ${remaining} minuto(s).`);
      return false;
    }
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
  const rawCode = $('applyCode').value.trim();
  const override = rawCode.endsWith(':NEW!');
  const code = override ? rawCode.replace(/:NEW!$/, '') : rawCode;

  // buscar prueba por código limpio
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
    // MCQ (una correcta)
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

    // MULTI (varias correctas)
    if (q.type === 'multi' && Array.isArray(q.options)) {
      q.options = q.options.map((opt, i) => (typeof opt === 'string') ? { text: opt, _originalIndex: i } : { ...opt, _originalIndex: i });
      q.options = mezclarArray([...q.options]);
      if (Array.isArray(q.answer)) {
        // q.answer tiene índices originales -> buscar nuevas posiciones
        q.answer = q.answer.map(origIdx => q.options.findIndex(o => o._originalIndex === origIdx));
      }
    }

    // MATCH (mezclar las columnas de la derecha)
    if (q.type === 'match' && Array.isArray(q.pairs)) {
      q.pairs.forEach((p, pi) => {
        p.right = (p.right || []).map((r, ri) => (typeof r === 'string') ? { text: r, _originalIndex: ri } : { ...r, _originalIndex: ri });
        p.right = mezclarArray([...p.right]);
        // si q.answer es array de índices originales, guardamos índice actualizado en p._correctIndex (opcional)
        if (Array.isArray(q.answer) && typeof q.answer[pi] !== 'undefined') {
          const orig = q.answer[pi];
          p._correctIndex = p.right.findIndex(o => o._originalIndex === orig);
        }
      });
    }

    // --- Mezclar ITEMS de preguntas ORDERING y subquestions ordering de multimedia ---
    if (q.type === 'ordering' && Array.isArray(q.items) && q.items.length > 0) {
      // Guardar copia original si la quieres conservar (opcional)
      q._originalItems = Array.isArray(q._originalItems) ? q._originalItems : [...q.items];
      // Mezclar y asignar para la vista (así el alumno ve los items aleatorizados)
      q.items = mezclarArray([...q.items]);
      // Nota: q.answer debe seguir conteniendo el orden correcto (strings) tal como en tests.json
    }

    // Si es multimedia y la subpregunta es ordering, mezclar también subQ.items
    if (q.type === 'multimedia' && q.subtype === 'ordering' && q.subquestion && Array.isArray(q.subquestion.items)) {
      q.subquestion._originalItems = Array.isArray(q.subquestion._originalItems) ? q.subquestion._originalItems : [...q.subquestion.items];
      q.subquestion.items = mezclarArray([...q.subquestion.items]);
    }

    // GAPTEXT: normalizar q.answer (array) a objeto q.answers { "0": "texto" }
    if (q.type === 'gaptext') {
      if (!q.answers && Array.isArray(q.answer)) {
        q.answers = {};
        q.answer.forEach((a, i) => { q.answers[String(i)] = a; });
      }
    }

    // Si es multimedia con subquestion, hacer lo mismo para el subQ
    if (q.type === 'multimedia' && q.subquestion) {
      const subQ = q.subquestion;
      if (subQ.type === 'multi' && Array.isArray(subQ.options)) {
        subQ.options = subQ.options.map((opt, i) => (typeof opt === 'string') ? { text: opt, _originalIndex: i } : { ...opt, _originalIndex: i });
        subQ.options = mezclarArray([...subQ.options]);
        if (Array.isArray(subQ.answer)) {
          subQ.answer = subQ.answer.map(origIdx => subQ.options.findIndex(o => o._originalIndex === origIdx));
        }
      }
      if (subQ.type === 'match' && Array.isArray(subQ.pairs)) {
        subQ.pairs.forEach((p, pi) => {
          p.right = (p.right || []).map((r, ri) => (typeof r === 'string') ? { text: r, _originalIndex: ri } : { ...r, _originalIndex: ri });
          p.right = mezclarArray([...p.right]);
          if (Array.isArray(subQ.answer) && typeof subQ.answer[pi] !== 'undefined') {
            p._correctIndex = p.right.findIndex(o => o._originalIndex === subQ.answer[pi]);
          }
        });
      }
      if (subQ.type === 'gaptext') {
        if (!subQ.answers && Array.isArray(subQ.answer)) {
          subQ.answers = {};
          subQ.answer.forEach((a,i) => subQ.answers[String(i)] = a);
        }
      }
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

// ---------- utilidad - obtener respuesta ----------
function getOptionKey(opt) {
  return typeof opt === "string" ? opt : (opt.text || JSON.stringify(opt));
}

// ---------- utilidad - eventos de drag ----------
function addDragEvents(el) {
  el.addEventListener("dragstart", () => {
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => {
    el.classList.remove("dragging");
  });
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
        <input type="radio" name="q${currentQuestionIndex}" value="${getOptionKey(opt)}"
          ${answers[q.title] === getOptionKey(opt) ? 'checked' : ''}>
        ${escapeHtml(opt.text || opt)}
        ${opt.image ? `<div><img src="${opt.image}" alt="Opción ${i+1}" style="max-width:100px; margin-top:4px;" /></div>` : ''}
      </label>`).join('')}</div>`;

  } else if (q.type === 'tf') {
    // Verdadero / Falso
    inner += `<div class="options options-tf">
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
    inner += `<div class="options">${(q.options || []).map(opt => {
      const key = getOptionKey(opt);
      const checked = Array.isArray(answers[q.title]) && answers[q.title].includes(key);
      return `
        <label style="display:block; margin:6px 0;">
          <input type="checkbox" name="q${currentQuestionIndex}" value="${key}" ${checked ? 'checked' : ''}>
          ${escapeHtml(opt.text || opt)}
        </label>`;
    }).join('')}</div>`;

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
      const savedAns = (typeof answers[q.title] === "object" && answers[q.title] !== null)
        ? answers[q.title][i] 
        : ""; // si no hay nada guardado
      
      inner += `<div class="match-row">
        <span>${escapeHtml(p.left)}</span>
        <select id="match_${currentQuestionIndex}_${i}">
          <option value="">-- Selecciona --</option>
          ${p.right.map(r => `
            <option value="${escapeHtml((r && (r.text || r)) || '')}" ${savedAns === (r && (r.text || r)) ? 'selected' : ''}>
              ${escapeHtml((r && (r.text || r)) || '')}
            </option>`).join('')}
        </select>
      </div>`;
    });
    inner += `</div>`;

  } else if (q.type === 'gaptext') {
    // Helpers locales (si no tienes los globales, funcionan aquí)
    function createGapOptionElement(text) {
      const el = document.createElement('div');
      el.className = 'gap-opt';
      el.textContent = text;
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', el.textContent);
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      return el;
    }

    function addGapOptionIfMissing(container, text) {
      if (!container || !text) return;
      // evitar duplicados exactos por texto
      if ([...container.querySelectorAll('.gap-opt')].some(o => o.textContent === text)) return;
      container.appendChild(createGapOptionElement(text));
    }

    // Construir sentence con gaps — restaurando valores guardados y ocultando opciones usadas
    let sentence = q.sentence || q.title || "";

    // respuestas guardadas para esta pregunta (objeto con índices "0","1",...)
    const saved = (answers[q.title] && typeof answers[q.title] === 'object') ? answers[q.title] : {};

    // opciones ya usadas
    const used = Object.values(saved).filter(v => v !== undefined && v !== null);

    // determinar número de gaps: preferir q.gaps.length, sino q.options.length, sino marcadores en sentence
    let gapsCount = Array.isArray(q.gaps) ? q.gaps.length : (Array.isArray(q.options) ? q.options.length : 0);
    if (!gapsCount) {
      const matches = sentence.match(/\[\[\d+\]\]/g);
      gapsCount = matches ? matches.length : (sentence.includes("___") ? (sentence.split("___").length - 1) : 0);
    }

    // Reemplazar marcadores por span.gap (soporta [[0]] o ___)
    for (let idx = 0; idx < gapsCount; idx++) {
      const filled = saved && saved[idx] ? escapeHtml(saved[idx]) : "";
      const fillHtml = filled || "&nbsp;"; // &nbsp; visible y droppable
      const regex = new RegExp(`\\[\\[${idx}\\]\\]|___`);
      sentence = sentence.replace(regex, `<span class="gap" data-gap="${idx}">${fillHtml}</span>`);
    }

    // Generar lista de opciones excluyendo las ya usadas (si ya hay respuestas guardadas)
    const optionsHtml = (q.options || []).filter(opt => !used.includes(opt))
      .map(opt => `<div class="gap-opt" draggable="true">${escapeHtml(opt)}</div>`).join("");

    inner += `<div class="gap-sentence" style="text-align:center;">${sentence}</div>
              <div class="gap-options" id="gapOpts_${currentQuestionIndex}" style="text-align:center; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
                ${optionsHtml}
              </div>
              <div style="display:flex; justify-content:center; margin-top:18px;">
                <button id="resetGapBtn_${currentQuestionIndex}" class="btn">Reiniciar espacios</button>
              </div>`;

    // Inicializar drag & drop y listeners (con guardado consistente)
    setTimeout(() => {
      const gapOptions = document.getElementById(`gapOpts_${currentQuestionIndex}`);
      const gaps = container.querySelectorAll(".gap");
      if (!gapOptions) return;

      // Asegurar handlers en cada opción
      gapOptions.querySelectorAll('.gap-opt').forEach(opt => {
        opt.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', opt.textContent);
          opt.classList.add('dragging');
        });
        opt.addEventListener('dragend', () => opt.classList.remove('dragging'));
      });

      // permitir soltar en gaps
      gaps.forEach(gap => {
        gap.addEventListener('dragover', e => e.preventDefault());
        gap.addEventListener('drop', e => {
          e.preventDefault();
          const text = e.dataTransfer.getData('text/plain');
          if (!text) return;

          const gapIdx = String(gap.dataset.gap);

          // texto previo en el gap (si había uno) -> lo reinsertamos en la lista si hace falta
          const prevText = (gap.textContent || "").trim();
          if (prevText && prevText !== '\u00A0' && prevText !== text) {
            addGapOptionIfMissing(gapOptions, prevText);
            // borrar registro anterior
            if (answers[q.title] && answers[q.title][gapIdx] !== undefined) {
              delete answers[q.title][gapIdx];
            }
          }

          // poner el nuevo texto y guardar
          gap.innerHTML = escapeHtml(text);
          if (!answers[q.title] || typeof answers[q.title] !== 'object') answers[q.title] = {};
          answers[q.title][gapIdx] = text;

          // quitar opción usada de la lista (si existe)
          const existing = [...gapOptions.querySelectorAll('.gap-opt')].find(o => o.textContent === text);
          if (existing) existing.remove();

          saveExamProgress();
          updateNavButtonsAndFinishButton();
        });
      });

      // permitir devolver desde gap a la lista (drop sobre gapOptions)
      gapOptions.addEventListener("dragover", e => e.preventDefault());
      gapOptions.addEventListener("drop", e => {
        e.preventDefault();
        const text = e.dataTransfer.getData("text/plain");
        if (!text) return;

        // añadir opción si no existe ya
        addGapOptionIfMissing(gapOptions, text);

        // limpiar gaps que tengan ese texto (y borrar en answers)
        container.querySelectorAll('.gap').forEach(g => {
          if ((g.textContent || "").trim() === text) {
            const gi = String(g.dataset.gap);
            g.innerHTML = "&nbsp;";
            if (answers[q.title] && answers[q.title][gi] !== undefined) {
              delete answers[q.title][gi];
            }
          }
        });

        saveExamProgress();
        updateNavButtonsAndFinishButton();
      });

      // Reiniciar (botón)
      const resetBtn = document.getElementById(`resetGapBtn_${currentQuestionIndex}`);
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          const gaps = container.querySelectorAll(".gap");
          gaps.forEach(g => g.innerHTML = "&nbsp;");
          if (answers[q.title]) delete answers[q.title];
          // reconstruir opciones originales
          gapOptions.innerHTML = (q.options || []).map(opt => `<div class="gap-opt" draggable="true">${escapeHtml(opt)}</div>`).join("");
          // volver a enganchar eventos de drag a cada opción nueva
          gapOptions.querySelectorAll('.gap-opt').forEach(opt => {
            opt.addEventListener('dragstart', e => {
              e.dataTransfer.setData('text/plain', opt.textContent);
              opt.classList.add('dragging');
            });
            opt.addEventListener('dragend', () => opt.classList.remove('dragging'));
          });
          saveExamProgress();
          updateNavButtonsAndFinishButton();
        });
      }
    }, 50);

  } else if (q.type === 'hotspot') {
    // Imagen interactiva (clic en zonas)
    inner += `<div class="hotspot-container">
      <img src="${q.image}" alt="Imagen interactiva" class="hotspot-img" />
    </div>
    <p class="small hotspot-note">Haz clic en la zona correspondiente.</p>`;

  } else if (q.type === 'ordering') {
    // Ordenar secuencia (drag & drop)
    inner += `<ul class="ordering" id="order_${currentQuestionIndex}">
      ${(answers[q.title] || q.items || []).map((item, i) => `
        <li class="order-item" draggable="true" data-idx="${i}">${escapeHtml(item)}</li>
      `).join('')}
    </ul>
    <p class="small">Arrastra los elementos para ponerlos en el orden correcto.</p>
    <p class="small"><strong>NOTA:</strong>&nbsp;<em>Este tipo de pregunta se reordena en cada sesión.</em></p>`;

  } else if (q.type === 'multimedia') {
    // Contenedor del recurso multimedia
    inner += `<div class="multimedia-container">`;
    
    if (q.mediaType === "video") {
      inner += `<video controls style="max-width:100%; border-radius:10px;">
                  <source src="${q.src}" type="video/mp4">
                  Tu navegador no soporta video.
                </video>`;
    } else if (q.mediaType === "audio") {
      inner += `<audio controls>
                  <source src="${q.src}" type="audio/mpeg">
                  Tu navegador no soporta audio.
                </audio>`;
    } else if (q.mediaType === "image") {
      inner += `<img src="${q.src}" alt="Multimedia" class="multimedia-img" />`;
    }
  
    inner += `</div>`;
    
    // Render de la subpregunta anidada (usa q.subtype y q.subquestion)
    const subQ = q.subquestion || {};
    const subType = q.subtype;
    
    inner += `<div class="subquestion">`;
    inner += `<h4 style="margin-top:8px;">${escapeHtml(subQ.title || "Pregunta")}</h4>`;
    
    if (subType === 'open') {
      inner += `<textarea id="multi_open_${currentQuestionIndex}" rows="5" style="width:100%" 
        placeholder="Escribe tu respuesta aquí...">${answers[q.title]?.open || ''}</textarea>`;
    
    } else if (subType === 'short') {
      inner += `<input type="text" id="multi_short_${currentQuestionIndex}" 
        style="width:100%; padding:8px;" 
        placeholder="Respuesta breve..." value="${answers[q.title]?.short || ''}" />`;
    
    } else if (subType === 'mcq') {
      inner += `<div class="options">${(subQ.options || []).map(opt => {
        const key = getOptionKey(opt);
        const checked = answers[q.title]?.mcq === key;
        return `
          <label style="display:block; margin:6px 0;">
            <input type="radio" name="multi_q${currentQuestionIndex}" value="${key}" ${checked ? 'checked' : ''}>
            ${escapeHtml(opt.text || opt)}
          </label>`;
      }).join('')}</div>`;

    } else if (subType === 'multi') {
      inner += `<div class="options">${(subQ.options || []).map(opt => {
        const key = getOptionKey(opt);
        const checked = Array.isArray(answers[q.title]?.multi) && answers[q.title].multi.includes(key);
        return `
          <label style="display:block; margin:6px 0;">
            <input type="checkbox" name="multi_q${currentQuestionIndex}" value="${key}" ${checked ? 'checked' : ''}>
            ${escapeHtml(opt.text || opt)}
          </label>`;
      }).join('')}</div>`;
    
    } else if (subType === 'tf') {
      inner += `<div class="options options-tf">
        <label><input type="radio" name="multi_q${currentQuestionIndex}" value="1" ${answers[q.title]?.tf==1?'checked':''}> Verdadero</label>
        <label><input type="radio" name="multi_q${currentQuestionIndex}" value="0" ${answers[q.title]?.tf==0?'checked':''}> Falso</label>
      </div>`;
    
    } else if (subType === 'match') {
      inner += `<div class="match-container">`;
      (subQ.pairs || []).forEach((p, i) => {
        const ans = answers[q.title]?.match?.[i] || "";
        inner += `<div class="match-row">
          <span>${escapeHtml(p.left)}</span>
          <select id="multi_match_${currentQuestionIndex}_${i}">
            <option value="">-- Selecciona --</option>
            ${p.right.map(r => `
              <option value="${escapeHtml((r && (r.text || r)) || '')}" ${savedAns === (r && (r.text || r)) ? 'selected' : ''}>
                ${escapeHtml((r && (r.text || r)) || '')}
              </option>`).join('')}
          </select>
        </div>`;
      });
      inner += `</div>`;
    
    } else if (subType === 'ordering') {
      const items = answers[q.title]?.ordering || subQ.items || [];
      inner += `<ul class="ordering" id="multi_order_${currentQuestionIndex}">
        ${items.map((item, i) => `
          <li class="order-item" draggable="true" data-idx="${i}">${escapeHtml(item)}</li>
        `).join('')}
      </ul>
      <p class="small">Arrastra los elementos para ponerlos en el orden correcto.</p>
      <p class="small"><strong>NOTA:</strong>&nbsp;<em>Este tipo de pregunta se reordena en cada sesión.</em></p>`;
    
      // listeners drag & drop
      setTimeout(() => {
        const list = document.getElementById(`multi_order_${currentQuestionIndex}`);
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
    
                // Asegurar que sea objeto antes de guardar
                if (typeof answers[q.title] !== "object" || answers[q.title] === null) {
                  answers[q.title] = {};
                }
    
                answers[q.title] = [...list.querySelectorAll('.order-item')].map(li => li.textContent);
                updateNavButtonsAndFinishButton();
              }
            });
          });
        }
      }, 50);
    } else if (subType === 'hotspot') {
      inner += `<div class="hotspot-container">
        <img src="${subQ.image}" alt="Hotspot multimedia" class="hotspot-img" />
      </div>
      <p class="small hotspot-note">Haz clic en la zona correspondiente.</p>`;
    
    } else if (q.type === 'multimedia' && q.subtype === 'gaptext') {
      // Subquestion (compatibilidad con diferentes formatos de tests.json)
      const sub = q.subquestion || q.sub || {};
      // si la subquestion no tiene sentence, usar q.title/ q.sentence como fallback
      let sentence = sub.sentence || sub.title || q.sentence || q.title || "";

      // Helpers locales (nombres únicos para evitar colisiones con el otro bloque)
      const createGapOptionElementMulti = (function () {
        // si ya existe una función global con el mismo propósito, reutilizarla
        if (typeof createGapOptionElement === 'function') return createGapOptionElement;
        return function (text) {
          const el = document.createElement('div');
          el.className = 'gap-opt';
          el.textContent = text;
          el.setAttribute('draggable', 'true');
          el.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', el.textContent);
            el.classList.add('dragging');
          });
          el.addEventListener('dragend', () => el.classList.remove('dragging'));
          return el;
        };
      })();

      const addGapOptionIfMissingMulti = function (container, text) {
        if (!container || !text) return;
        if ([...container.querySelectorAll('.gap-opt')].some(o => o.textContent === text)) return;
        container.appendChild(createGapOptionElementMulti(text));
      };

      // respuestas guardadas para esta pregunta (objeto con índices "0","1",...)
      const saved = (answers[q.title] && typeof answers[q.title] === 'object') ? answers[q.title] : {};

      // opciones ya usadas (valores guardados)
      const used = Object.values(saved).filter(v => v !== undefined && v !== null);

      // Obtener opciones desde la subquestion (o desde q si no existe)
      const optionsList = Array.isArray(sub.options) ? sub.options : (Array.isArray(sub.choices) ? sub.choices : (Array.isArray(q.options) ? q.options : []));

      // Determinar número de gaps (primero sub.gaps, luego markers)
      let gapsCount = Array.isArray(sub.gaps) ? sub.gaps.length : (Array.isArray(sub.options) ? sub.options.length : 0);
      if (!gapsCount) {
        const matches = sentence.match(/\[\[\d+\]\]/g);
        gapsCount = matches ? matches.length : (sentence.includes("___") ? (sentence.split("___").length - 1) : 0);
      }

      // Reemplazar marcadores por span.gap con data-gap
      for (let idx = 0; idx < gapsCount; idx++) {
        const filled = saved && saved[idx] ? escapeHtml(saved[idx]) : "";
        const fillHtml = filled || "&nbsp;";
        const regex = new RegExp(`\\[\\[${idx}\\]\\]|___`);
        sentence = sentence.replace(regex, `<span class="gap" data-gap="${idx}">${fillHtml}</span>`);
      }

      // Media (si existe) — si tienes HTML embebido en q.mediaHtml u otra propiedad
      const mediaHtml = q.mediaHtml || q.media || "";

      // Construir HTML (añade un contenedor especial para multimedia)
      inner += `<div class="multimedia-gaptext">
                  <div class="multimedia-media">${mediaHtml}</div>
                  <div class="gap-sentence" style="text-align:center; margin-top:10px;">${sentence}</div>
                  <div class="gap-options" id="gapOpts_multi_${currentQuestionIndex}" style="text-align:center; display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
                    ${(optionsList || []).filter(opt => !used.includes(opt)).map(opt => `<div class="gap-opt" draggable="true">${escapeHtml(opt)}</div>`).join('')}
                  </div>
                  <div style="display:flex; justify-content:center; margin-top:12px;">
                    <button id="resetGapBtn_multi_${currentQuestionIndex}" class="btn">Reiniciar espacios</button>
                  </div>
                </div>`;

      // Inicializar drag & drop y listeners
      setTimeout(() => {
        const gapOptions = document.getElementById(`gapOpts_multi_${currentQuestionIndex}`);
        const gaps = container.querySelectorAll(".gap");
        if (!gapOptions) return;

        // Asegurar events en cada opción inicial
        gapOptions.querySelectorAll('.gap-opt').forEach(opt => {
          opt.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', opt.textContent);
            opt.classList.add('dragging');
          });
          opt.addEventListener('dragend', () => opt.classList.remove('dragging'));
        });

        // permitir soltar en gaps
        gaps.forEach(gap => {
          gap.addEventListener('dragover', e => e.preventDefault());
          gap.addEventListener('drop', e => {
            e.preventDefault();
            const text = e.dataTransfer.getData('text/plain');
            if (!text) return;

            const gapIdx = String(gap.dataset.gap);

            // texto previo en el gap (si había uno) -> lo reinsertamos en la lista si hace falta
            const prevText = (gap.textContent || "").trim();
            if (prevText && prevText !== '\u00A0' && prevText !== text) {
              addGapOptionIfMissingMulti(gapOptions, prevText);
              if (answers[q.title] && answers[q.title][gapIdx] !== undefined) {
                delete answers[q.title][gapIdx];
              }
            }

            // poner el nuevo texto y guardar
            gap.innerHTML = escapeHtml(text);
            if (!answers[q.title] || typeof answers[q.title] !== 'object') answers[q.title] = {};
            answers[q.title][gapIdx] = text;

            // quitar opción usada de la lista (si existe)
            const existing = [...gapOptions.querySelectorAll('.gap-opt')].find(o => o.textContent === text);
            if (existing) existing.remove();

            saveExamProgress();
            updateNavButtonsAndFinishButton();
          });
        });

        // permitir devolver desde gap a la lista (drop sobre gapOptions)
        gapOptions.addEventListener("dragover", e => e.preventDefault());
        gapOptions.addEventListener("drop", e => {
          e.preventDefault();
          const text = e.dataTransfer.getData("text/plain");
          if (!text) return;

          // añadir opción si no existe ya
          addGapOptionIfMissingMulti(gapOptions, text);

          // limpiar gaps que tengan ese texto (y borrar en answers)
          container.querySelectorAll('.gap').forEach(g => {
            if ((g.textContent || "").trim() === text) {
              const gi = String(g.dataset.gap);
              g.innerHTML = "&nbsp;";
              if (answers[q.title] && answers[q.title][gi] !== undefined) {
                delete answers[q.title][gi];
              }
            }
          });

          saveExamProgress();
          updateNavButtonsAndFinishButton();
        });

        // Reiniciar (botón)
        const resetBtn = document.getElementById(`resetGapBtn_multi_${currentQuestionIndex}`);
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            const gaps = container.querySelectorAll(".gap");
            gaps.forEach(g => g.innerHTML = "&nbsp;");
            if (answers[q.title]) delete answers[q.title];
            // reconstruir opciones originales
            gapOptions.innerHTML = (optionsList || []).map(opt => `<div class="gap-opt" draggable="true">${escapeHtml(opt)}</div>`).join("");
            // volver a enganchar eventos de drag a cada opción nueva
            gapOptions.querySelectorAll('.gap-opt').forEach(opt => {
              opt.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', opt.textContent);
                opt.classList.add('dragging');
              });
              opt.addEventListener('dragend', () => opt.classList.remove('dragging'));
            });
            saveExamProgress();
            updateNavButtonsAndFinishButton();
          });
        }
      }, 50);
    }
    
    inner += `</div>`; // cierre subquestion
  
  } else {
    inner += `<div class="small">Tipo de pregunta desconocido.</div>`;
  }

  container.innerHTML = inner;

  // ---------- LISTENERS PARA RESPUESTAS ----------
  // Radios (mcq, tf, likert)
  container.querySelectorAll(`input[type=radio][name="q${currentQuestionIndex}"]`).forEach(inp => {
    inp.addEventListener('change', () => {
      // si es TF guardamos Number para comparar con q.answer numérico
      if (q.type === 'tf') {
        answers[q.title] = Number(inp.value);
      } else {
        answers[q.title] = inp.value;
      }
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
        .map(c => c.value);
      updateNavButtonsAndFinishButton();
    });
  });

  // Match
  (q.pairs || []).forEach((p,i) => {
    const sel = container.querySelector(`#match_${currentQuestionIndex}_${i}`);
    if (sel) {
      sel.addEventListener('change', () => {
        if (typeof answers[q.title] !== "object" || answers[q.title] === null) {
          answers[q.title] = {};
        }
        answers[q.title][i] = sel.value;
        updateNavButtonsAndFinishButton();
      });
    }
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
      if (container) {
        const existing = [...container.querySelectorAll('.gap-opt')].find(o => o.textContent === text);
        if (existing) existing.remove();
      }

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
    
    // Mostrar coordenadas previas si existen
    if (answers[q.title]?.x && answers[q.title]?.y) {
      const smallTxt = container.querySelector(".hotspot-note");
      if (smallTxt) {
        smallTxt.textContent = `Coordenadas seleccionadas: (${answers[q.title].x}, ${answers[q.title].y})`;
      }
    }
    
    img.addEventListener('click', e => {
      const rect = e.target.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width).toFixed(2);
      const y = ((e.clientY - rect.top) / rect.height).toFixed(2);
      answers[q.title] = { x, y };
    
      // mostrar coords en el texto pequeño
      const smallTxt = container.querySelector(".hotspot-note");
      if (smallTxt) {
        smallTxt.textContent = `Coordenadas seleccionadas: (${x}, ${y})`;
      }
    
      updateNavButtonsAndFinishButton();
    });
  }

  // ----- LISTENERS MULTIMEDIA -----
  if (q.type === 'multimedia') {
    const subQ = q.subquestion || {}; 
    const subType = q.subtype;
  
    if (subType === 'open') {
      const ta = container.querySelector(`#multi_open_${currentQuestionIndex}`);
      if (ta) ta.addEventListener('input', () => {
        if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
          answers[q.title] = {}; 
        }
        answers[q.title].open = ta.value;
        updateNavButtonsAndFinishButton();
      });
    }
  
    if (subType === 'short') {
      const si = container.querySelector(`#multi_short_${currentQuestionIndex}`);
      if (si) si.addEventListener('input', () => {
        if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
          answers[q.title] = {}; 
        }
        answers[q.title].short = si.value.trim();
        updateNavButtonsAndFinishButton();
      });
    }
  
    if (subType === 'mcq') {
      container.querySelectorAll(`input[name=multi_q${currentQuestionIndex}]`).forEach(inp => {
        inp.addEventListener('change', () => {
          if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
            answers[q.title] = {}; 
          }
          answers[q.title].mcq = inp.value;
          updateNavButtonsAndFinishButton();
        });
      });
    }
  
    if (subType === 'multi') {
      container.querySelectorAll(`input[name=multi_q${currentQuestionIndex}]`).forEach(chk => {
        chk.addEventListener('change', () => {
          if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
            answers[q.title] = {}; 
          }
          answers[q.title].multi = Array.from(container.querySelectorAll(`input[name=multi_q${currentQuestionIndex}]:checked`))
            .map(c => c.value);
          updateNavButtonsAndFinishButton();
        });
      });
    }
  
    if (subType === 'tf') {
      container.querySelectorAll(`input[name=multi_q${currentQuestionIndex}]`).forEach(inp => {
        inp.addEventListener('change', () => {
          if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
            answers[q.title] = {}; 
          }
          answers[q.title].tf = Number(inp.value);
          updateNavButtonsAndFinishButton();
        });
      });
    }
  
    if (subType === 'match') {
      (subQ.pairs || []).forEach((p,i) => {
        const sel = container.querySelector(`#multi_match_${currentQuestionIndex}_${i}`);
        if (sel) sel.addEventListener('change', () => {
          // Asegurar que siempre sea objeto
          if (typeof answers[q.title] !== "object" || answers[q.title] === null) {
            answers[q.title] = {};
          }
      
          if (!answers[q.title].match) {
            answers[q.title].match = {};
          }
      
          answers[q.title].match[i] = sel.value;
          updateNavButtonsAndFinishButton();
        });
      });
    }
  
    if (subType === 'ordering') {
      const list = container.querySelector(`#multi_order_${currentQuestionIndex}`);
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
              if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
                answers[q.title] = {}; 
              }
              answers[q.title] = [...list.querySelectorAll('.order-item')].map(li => li.textContent);
              updateNavButtonsAndFinishButton();
            }
          });
        });
      }
    }
  
    if (subType === 'hotspot') {
      const img = container.querySelector('.hotspot-img');
      if (img) {
        // Mostrar coordenadas previas si existen
        if (answers[q.title]?.hotspot?.x && answers[q.title]?.hotspot?.y) {
          const smallTxt = container.querySelector(".hotspot-note");
          if (smallTxt) {
            smallTxt.textContent = `Coordenadas seleccionadas: (${answers[q.title].hotspot.x}, ${answers[q.title].hotspot.y})`;
          }
        }
        
        img.addEventListener('click', e => {
          const rect = e.target.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width).toFixed(2);
          const y = ((e.clientY - rect.top) / rect.height).toFixed(2);
          if (typeof answers[q.title] !== "object" || answers[q.title] === null) {   
            answers[q.title] = {}; 
          }
          answers[q.title].hotspot = { x, y };
          
          const smallTxt = container.querySelector(".hotspot-note");
          if (smallTxt) {
            smallTxt.textContent = `Coordenadas seleccionadas: (${x}, ${y})`;
          }
          updateNavButtonsAndFinishButton();
        });
      }
    }
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
    if (
      (typeof a === "string" && a.trim() !== "") ||
      (typeof a === "number") ||
      (Array.isArray(a) && a.length > 0) ||
      (typeof a === "object" && a !== null && Object.keys(a).length > 0)
    ) {
      answeredCount++;
    }
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
  // normalize multimedia delegation
  if (!q) return '';
  if (q.type === 'multimedia' && q.subquestion) {
    const subQ = q.subquestion;
    const subAns = (answers && answers[q.title]) || {};
    if (q.subtype === 'gaptext' || subQ.type === 'gaptext') {
      return formatAnswer({...subQ, type:'gaptext'}, subAns);
    }
    // delegar resto de subtipos a same function by pretending it's subQ
    return formatAnswer({...subQ, type: q.subtype || subQ.type}, subAns[q.subtype] || subAns);
  }

  // manejo ordering + multimedia subtype ordering
  if (q.type === 'ordering' || (q.type === 'multimedia' && q.subtype === 'ordering')) {
    // ans puede venir en muchas formas; priorizamos arrays directos, luego .ordering, luego subestructuras
    let arr = [];

    if (Array.isArray(ans)) {
      arr = ans;
    } else if (ans && Array.isArray(ans.ordering)) {
      arr = ans.ordering;
    } else if (ans && Array.isArray(ans.subanswer)) {
      arr = ans.subanswer;
    } else if (ans && typeof ans === 'object') {
      // casos posibles por compatibilidad: { ordering: [...] }, { sub: [...] }, etc.
      const keys = ['ordering','sub','subOrdering','subanswer','answers'];
      for (const k of keys) {
        if (Array.isArray(ans[k])) { arr = ans[k]; break; }
      }
    }

    // Si es multimedia y no encontramos respuesta, puede que la respuesta esté puesta bajo answers[q.title] directamente
    if ((!arr || arr.length === 0) && q.type === 'multimedia' && q.subquestion) {
      const maybe = q.subquestion.items || q.subquestion.answer || q.subquestion.correct;
      // no asumimos que esto sea la respuesta del alumno, pero lo intentamos mostrar si es array
      if (Array.isArray(maybe)) arr = maybe;
    }

    return escapeHtml(Array.isArray(arr) ? arr.join(' , ') : String(arr || ''));
  }

  // GAPTEXT: construir la oración y reemplazar marcadores por <strong>...escaped...</strong>
  if (q.type === 'gaptext') {
    let sentence = q.sentence || q.title || "";
    const gapsCount = Array.isArray(q.gaps) ? q.gaps.length : (Array.isArray(q.options) ? q.options.length : 0);
    // ans esperado: objeto { "0": "25", "1": "15" } o similar
    for (let i = 0; i < gapsCount; i++) {
      const studentText = (ans && (ans[i] !== undefined && ans[i] !== null)) ? String(ans[i]) : "";
      const replacement = studentText
        ? `<strong>${escapeHtml(studentText)}</strong>`
        : `<span class="gap-blank">&nbsp;</span>`; // visible placeholder
      // replace either [[i]] or first occurrence of ___ (supports both formats)
      const regex = new RegExp(`\\[\\[${i}\\]\\]|___`);
      sentence = sentence.replace(regex, replacement);
    }
    return sentence; // ya contiene HTML (con contenido escapeado)
  }

  // Default: devolver texto escapeado (sin HTML)
  if (q.type === 'mcq') {
    if (ans === undefined || ans === null || ans === "") return escapeHtml("Sin responder");
    if (Array.isArray(q.options)) {
      if (typeof ans === 'number' || (/^\d+$/.test(String(ans)))) {
        const idx = Number(ans);
        if (q.options[idx]) return escapeHtml(q.options[idx].text || q.options[idx]);
      }
      const found = q.options.find(opt => {
        const txt = (opt && (opt.text || opt)) || String(opt);
        return txt === String(ans) || getOptionKey(opt) === String(ans);
      });
      if (found) return escapeHtml(found.text || found);
    }
    return escapeHtml(String(ans));
  }

  if (q.type === 'multi') {
    if (!Array.isArray(ans)) return escapeHtml(String(ans || ''));
    if (!Array.isArray(q.options)) return escapeHtml(ans.join(", "));
    return escapeHtml(ans.map(a => {
      if (typeof a === 'number' || (/^\d+$/.test(String(a)))) {
        const i = Number(a);
        return q.options[i] ? (q.options[i].text || q.options[i]) : String(a);
      } else {
        const found = q.options.find(opt => {
          const txt = (opt && (opt.text || opt)) || String(opt);
          return txt === String(a) || getOptionKey(opt) === String(a);
        });
        return found ? (found.text || found) : String(a);
      }
    }).join(", "));
  }

  if (q.type === 'match') {
    // ans puede ser: string, array, u objeto { index: selectedValue }
    if (ans === undefined || ans === null || ans === '') return escapeHtml('Sin responder');
  
    // Si el alumno ya vino como string (p. ej. desde JSON exportado), mostrarlo directo
    if (typeof ans === 'string') return escapeHtml(ans);
  
    // Si es array, concatenar
    if (Array.isArray(ans)) return escapeHtml(ans.join(' ; '));
  
    // Si es objeto (caso normal cuando usamos selects por fila), convertir a "izquierda → seleccion"
    const pairs = q.pairs || [];
    const parts = (pairs || []).map((p, i) => {
      const sel = (ans && (ans[i] !== undefined && ans[i] !== null)) ? String(ans[i]) : '';
      return `${p.left} → ${sel}`;
    });
    return escapeHtml(parts.join(' ; '));
  }

  // tf, open, short, numeric, match, etc. — devolver escapeado
  if (q.type === 'tf') {
    // mostrar la respuesta del alumno (ans). Si no respondió, mostrar "Sin responder".
    if (ans === undefined || ans === null || ans === '') return escapeHtml('Sin responder');
    return escapeHtml(Number(ans) === 1 ? 'Verdadero' : 'Falso');
  }

  if (q.type === 'open' || q.type === 'short') return escapeHtml(String(ans || ''));
  if (q.type === 'numeric') return escapeHtml(String(ans || ''));
  if (q.type === 'hotspot') return escapeHtml(ans ? JSON.stringify(ans) : '');
  // fallback
  return escapeHtml(String(ans || ''));
}

// ---------- formatear respuesta correcta ----------
function formatCorrectAnswer(q) {
  if (!q) return '';

  // multimedia subquestions
  if (q.type === 'multimedia' && q.subquestion) {
    const subQ = q.subquestion;
    if (q.subtype === 'gaptext' || subQ.type === 'gaptext') {
      return formatCorrectAnswer({...subQ, type:'gaptext'});
    }
    return formatCorrectAnswer({...subQ, type: q.subtype || subQ.type});
  }

  // ordering + multimedia subtype ordering
  if (q.type === 'ordering' || (q.type === 'multimedia' && q.subtype === 'ordering')) {
    // La respuesta correcta suele estar en q.answer (array) para ordering,
    // o en q.subquestion.answer para multimedia/subtype ordering.
    let correctArr = [];

    if (Array.isArray(q.answer)) {
      correctArr = q.answer;
    } else if (q.type === 'multimedia' && q.subquestion && Array.isArray(q.subquestion.answer)) {
      correctArr = q.subquestion.answer;
    } else if (Array.isArray(q.correct)) {
      correctArr = q.correct;
    } else if (q.subquestion && Array.isArray(q.subquestion.correct)) {
      correctArr = q.subquestion.correct;
    }

    return escapeHtml(Array.isArray(correctArr) ? correctArr.join(' , ') : String(correctArr || ''));
  }

  if (q.type === 'gaptext') {
    let sentence = q.sentence || q.title || "";
    // preferir q.answers (obj index->texto) o q.correct (array) o q.gaps length
    const correctObj = (q.answers && typeof q.answers === 'object') ? q.answers : null;
    const gapsCount = correctObj 
      ? Object.keys(correctObj).length
      : (Array.isArray(q.gaps) ? q.gaps.length : (Array.isArray(q.correct) ? q.correct.length : (Array.isArray(q.options) ? q.options.length : 0)));

    for (let i = 0; i < gapsCount; i++) {
      const correctText = correctObj ? String(correctObj[i] || '') : (Array.isArray(q.correct) ? String(q.correct[i] || '') : '');
      const replacement = correctText
        ? `<strong>${escapeHtml(correctText)}</strong>`
        : `<span class="gap-blank">&nbsp;</span>`;
      const regex = new RegExp(`\\[\\[${i}\\]\\]|___`);
      sentence = sentence.replace(regex, replacement);
    }
    return sentence;
  }

  // resto de tipos (escapados)
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options)) return escapeHtml(String(q.answer ?? ''));
    const correctKey = normalizeOptionKeyFromQuestion(q, q.answer);
    const found = q.options.find(opt => getOptionKey(opt) === correctKey || (opt.text || opt) === correctKey);
    return escapeHtml(found ? (found.text || found) : String(q.answer ?? ''));
  }

  if (q.type === 'multi') {
    if (!Array.isArray(q.answer)) return escapeHtml(String(q.answer ?? ''));
    if (!Array.isArray(q.options)) return escapeHtml(q.answer.join(", "));
    const keys = normalizeKeysArray(q, q.answer);
    return escapeHtml(keys.map(k => {
      const found = q.options.find(opt => getOptionKey(opt) === k || (opt.text || opt) === k);
      return found ? (found.text || found) : k;
    }).join(", "));
  }

  if (q.type === 'tf') return escapeHtml((parseInt(q.answer)===1) ? 'Verdadero' : 'Falso');
  if (q.type === 'open' || q.type === 'short') return escapeHtml(String(q.answer ?? ''));
  if (q.type === 'numeric') return escapeHtml(String(q.answer ?? ''));
  if (q.type === 'match') {
    return escapeHtml((q.pairs || []).map(p => `${p.left} → ${p.correct ?? (p.right ? p.right[0] : '')}`).join(' ; '));
  }

  return escapeHtml(String(q.answer ?? ''));
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

  fetch("https://script.google.com/macros/s/AKfycbywKsvHZ3t7CUfmo1hPMDXwbYwfuTPdHkjI_Rsqzv5z8ag32_5DK8rMpP23oLlsKV-c/exec", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(r => r.text())
  .then(res => console.log("Correo enviado:", res))
  .catch(err => console.error("Error enviando correo:", err));
}

// ---------- utilidades para comparar opciones (soportan índices y claves/texto) ----------
function normalizeOptionKeyFromQuestion(q, indexOrValue) {
  if (indexOrValue === undefined || indexOrValue === null) return undefined;
  // si no hay opciones, devolvemos como string
  if (!q || !Array.isArray(q.options)) return String(indexOrValue);

  // si es número (o string numérico) -> tomar la opción por índice
  if (typeof indexOrValue === 'number' || (/^\d+$/.test(String(indexOrValue)))) {
    const i = Number(indexOrValue);
    if (q.options[i]) return getOptionKey(q.options[i]);
    return String(indexOrValue);
  }

  // si es texto -> intentar emparejar con texto de alguna opción
  const s = String(indexOrValue);
  const found = q.options.find(opt => {
    const txt = (opt && (opt.text || opt)) || String(opt);
    return txt === s || getOptionKey(opt) === s;
  });
  if (found) return getOptionKey(found);

  return s;
}

function normalizeKeysArray(q, arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(a => normalizeOptionKeyFromQuestion(q, a)).filter(x => x !== undefined);
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
      // comparar por clave normalizada (soporta índices o texto guardado)
      const correctKey = normalizeOptionKeyFromQuestion(q, q.answer);
      const studentKey = normalizeOptionKeyFromQuestion(q, studentAns);

      if (studentKey !== undefined && studentKey === correctKey) {
        qPoints = possiblePoints;
      } else if (studentKey !== undefined) {
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
      // normalizar ambas listas como claves (soporta índices o textos)
      const correctKeys = normalizeKeysArray(q, q.answer).sort().join(',');
      const givenKeys = normalizeKeysArray(q, studentAns).sort().join(',');
      qPoints = (correctKeys && correctKeys === givenKeys) ? possiblePoints : 0;

    } else if (q.type === 'likert') {
      qPoints = possiblePoints; // no hay correcto/incorrecto

    } else if (q.type === 'numeric') {
      qPoints = (parseFloat(studentAns) === parseFloat(q.answer)) ? possiblePoints : 0;

    } else if (q.type === 'match') {
      let matches = 0;
      (q.pairs || []).forEach((p,i) => {
        const studentSel = (studentAns && studentAns[i] !== undefined) ? String(studentAns[i]) : null;
        // obtener valor correcto (string) de forma robusta
        let correctVal = null;
        if (p.correct !== undefined) {
          correctVal = String(p.correct);
        } else if (typeof p._correctIndex === 'number' && p.right && p.right[p._correctIndex]) {
          correctVal = String(p.right[p._correctIndex].text || p.right[p._correctIndex]);
        } else if (Array.isArray(q.answer) && typeof q.answer[i] !== 'undefined') {
          const maybe = p.right && p.right[q.answer[i]];
          correctVal = maybe ? String(maybe.text || maybe) : null;
        }
        if (studentSel !== null && correctVal !== null && normalizeText(studentSel) === normalizeText(correctVal)) {
          matches++;
        }
      });
      qPoints = (matches / (q.pairs?.length || 1)) * possiblePoints;
    
    } else if (q.type === 'ordering') {
      // normalizar respuesta correcta y respuesta del alumno como arrays de strings
      const correctArr = Array.isArray(q.answer) ? q.answer : (Array.isArray(q.correct) ? q.correct : []);
      let givenArr = [];
      if (Array.isArray(studentAns)) {
        givenArr = studentAns;
      } else if (studentAns && Array.isArray(studentAns.ordering)) {
        // por compatibilidad antigua
        givenArr = studentAns.ordering;
      } else if (studentAns && Array.isArray(studentAns)) {
        givenArr = studentAns;
      }

      // comparar como strings (unión con separador determinístico)
      const correctKey = correctArr.join('||'); // separador improbable
      const givenKey = givenArr.join('||');
      qPoints = (correctKey && correctKey === givenKey) ? possiblePoints : 0;

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
        const { x1, y1, x2, y2 } = q.correctArea;
        const tol = 0.05; // margen de tolerancia

        if (x >= (x1 - tol) && x <= (x2 + tol) &&
            y >= (y1 - tol) && y <= (y2 + tol)) {
          qPoints = possiblePoints;
        }
      }

    } else if (q.type === 'multimedia') {
      // subpregunta dentro de multimedia (usar la misma lógica pero con subQ)
      const subQ = q.subquestion || {};
      const subtype = q.subtype;
      const studentSub = answers[q.title] || {};
      const studentAnsSub = studentSub[subtype];

      if (subtype === 'mcq') {
        const correctKey = normalizeOptionKeyFromQuestion(subQ, subQ.answer);
        const studentKey = normalizeOptionKeyFromQuestion(subQ, studentAnsSub);
        if (studentKey !== undefined && studentKey === correctKey) {
          qPoints = possiblePoints;
        } else if (studentKey !== undefined) {
          qPoints = (currentTest.points && currentTest.points.bad) ? -Math.abs(Number(currentTest.points.bad)) : 0;
        }
      } else if (subtype === 'tf') {
        if (studentAnsSub !== undefined && parseInt(studentAnsSub) === parseInt(subQ.answer)) {
          qPoints = possiblePoints;
        } else if (studentAnsSub !== undefined) {
          qPoints = (currentTest.points && currentTest.points.bad) ? -Math.abs(Number(currentTest.points.bad)) : 0;
        }
      } else if (subtype === 'open' || subtype === 'short') {
        const evalData = evaluateOpenAnswer(String(studentAnsSub || ''), subQ, currentTest);
        qPoints = Math.round((possiblePoints * evalData.scoreRatio) * 1000) / 1000;
      } else if (subtype === 'multi') {
        const correctKeys = normalizeKeysArray(subQ, subQ.answer).sort().join(',');
        const givenKeys = normalizeKeysArray(subQ, studentAnsSub).sort().join(',');
        qPoints = (correctKeys && correctKeys === givenKeys) ? possiblePoints : 0;
      } else if (subtype === 'match') {
        let matches = 0;
        (subQ.pairs || []).forEach((p,i) => {
          if (studentAnsSub && studentAnsSub[i] === p.correct) matches++;
        });
        qPoints = (matches / (subQ.pairs?.length || 1)) * possiblePoints;
      } else if (subtype === 'ordering') {
        const correct = (subQ.correct || []).join(',');
        const given = (studentAnsSub || []).join(',');
        qPoints = (correct === given) ? possiblePoints : 0;
      } else if (subtype === 'hotspot') {
        if (studentAnsSub && subQ.correctArea) {
          const { x, y } = studentAnsSub;
          const { x1, y1, x2, y2 } = subQ.correctArea;
          const tol = 0.05;
          if (x >= (x1 - tol) && x <= (x2 + tol) && y >= (y1 - tol) && y <= (y2 + tol)) {
            qPoints = possiblePoints;
          }
        }
      }
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
    }[d.type] || "Mixto";
  
    return `<div style="margin-bottom:8px;">
      <strong>${d.index}. ${escapeHtml(d.title)}</strong><br/>
      Tipo: ${tipoLiteral}<br/>
      ${d.answered 
        ? `<strong>Tu respuesta:</strong> ${d.studentAnswer}`
        : `<strong>Tu respuesta:</strong> <em>Sin responder</em>`}<br/>
      ${showCorrect ? `<strong>Respuesta correcta:</strong> ${d.correctAnswer}<br/>` : ''}
      <strong>Puntos obtenidos:</strong> ${d.points}<br/>
      ${d.type === 'open' || d.type === 'short' ? `<div class="small">Palabras clave detectadas: ${d.openEval?.found?.map(f=>escapeHtml(f.word)+' (x'+f.count+')').join(', ') || 'Ninguna'}</div>` : ''}
    </div><hr/>`;
  }).join('');

  $('detailedAnswers').innerHTML = detailsHtml;

  // --- generar y almacenar código de resultado ---
  const resultCode = generateResultCode();

  try {
    const stored = JSON.parse(localStorage.getItem('results') || '[]');
    const resultObj = {
      student: studentName,
      grade: $('gradeSelect').selectedOptions[0].textContent,
      test: currentTest.name,
      testCode: currentTest.code,
      timestamp: new Date().toISOString(),
      score: totalScore,
      details,
      cheatLogs,
      resultCode
    };
    stored.push(resultObj);
    localStorage.setItem('results', JSON.stringify(stored));

    // Mostrar código en la pantalla de resultados y añadir botón copiar
    const codeEl = $('resultCodeDisplay');
    if (codeEl) {
      codeEl.innerHTML = `Código de resultado: <strong class="result-code">${resultCode}</strong> 
        <button id="copyResultCodeBtn" class="btn" style="margin-left:8px;">Copiar código</button>`;
      const copyBtn = $('copyResultCodeBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard?.writeText(resultCode).then(() => {
            alert('Código copiado al portapapeles');
          }).catch(() => {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = resultCode; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); alert('Código copiado'); } catch(e){ alert('No se pudo copiar automáticamente. Selecciona y copia manualmente.'); }
            ta.remove();
          });
        });
      }
    }
  } catch (e) { console.error('Error guardando resultado:', e); }

  // mensaje de docente...
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

  if (!cheatingForced) {
    try {
      const deviceId = getDeviceId();
      setLastAttemptTime(currentTest.code, deviceId, new Date().toISOString());
    } catch (e) {
      console.warn('No se pudo guardar lastAttempt:', e);
    }
  }

  enviarResultadosAlDocente(currentTest, studentName, $('metaGrade').textContent, totalScore, JSON.stringify(details, null, 2));

  if (examTerminatedForCheating) {
    alert('La prueba terminó por comportamiento no permitido. Tu intento fue registrado y tu acceso bloqueado.');
  } else {
    localStorage.removeItem('examProgress');
  }
}

// ---------- FUNCIONES PARA VER RESULTADOS INDIVIDUALES ----------
// ---------- buscar resultado por código ----------
function findResultByCode(code) {
  try {
    const stored = JSON.parse(localStorage.getItem('results') || '[]');
    return stored.find(r => String(r.resultCode) === String(code)) || null;
  } catch (e) { return null; }
}

// ---------- renderizar resultado (usada por la pantalla 'Ver resultados') ----------
function renderResultInViewArea(result, targetElId = 'viewResultArea') {
  const container = document.getElementById(targetElId);
  if (!container) return;
  if (!result) {
    container.innerHTML = '<p class="small">No se encontró ningún resultado con ese código.</p>';
    return;
  }

  // Resumen simple
  const summary = `
    <div class="result-summary">
      <div><strong>Estudiante:</strong> ${escapeHtml(result.student)}</div>
      <div><strong>Curso:</strong> ${escapeHtml(result.grade)}</div>
      <div><strong>Prueba:</strong> ${escapeHtml(result.test)} (${escapeHtml(result.testCode)})</div>
      <div><strong>Puntaje:</strong> ${escapeHtml(String(result.score))}</div>
      <div><strong>Fecha:</strong> ${escapeHtml(result.timestamp)}</div>
      <div style="margin-top:6px;">Código: <strong class="result-code">${escapeHtml(result.resultCode)}</strong></div>
    </div>
  `;

  // Detalles (resumidos)
  const rows = (result.details || []).map(d => `
    <div style="margin-bottom:8px;">
      <strong>${escapeHtml(String(d.index || ''))}. ${escapeHtml(d.title || '')}</strong><br>
      Tipo: ${escapeHtml(d.type || '')}<br>
      ${d.answered ? `<strong>Tu respuesta:</strong> ${escapeHtml(String(d.studentAnswer || ''))}` : `<strong>Tu respuesta:</strong> <em>Sin responder</em>`}<br>
      <strong>Puntos:</strong> ${escapeHtml(String(d.points || 0))}
    </div>
    <hr/>
  `).join('');

  // botones de exportación en esta vista
  const exportButtons = `
    <div class="row" style="gap:8px; margin-top:12px;">
      <button id="viewJsonBtn" class="btn">JSON</button>
      <button id="viewPdfBtn" class="btn">PDF</button>
    </div>
  `;

  container.innerHTML = summary + exportButtons + `<div style="margin-top:30px; text-align:center;">${rows || '<p class="small">Sin detalles</p>'}</div>`;

  // añadir listeners a los nuevos botones (descargas de este resultado)
  document.getElementById('viewJsonBtn').addEventListener('click', () => downloadResults(result));
  document.getElementById('viewPdfBtn').addEventListener('click', () => downloadResultsPdf(result));
}

// ---------- descargar JSON ----------
function downloadResults(resultObj) {
  if (!currentTest && !resultObj) return;

  // si resultObj viene desde "Ver resultados" pero no trae detalles, ofrecer fallback
  if (resultObj && (!resultObj.details || resultObj.details.length === 0)) {
    if (!confirm('El resultado que intentas descargar no contiene detalles. ¿Deseas descargar tus respuestas actuales en su lugar?')) {
      return;
    }
    resultObj = null; // forzar fallback below
  }

  const data = resultObj ? resultObj : {
    student: $('studentName').value.trim(),
    grade: $('gradeSelect').selectedOptions[0].textContent,
    test: currentTest ? currentTest.name : '',
    testCode: currentTest ? currentTest.code : '',
    timestamp: new Date().toISOString(),
    answers,
    cheatLogs: getCheatLogsForSession(currentSessionId) || currentCheatEvents || []
  };

  console.log('Downloading result JSON:', data);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = resultObj && resultObj.resultCode ? `resultado-${resultObj.resultCode}.json` : "resultado.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- truncar texto PDF ---------- //
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;             
}

// ---------- exportar PDF ----------
function downloadResultsPdf(docData = {}) {
  // --- helpers internos ---
  function stripTags(input) {
    if (input === undefined || input === null) return '';
    try {
      const s = String(input);
      return s.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim();
    } catch (e) { return String(input); }
  }

  function formatDateNice(d) {
    if (!d) return '';
    const dateObj = (d instanceof Date) ? d : (isNaN(Date.parse(d)) ? null : new Date(d));
    if (!dateObj) return String(d);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
  }

  function answerToText(ans, qtype) {
    // Convierte cualquier studentAnswer/correctAnswer a texto plano legible
    if (ans === undefined || ans === null) return '';
    if (typeof ans === 'string' || typeof ans === 'number' || typeof ans === 'boolean') return stripTags(ans);
    if (Array.isArray(ans)) {
      return ans.map(a => stripTags(a)).filter(x => x).join(' , ');
    }
    if (typeof ans === 'object') {
      // Si es un objeto de gaps: { "0": "a", "1": "b" } -> ordenar por clave
      const keys = Object.keys(ans);
      if (keys.length === 0) return '';
      const allNumeric = keys.every(k => /^\d+$/.test(k));
      if (allNumeric) {
        return keys.sort((a,b)=>Number(a)-Number(b)).map(k => stripTags(ans[k])).filter(x => x).join(' | ');
      }
      // matches / map-like: mostrar clave:valor
      return keys.map(k => `${k}: ${stripTags(ans[k])}`).join(' ; ');
    }
    try { return stripTags(String(ans)); } catch (e) { return ''; }
  }

  // Guard: jsPDF debe estar disponible como window.jspdf.jsPDF
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.warn('jsPDF no está disponible en este entorno. downloadResultsPdf requiere jsPDF.');
    alert('No se puede generar PDF: la librería jsPDF no está cargada. Asegúrate de incluir jspdf en el HTML.');
    return;
  }

  const { jsPDF } = window.jspdf;
  let doc;
  try {
    doc = new jsPDF('p', 'pt', 'a4');
  } catch (e) {
    console.error('Error inicializando jsPDF:', e);
    alert('No se pudo inicializar jsPDF en este navegador.');
    return;
  }

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  // --- Cabecera título ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Resultados de la evaluación', margin, y);
  y += 18;

  // --- Código de presentación (11 dígitos) en la esquina superior derecha ---
  const resultCode = docData.resultCode;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Código de presentación: ${resultCode}`, pageW - margin, 40, { align: 'right' });

  // --- Datos principales (soporte para diferentes nombres de campo en docData/result) ---
  const studentName = (
    docData.studentName ||
    docData.student ||
    docData.studentFullName ||
    (document.getElementById('studentName') ? document.getElementById('studentName').value.trim() : '') ||
    (currentTest && currentTest.student ? currentTest.student : '') ||
    ''
  );

  const course = (
    docData.course ||
    docData.grade ||
    docData.group ||
    (document.getElementById('gradeSelect') ? (document.getElementById('gradeSelect').selectedOptions[0]?.textContent || '') : '') ||
    (currentTest && currentTest.grade ? currentTest.grade : '') ||
    ''
  );

  const testName = (
    docData.testName ||
    docData.test ||
    docData.test_title ||
    (currentTest ? (currentTest.name || '') : '') ||
    ''
  );

  // fecha: acepta date, timestamp o fallback a ahora
  const dateStr = formatDateNice(docData.date || docData.timestamp || docData.time || new Date());

  // Puntaje: si viene numérico, usarlo; si viene un resumen de texto ("Puntaje: 4 ...") intentar extraer solo el valor útil.
  let scoreStr = '';
  if (docData.score !== undefined && docData.score !== null) {
    scoreStr = String(docData.score);
  } else if (docData.resultSummary || docData.summary) {
    const s = String(docData.resultSummary || docData.summary || '');
    const m = s.match(/Puntaje\s*[:\-]?\s*([^\r\n]+)/i);
    scoreStr = m ? m[1].trim() : s.split(/\r?\n/)[0].trim();
  } else {
    const el = document.getElementById('resultSummary');
    if (el && el.textContent) {
      const s = el.textContent || '';
      const m = s.match(/Puntaje\s*[:\-]?\s*([^\r\n]+)/i);
      scoreStr = m ? m[1].trim() : s.split(/\r?\n/)[0].trim();
    }
  }
  // limpiar HTML/espacios repetidos definitivamente
  scoreStr = stripTags(scoreStr).replace(/\s{2,}/g, ' ').trim();

  y += 6;
  const leftColX = margin;
  const rightColX = pageW - margin;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Estudiante:', leftColX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(stripTags(studentName), leftColX + 80, y);

  // derecha: Fecha
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', rightColX - 120, y, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, rightColX - 60, y, { align: 'left' });

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.text('Curso:', leftColX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(stripTags(course), leftColX + 80, y);

  // derecha: Puntaje
  doc.setFont('helvetica', 'bold');
  doc.text('Puntaje:', rightColX - 120, y, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.text(scoreStr, rightColX - 60, y, { align: 'left' });

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.text('Prueba:', leftColX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(stripTags(testName), leftColX + 80, y);

  y += 18;

  // --- Preparar filas de la tabla: aceptar varios nombres para detalles de preguntas ---
  const details = Array.isArray(docData.details) ? docData.details
    : Array.isArray(docData.answers) ? docData.answers
    : Array.isArray(docData.questionsDetails) ? docData.questionsDetails
    : [];

  // línea separadora (asegurarse ancho correcto)
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  const tableRows = details.map(d => {
    const idx = (d.index !== undefined && d.index !== null) ? String(d.index) : (d._index !== undefined ? String(d._index) : '');
    const title = stripTags(d.title || d.question || d.prompt || '');
    let studentText = answerToText(d.studentAnswer ?? d.answer ?? d.given ?? d.response, d.type || type);
    studentText = stripTags(studentText);

    const pts = (d.points !== undefined && d.points !== null) ? String(d.points) : '';

    return [ idx, title, studentText, pts ];
  });

  // --- encabezado coloreado para la sección "Detalle de preguntas" ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(41, 128, 185);
  doc.text('Detalle de preguntas:', margin + 8, y + 8);
  // restaurar color texto
  doc.setTextColor(0, 0, 0);
  y += 24;

  // --- Dibujar tabla: preferir doc.autoTable si está disponible (mejor formato) ---
  const startYForTable = y;
  if (typeof doc.autoTable === 'function') {
    // calcular anchos en función del ancho disponible
    const usableWidth = pageW - margin * 2;
    // establecer estilos razonables para mantener diseño actual
    doc.autoTable({
      startY: startYForTable,
      head: [[ '#', 'Pregunta', 'Tu respuesta', 'Puntos' ]],
      body: tableRows,
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 4,
        lineWidth: 0.2,            // grosor de borde
        lineColor: [100, 100, 100]
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },               // #
        1: { cellWidth: Math.max(usableWidth - 30 - Math.round(usableWidth * 0.35) - 50, 80) },                                // Pregunta
        2: { cellWidth: Math.round(usableWidth * 0.35) },                                // Tu respuesta
        3: { cellWidth: 50, halign: 'center' }                // Puntos
      },
      didDrawPage: function (data) {
        // si se requieren encabezados/pie adicionales por página, se pueden agregar aquí
      },
      margin: { left: margin, right: margin }
    });
    // después de autoTable, obtener la y final
    y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : doc.previousAutoTable ? doc.previousAutoTable.finalY + 12 : startYForTable + 12;
  } else {
    // Fallback: imprimir tabla simple a mano
    const headings = ['#','Pregunta','Tu respuesta','Puntos'];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(headings.join(' | '), margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    tableRows.forEach(row => {
      const line = row.map(c => stripTags(String(c))).join(' | ');
      doc.text(line, margin, y);
      y += 24;
      // posible salto de página
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 40;
      }
    });
  }

  // --- Detectar cheat logs con tolerancia a nombres distintos ---
  const cheatLogs = Array.isArray(docData.cheatLogs) ? docData.cheatLogs
    : Array.isArray(docData.cheats) ? docData.cheats
    : Array.isArray(docData.events) ? docData.events
    : Array.isArray(docData.cheat_events) ? docData.cheat_events
    : (window.currentCheatEvents && Array.isArray(window.currentCheatEvents) ? window.currentCheatEvents : null)
    || (localStorage.getItem('cheatLogs') ? JSON.parse(localStorage.getItem('cheatLogs')) : []);


  if (cheatLogs && cheatLogs.length) {
    // encabezado coloreado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 128, 0);
    doc.text('Intentos de trampa:', margin + 8, y + 8);
    doc.setTextColor(0, 0, 0);
    y += 24;

    // preparar filas
    const cheatRows = cheatLogs.map((c, i) => {
      const when = formatDateNice(c.timestamp || c.date || c.time || '');
      const type = c.type || c.event || c.kind || '';
      const note = (c.note || c.details || '').toString();
      return [ String(i + 1), when, type, stripTags(note) ];
    });

    // usar autoTable si está
    if (typeof doc.autoTable === 'function') {
      const usableWidth = pageW - margin * 2;
      doc.autoTable({
        startY: y,
        head: [['#', 'Fecha', 'Tipo', 'Detalles']],
        body: cheatRows,
        styles: { fontSize: 9 },
        headStyles: { 
          fillColor: [255, 128, 0], 
          textColor: 255, 
          lineWidth: 0.2,            // grosor de borde
          lineColor: [100, 100, 100] },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: Math.round(usableWidth * 0.25) },
          2: { cellWidth: Math.round(usableWidth * 0.2) },
          3: { cellWidth: Math.round(usableWidth * 0.45) }
        },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : y + 12;
    } else {
      // fallback simple
      doc.setFont('helvetica', 'bold');
      doc.text('# | Fecha | Tipo | Detalles', margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      cheatRows.forEach(r => {
        doc.text(r.join(' | '), margin, y);
        y += 24;
        if (y > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          y = 40;
        }
      });
      y += 8;
    }
  }

  // --- Pie (opcional) con resumen o notas ---
  y += 8;
  if (y < doc.internal.pageSize.getHeight() - 40) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const footerText = 'Este documento muestra el detalle de las respuestas registradas en la prueba.';
    doc.text(footerText, pageW / 2, y, { align: 'center' });
    y += 12;
  }

  // --- Guardar el PDF con nombre legible ---
  const safeTestName = (docData.testName || 'Prueba').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_');
  const filename = `${safeTestName}_${generateExportCode()}.pdf`;
  // --- Intentar añadir marca de agua desde utils/logo.png (opacidad 0.4) ---
  (function saveWithOptionalWatermark() {
    const logoSrc = '../utils/logo.png';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.4;
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL('image/png');

        const nPages = (typeof doc.getNumberOfPages === 'function') ? doc.getNumberOfPages() : doc.internal.getNumberOfPages();
        for (let p = 1; p <= nPages; p++) {
          doc.setPage(p);
          const pw = doc.internal.pageSize.getWidth();
          const ph = doc.internal.pageSize.getHeight();
          // Escalar la imagen para que ocupe la mitad del ancho de la página aproximadamente
          const w = pw * 0.5;
          const h = (img.height / img.width) * w;
          const x = (pw - w) / 2;
          const yImg = (ph - h) / 2;
          try { doc.addImage(imgData, 'PNG', x, yImg, w, h); } catch (errAdd) { console.warn('addImage falló:', errAdd); }
        }
        try { doc.save(filename); } catch (eSave) {
          try { window.open(doc.output('bloburl'), '_blank'); } catch (e2) { console.error('No se pudo abrir PDF', eSave, e2); alert('No se pudo generar el PDF. Revisa la consola.'); }
        }
      } catch (e) {
        console.warn('Error procesando logo para watermark; guardando sin watermark.', e);
        try { doc.save(filename); } catch (e2) { try { window.open(doc.output('bloburl'), '_blank'); } catch (e3) { console.error(e2, e3); } }
      }
    };
    img.onerror = function () {
      // si falla la carga del logo, guardar sin watermark
      try { doc.save(filename); } catch (e) { try { window.open(doc.output('bloburl'), '_blank'); } catch (e2) { console.error('No se pudo abrir PDF', e, e2); } }
    };
    // arrancar carga
    img.src = logoSrc;
  })();
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
  $('downloadPdfBtn').addEventListener('click', () => {
    // tomar el último resultado almacenado
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem('results') || '[]');
    } catch (e) { stored = []; }
    const lastResult = stored.length ? stored[stored.length - 1] : null;

    if (lastResult) {
      downloadResultsPdf(lastResult);
    } else {
      // si no hay nada en localStorage, llamar sin parámetro (usará DOM/currentTest como fallback)
      downloadResultsPdf();
    }
  });
  $('downloadCertBtn').addEventListener('click', downloadCertificate);
  $('backBtn').addEventListener('click', () => location.reload());

  // boton para ir a "Ver resultados"
  const btnView = $('btnViewResults');
  if (btnView) btnView.addEventListener('click', () => showSection('viewResults'));

  // pantalla ver resultados: buscar y volver
  const btnSearch = $('btnSearchResult');
  if (btnSearch) btnSearch.addEventListener('click', () => {
    const code = $('resultCodeInput').value.trim();
    if (!/^\d{11}$/.test(code)) { alert('Ingresa un código válido de 11 dígitos.'); return; }
    const found = findResultByCode(code);
    renderResultInViewArea(found);
  });

  const btnBackFromView = $('btnBackFromView');
  if (btnBackFromView) btnBackFromView.addEventListener('click', () => {
    showSection('start');
    const el = document.getElementById('viewResultArea');
    el.innerHTML = '';
    document.getElementById('resultCodeInput').value = "";
  });
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
