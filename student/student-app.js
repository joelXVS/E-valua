// student-app.js

let grades = { grades: [] };
let tests = { tests: [] };
let teachers = { teachers: [] };

async function loadInitialData() {
  try {
    const [gResp, tResp, teResp] = await Promise.all([
      fetch('/grades.json'),
      fetch('/tests.json'),
      fetch('/teachers.json')
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
function isStudentBlocked(name, code) {
  const blocked = getBlockedStudents();
  return blocked.some(b => b.name === name && b.code === code);
}
function blockStudent(name, code, reason = 'cheating') {
  const blocked = getBlockedStudents();
  if (!blocked.some(b => b.name === name && b.code === code)) {
    blocked.push({ name, code, reason, timestamp: new Date().toISOString() });
    localStorage.setItem('blockedStudents', JSON.stringify(blocked));
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
  if (name && code && isStudentBlocked(name, code)) {
    msg.textContent = 'Este estudiante (nombre + código) está bloqueado y no puede iniciar la prueba.';
  }
}
function canStartExam() {
  const name = $('studentName').value.trim();
  const code = $('applyCode').value.trim();
  if (name.length < 18) {
    alert('El nombre completo debe tener al menos 18 caracteres.');
    return false;
  }
  if (code.length < 8) {
    alert('El código de aplicación debe tener al menos 8 caracteres.');
    return false;
  }
  if (isStudentBlocked(name, code)) {
    alert('No puedes iniciar la prueba: esta combinación de nombre + código está bloqueada.');
    return false;
  }
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

  // intentar fullscreen
  enterFullScreen();

  // enganchar listeners anti-trampa
  attachAntiCheatListeners();

  renderQuestion();
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
  let blurCount = 0; // contador de cambios a segundo plano

  function handleVisibilityChange() {
    if (document.hidden) {
      tabSwitchCount++; // aumentar contador solo si se oculta la pestaña

      if (tabSwitchCount === 1) {
        alert('Atención: no cambies de pestaña ni minimices el navegador. Si lo vuelves a hacer, la prueba terminará y se bloqueará tu acceso.');
      } else if (tabSwitchCount >= 2) {
        alert('Cambio de pestaña detectado nuevamente. La prueba se terminará y tu acceso quedará bloqueado.');
        examTerminatedForCheating = true;
        const name = $('studentName').value.trim();
        const code = $('applyCode').value.trim();
        blockStudent(name, code, 'visibility-violation');
        finishExam(true);
      }
    }
  }

  function handleWindowBlur() {
    blurCount++;

    if (blurCount === 1) {
      alert('Atención: no cambies de pestaña ni minimices el navegador. Si lo vuelves a hacer, la prueba terminará y se bloqueará tu acceso.');
    } else if (blurCount >= 2) {
      alert('Se detectó pérdida de foco nuevamente. La prueba se terminará y tu acceso quedará bloqueado.');
      examTerminatedForCheating = true;
      const name = $('studentName').value.trim();
      const code = $('applyCode').value.trim();
      blockStudent(name, code, 'blur-violation');
      finishExam(true);
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
  if (q.image) {
    inner += `<div><img src="${q.image}" alt="Imagen de la pregunta" style="max-width:100%; margin:8px 0;" /></div>`;
  }

  if (q.type === 'mcq') {
    inner += `<div class="options">${(q.options || []).map((opt, i) => {
    // si la opción es string, lo convertimos en objeto {text: opt}
    const o = (typeof opt === 'string') ? { text: opt } : opt;
    return `
      <label style="display:block; margin:6px 0;">
        <input type="radio" name="q${currentQuestionIndex}" value="${i}" ${answers[q.title] == i ? 'checked' : ''}>
        ${escapeHtml(o.text || '')}
        ${o.image ? `<div><img src="${o.image}" alt="Opción ${i+1}" style="max-width:100px; margin-top:4px;" /></div>` : ''}
      </label>
    `}).join('')}</div>`;
  } else if (q.type === 'tf') {
    inner += `<div class="options">
      <label style="display:block; margin:6px 0;">
        <input type="radio" name="q${currentQuestionIndex}" value="1" ${answers[q.title] == 1 ? 'checked' : ''}>
        Verdadero
      </label>
      <label style="display:block; margin:6px 0;">
        <input type="radio" name="q${currentQuestionIndex}" value="0" ${answers[q.title] == 0 ? 'checked' : ''}>
        Falso
      </label>
    </div>`;
  } else if (q.type === 'open') {
    inner += `<div>
      <textarea id="open_${currentQuestionIndex}" rows="5" style="width:100%" placeholder="Escribe tu respuesta aquí...">${answers[q.title] || ''}</textarea>
    </div>`;
    inner += `<p class="small">Responde en pocas líneas. Se otorgarán puntos parciales si identificamos palabras clave y sus ocurrencias.</p>`;
  } else {
    inner += `<div class="small">Tipo de pregunta desconocido.</div>`;
  }

  container.innerHTML = inner;

  // listeners para respuestas
  container.querySelectorAll('input[type=radio]').forEach(inp => {
    inp.addEventListener('change', () => {
      const val = inp.value;
      answers[q.title] = q.type === 'mcq' ? parseInt(val) : parseInt(val);
      updateNavButtonsAndFinishButton();
    });
  });
  const ta = container.querySelector(`#open_${currentQuestionIndex}`);
  if (ta) {
    ta.addEventListener('input', () => {
      answers[q.title] = ta.value;
      updateNavButtonsAndFinishButton();
    });
  }

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

// Evaluación de respuesta abierta: cada ocurrencia suma weight; normalizamos para que no supere 1.
function evaluateOpenAnswerByOccurrences(answerText, keywords) {
  if (!answerText) return { scoreRatio: 0, found: [] };
  const text = answerText.toLowerCase();
  let totalWeight = 0;
  let foundWeightSum = 0;
  const found = [];
  (keywords || []).forEach(k => {
    const w = Number(k.weight) || 0;
    totalWeight += w;
    const re = new RegExp(`\\b${escapeRegExp(String(k.word).toLowerCase())}\\b`, 'g');
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      foundWeightSum += w * count; // cada ocurrencia suma weight
      found.push({ word: k.word, count, weight: w });
    }
  });
  // normalizamos: ratio = min(foundWeightSum / totalWeight, 1)
  const ratio = totalWeight > 0 ? Math.min(foundWeightSum / totalWeight, 1) : 0;
  return { scoreRatio: Math.max(0, Math.min(1, ratio)), found };
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
    if (q.type === 'mcq') {
      if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '') {
        if (parseInt(studentAns) === parseInt(q.answer)) {
          qPoints = possiblePoints;
        } else {
          qPoints = (currentTest.points && currentTest.points.bad) ? -Math.abs(Number(currentTest.points.bad)) : 0;
        }
      } else {
        qPoints = 0;
      }
    } else if (q.type === 'tf') {
      if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '') {
        if (parseInt(studentAns) === parseInt(q.answer)) {
          qPoints = possiblePoints;
        } else {
          qPoints = (currentTest.points && currentTest.points.bad) ? -Math.abs(Number(currentTest.points.bad)) : 0;
        }
      } else {
        qPoints = 0;
      }
    } else if (q.type === 'open') {
      const evalData = evaluateOpenAnswerByOccurrences(String(studentAns || ''), q.keywords || []);
      qPoints = Math.round((possiblePoints * evalData.scoreRatio) * 1000) / 1000;
    } else {
      qPoints = 0;
    }
    totalScore += qPoints;
    const answered = (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '');
    const detail = {
      index: idx + 1,
      title: q.title,
      type: q.type,
      answered,
      studentAnswer: (q.type === 'mcq' || q.type === 'tf') ? (answered ? (q.options ? q.options[studentAns] : String(studentAns)) : 'Sin responder') : (answered ? String(studentAns) : 'Sin responder'),
      correctAnswer: (q.type === 'mcq' || q.type === 'tf') ? ((q.options && q.options[q.answer]) ? q.options[q.answer] : String(q.answer)) : (q.type === 'open' ? '(Respuesta abierta - evaluada por palabras clave)' : ''),
      points: qPoints
    };
    if (q.type === 'open') {
      detail.openEval = evaluateOpenAnswerByOccurrences(String(studentAns || ''), q.keywords || []);
    }
    details.push(detail);
  });

  totalScore = Math.round(totalScore * 1000) / 1000;

  // cheat logs para esta sesión (se guardaron en localStorage por sessionId)
  const cheatLogs = getCheatLogsForSession(currentSessionId) || currentCheatEvents || [];

  // mostrar sección de resultados
  showSection('result');
  $('resultSummary').textContent = `Puntaje: ${totalScore}`;

  const showCorrect = !!currentTest.showCorrect;
  const teacherContact = findTeacherContactForTest(currentTest.code);

  const detailsHtml = details.map(d => {
    return `<div style="margin-bottom:8px;">
      <strong>${d.index}. ${escapeHtml(d.title)}</strong><br/>
      Tipo: ${escapeHtml(d.type)}<br/>
      ${d.answered ? `<strong>Tu respuesta:</strong> ${escapeHtml(String(d.studentAnswer))}` : `<strong>Tu respuesta:</strong> <em>Sin responder</em>`}<br/>
      ${showCorrect ? `<strong>Respuesta correcta:</strong> ${escapeHtml(String(d.correctAnswer))}<br/>` : ''}
      <strong>Puntos obtenidos:</strong> ${d.points}<br/>
      ${d.type === 'open' ? `<div class="small">Evaluación palabras clave: ${d.openEval.found.length > 0 ? d.openEval.found.map(f=>escapeHtml(f.word)+' (x'+f.count+')').join(', ') : 'No se encontraron'}</div>` : ''}
    </div><hr/>`;
  }).join('');

  const teacherLine = teacherContact ? `<div style="margin-top:8px;"><strong>Docente creador:</strong> ${escapeHtml(teacherContact.name || '')} — <strong>Correo:</strong> ${escapeHtml(teacherContact.email || teacherContact.derivedEmail || '')}</div>` : '';

  $('detailedAnswers').innerHTML = `<div><strong>Resumen de la prueba:</strong></div>
    <div style="margin-top:8px">${detailsHtml}</div>
    ${teacherLine}
    <div style="margin-top:8px;"><strong>Eventos de seguridad detectados:</strong> ${cheatLogs.length ? cheatLogs.map(e=>`${e.when} (${e.kind})`).join(', ') : 'Ninguno'}</div>
  `;

  // guardar resultado (incluye cheatLogs)
  try {
    const stored = JSON.parse(localStorage.getItem('results') || '[]');
    const resultRecord = {
      student: $('studentName').value.trim(),
      grade: $('gradeSelect').selectedOptions[0].textContent,
      test: currentTest.name,
      testCode: currentTest.code,
      timestamp: new Date().toISOString(),
      score: totalScore,
      details,
      cheatLogs
    };
    stored.push(resultRecord);
    localStorage.setItem('results', JSON.stringify(stored));
  } catch (e) {
    console.error('Error guardando resultado:', e);
  }

  if (examTerminatedForCheating) {
    alert('La prueba terminó por comportamiento no permitido. Tu intento fue registrado y tu acceso bloqueado.');
  }
}

// ---------- sacar contacto docente ----------
function findTeacherContactForTest(testCode) {
  if (!teachers || !Array.isArray(teachers.teachers)) return null;
  for (const t of teachers.teachers) {
    if (Array.isArray(t.tests) && t.tests.includes(testCode)) {
      const contact = { name: t.name || '', user: t.user || '' };
      if (t.email) contact.email = t.email;
      else contact.derivedEmail = `${(t.user || 'docente').toLowerCase()}@gmail.com`;
      return contact;
    }
  }
  return null;
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
  a.download = 'result.json';
  a.click();
  URL.revokeObjectURL(url);
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

  const docData = lastStored || {
    student: $('studentName').value.trim(),
    grade: $('gradeSelect').selectedOptions[0].textContent,
    test: currentTest.name,
    testCode: currentTest.code,
    timestamp: new Date().toISOString(),
    score: $('resultSummary').textContent || '',
    details: [],
    cheatLogs: getCheatLogsForSession(currentSessionId) || currentCheatEvents || []
  };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'letter');
  const margin = 40;
  let y = 40;

  doc.setFontSize(14);
  doc.text(`Resultados — ${docData.test}`, margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(`Estudiante: ${docData.student}`, margin, y); y += 15;
  doc.text(`Curso: ${docData.grade}`, margin, y); y += 15;
  doc.text(`Código de prueba: ${docData.testCode}`, margin, y); y += 15;
  doc.text(`Fecha: ${docData.timestamp}`, margin, y); y += 20;
  doc.text(`Puntaje: ${docData.score !== undefined ? String(docData.score) : ''}`, margin, y); y += 20;

  // Cabecera tabla simple
  doc.setFontSize(11);
  doc.text('No', margin, y);
  doc.text('Pregunta', margin + 30, y);
  doc.text('Respuesta alumno', margin + 260, y);
  doc.text('Puntos', margin + 460, y);
  y += 12;

  doc.setFontSize(10);
  (docData.details || []).forEach(d => {
    if (y > 700) { doc.addPage(); y = 40; }
    doc.text(String(d.index || ''), margin, y);
    const qTitle = String(d.title || '').substring(0, 60);
    doc.text(qTitle, margin + 30, y);
    const aText = String(d.studentAnswer || '').substring(0, 40);
    doc.text(aText, margin + 260, y);
    doc.text(String(d.points || ''), margin + 460, y);
    y += 12;
  });

  // Events de cheat
  if ((docData.cheatLogs || []).length) {
    if (y > 650) { doc.addPage(); y = 40; }
    y += 10;
    doc.setFontSize(11);
    doc.text('Eventos de seguridad detectados:', margin, y); y += 14;
    doc.setFontSize(10);
    (docData.cheatLogs || []).forEach(e => {
      doc.text(`${e.when} — ${e.kind}`, margin, y);
      y += 12;
      if (y > 750) { doc.addPage(); y = 40; }
    });
  }

  doc.save(`${docData.testCode || 'result'}-${(docData.student||'estudiante').replace(/\s+/g,'_')}.pdf`);
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
