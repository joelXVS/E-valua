// teacher-app.js

// ======================
// Datos precargados
// ======================
let teachers = { teachers: [] };
let tests = { tests: [] };
let bank = { questions: [] };
let guia = {};

// carga inicial de archivos JSON locales
async function loadInitialData() {
  try {
    const [teResp, tResp, bResp, gResp] = await Promise.all([
      fetch('../teachers.json'),
      fetch('../.tests.json'),
      fetch('../banco_preguntas.json').catch(()=>({ ok:false })),
      fetch('../guia.json').catch(()=>({ ok:false }))
    ]);
    teachers = teResp.ok ? await teResp.json() : { teachers: [] };
    tests = tResp.ok ? await tResp.json() : { tests: [] };
    bank = (bResp && bResp.ok) ? await bResp.json() : { questions: [] };
    guia = (gResp && gResp.ok) ? await gResp.json() : {};
    // si hay tests guardados en localStorage los preferimos
    const lsTests = localStorage.getItem('tests_storage');
    if (lsTests) {
      try { tests = JSON.parse(lsTests); } catch(e){ /* ignore */ }
    }
    const lsBank = localStorage.getItem('bank_storage');
    if (lsBank) {
      try { bank = JSON.parse(lsBank); } catch(e){ /* ignore */ }
    }
    console.log('Datos iniciales cargados', { teachers: teachers.teachers?.length, tests: tests.tests?.length, bank: bank.questions?.length });
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

// ======================
// Utilidades DOM
// ======================
function $(id){ return document.getElementById(id); }
function showPanelSection(name){
  document.querySelectorAll('.panel-section').forEach(s=>s.classList.add('hidden'));
  $(`panel-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-section="${name}"]`);
  if (btn) btn.classList.add('active');
}

// ======================
// Variables globales
// ======================
let currentTeacher = null;
let editingTest = null;

// ======================
// Login / Logout (mantengo la lógica previa)
// ======================
function login(){
  const user = $('teacherUser').value.trim();
  const pass = $('teacherPass').value.trim();
  const found = (teachers.teachers||[]).find(t => t.user === user && t.pass === pass);
  if(!found){ alert('Usuario o contraseña incorrecta.'); return; }
  currentTeacher = found;
  $('welcome').textContent = `Hola ${found.name}`;
  $('login').classList.add('hidden');
  $('panel').classList.remove('hidden');
  showPanelSection('tests');
  renderTests();
  renderBank();
  renderGuideShort();
}
function logout(){ currentTeacher = null; location.reload(); }

// ======================
// Renderizar tests
// ======================
function renderTests(){
  const div = $('testsList');
  const arr = tests.tests || [];
  if (!arr.length) {
    div.innerHTML = `<div class="card small">No hay pruebas definidas.</div>`;
    return;
  }
  div.innerHTML = arr.map(t => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h5 style="margin-bottom:4px">${escapeHtml(t.name)}</h5>
        <div class="small-muted">Duración: ${t.time || 0} min — Código: ${t.code || ''} — Preguntas: ${ (t.questions||[]).length }</div>
      </div>
      <div class="row">
        <button class="btn" onclick="editTest('${t.code}')">Editar</button>
        <button class="btn" onclick="exportSingleTestJson('${t.code}')">Exportar .json</button>
        <button class="btn" onclick="exportSingleTestPdf('${t.code}')">Exportar PDF</button>
        <button class="btn" onclick="promptDeleteTest('${t.code}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

// ======================
// Editor de prueba y preguntas
// ======================
function editTest(code){
  editingTest = (tests.tests||[]).find(x => x.code === code) || { name:'', time:30, points:{ok:1,bad:0}, questions:[], groups:[] };
  $('editName').value = editingTest.name || '';
  $('editTime').value = editingTest.time || 30;
  $('editPtsOk').value = editingTest.points?.ok ?? 1;
  $('editPtsBad').value = editingTest.points?.bad ?? 0;
  $('editFrom').value = editingTest.from || '';
  $('editTo').value = editingTest.to || '';
  $('editShowRes').value = editingTest.showResults ? 'true' : 'false';
  $('editShowCorrect').value = editingTest.showCorrect ? 'true' : 'false';
  $('editGroups').value = (editingTest.groups || []).join(',');
  showPanelSection('editor');
  renderQuestionsEditor();
}

// Render editor de preguntas dentro del editor
function renderQuestionsEditor(){
  const wrap = $('questionsEditor');
  wrap.innerHTML = '';
  (editingTest.questions || []).forEach((q, idx) => {
    wrap.insertAdjacentHTML('beforeend', questionEditorCardHtml(q, idx));
  });
  // attach listeners (delegation)
  wrap.querySelectorAll('.btn-edit-q').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.dataset.idx*1;
      openQuestionModalForEdit(idx);
    });
  });
  wrap.querySelectorAll('.btn-remove-q').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.dataset.idx*1;
      if (confirm('Eliminar esta pregunta?')) {
        editingTest.questions.splice(idx,1);
        renderQuestionsEditor();
      }
    });
  });
}
function questionEditorCardHtml(q, idx){
  return `<div class="card" style="margin-bottom:8px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <strong>${idx+1}. ${escapeHtml(q.title || '(sin título)')}</strong>
        <div class="small-muted">Tipo: ${q.type || ''} — Puntos aprox: ${q.points || '-'}</div>
        ${q.image ? `<img src="${q.image}" class="img-thumb" alt="imagen pregunta" />` : ''}
      </div>
      <div class="row">
        <button class="btn btn-edit-q" data-idx="${idx}">Editar</button>
        <button class="btn btn-remove-q" data-idx="${idx}">Eliminar</button>
      </div>
    </div>
  </div>`;
}

// boton agregar pregunta -> abre modal para crear una nueva
document.addEventListener('click', (ev) => {
  if (ev.target && ev.target.id === 'btnAddQuestion') {
    openQuestionModalForNew();
  }
});

// Modal simple inline (creador de pregunta)
let activeQuestionIndex = null; // null = nueva
function openQuestionModalForNew(){
  showQuestionModal({ type: 'mcq', title:'', options:['',''], keywords:[], image: '' });
  activeQuestionIndex = null;
}
function openQuestionModalForEdit(index){
  activeQuestionIndex = index;
  const q = editingTest.questions[index];
  showQuestionModal(q);
}

// construye y muestra un modal de pregunta (simple)
function showQuestionModal(q){
  // crear overlay modal dinámico (si ya existe, reemplazar)
  let modal = document.querySelector('#qModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'qModal';
    modal.className = 'modal';
    modal.innerHTML = `<div class="card" style="max-width:720px;">
      <h4 id="qModalTitle">Editor de pregunta</h4>
      <div id="qModalBody"></div>
      <div style="margin-top:8px;" class="row">
        <button id="qModalSave" class="btn primary">Guardar</button>
        <button id="qModalCancel" class="btn">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  const body = modal.querySelector('#qModalBody');
  body.innerHTML = `
    <label class="field"><span>Título</span><input id="qTitle" type="text" value="${escapeHtml(q.title||'')}" /></label>
    <label class="field"><span>Tipo</span>
      <select id="qType">
        <option value="mcq">Opción múltiple</option>
        <option value="tf">Verdadero / Falso</option>
        <option value="open">Abierta</option>
      </select>
    </label>
    <div id="qOptionsArea"></div>
    <label class="field"><span>Imagen (arrastrar o seleccionar)</span>
      <input id="qImageFile" type="file" accept="image/*" />
      <div id="qImagePreview">${q.image ? `<img src="${q.image}" class="img-thumb" />` : ''}</div>
    </label>
    <label class="field"><span>Temas / etiquetas (coma-separadas)</span><input id="qTags" type="text" value="${(q.tags||[]).join(',')}" /></label>
  `;
  const select = body.querySelector('#qType');
  select.value = q.type || 'mcq';
  function renderOptionsArea(){
    const area = body.querySelector('#qOptionsArea');
    const type = select.value;
    if (type === 'mcq') {
      const opts = q.options && q.options.length ? q.options.slice() : ['', ''];
      area.innerHTML = `<div id="qOptionsList">${opts.map((o,i)=>`
        <div style="margin-bottom:6px;">
          <input data-idx="${i}" class="qOptText" placeholder="Texto opción" value="${escapeHtml(typeof o === 'string' ? o : (o.text||''))}" />
          <input data-idx="${i}" class="qOptImgFile" type="file" accept="image/*" style="margin-left:6px;" />
          <select data-idx="${i}" class="qOptCorrect"><option value="0">No correcta</option><option value="1">Correcta</option></select>
          <div class="small-muted">Si la opción tiene imagen, súbela aquí o pon ruta en campo texto como 'assets/img/ejemplo.jpg'</div>
        </div>
      `).join('')}
      <div style="margin-top:8px;"><button id="qAddOption" class="btn">Agregar opción</button></div>
      </div>`;
      // marcar correctas si existen
      const corr = typeof q.answer !== 'undefined' ? q.answer : -1;
      setTimeout(()=> {
        area.querySelectorAll('.qOptCorrect').forEach(sel => {
          const idx = sel.dataset.idx*1;
          sel.value = (idx===corr) ? '1' : '0';
        });
      }, 0);
    } else if (type === 'tf') {
      area.innerHTML = `<div class="small-muted">Respuesta correcta:
        <select id="qTfAnswer"><option value="1">Verdadero</option><option value="0">Falso</option></select>
      </div>`;
      if (typeof q.answer !== 'undefined') area.querySelector('#qTfAnswer').value = String(q.answer);
    } else if (type === 'open') {
      area.innerHTML = `<label class="field"><span>Palabras clave y pesos (json array)</span><textarea id="qKeywords" rows="4">${escapeHtml(JSON.stringify(q.keywords||[]))}</textarea></label>`;
    }
  }
  renderOptionsArea();
  select.addEventListener('change', renderOptionsArea);

  // manejo de subida/preview imagen pregunta
  const imageFileInput = body.querySelector('#qImageFile');
  imageFileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const dataUrl = await fileToDataURL(f);
    body.querySelector('#qImagePreview').innerHTML = `<img src="${dataUrl}" class="img-thumb" />`;
    q.image = dataUrl;
  });

  // agregar opción
  body.addEventListener('click', (ev) => {
    if (ev.target.id === 'qAddOption') {
      const list = body.querySelector('#qOptionsList');
      const idx = list.querySelectorAll('input.qOptText').length;
      const node = document.createElement('div');
      node.style.marginBottom = '6px';
      node.innerHTML = `<input data-idx="${idx}" class="qOptText" placeholder="Texto opción" />
        <input data-idx="${idx}" class="qOptImgFile" type="file" accept="image/*" style="margin-left:6px;" />
        <select data-idx="${idx}" class="qOptCorrect"><option value="0">No correcta</option><option value="1">Correcta</option></select>
        <div class="small-muted">Si la opción tiene imagen, súbela aquí o pon ruta en texto</div>`;
      list.appendChild(node);
      // attach file listener
      node.querySelector('.qOptImgFile').addEventListener('change', async (ev2) => {
        const f2 = ev2.target.files[0];
        if (!f2) return;
        const dataUrl2 = await fileToDataURL(f2);
        // guardar en un atributo data-img para leer al guardar
        node.querySelector('.qOptText').dataset.img = dataUrl2;
      });
    }
  });

  // listeners guardar / cancelar
  modal.classList.add('open');
  modal.querySelector('#qModalCancel').onclick = () => { modal.classList.remove('open'); };
  modal.querySelector('#qModalSave').onclick = async () => {
    const title = body.querySelector('#qTitle').value.trim();
    const type = body.querySelector('#qType').value;
    let newQ = { type, title, tags: body.querySelector('#qTags').value.split(',').map(s=>s.trim()).filter(Boolean) };
    // imagen ya pudo haberse guardado en q.image
    if (q.image) newQ.image = q.image;
    if (type === 'mcq') {
      const texts = Array.from(body.querySelectorAll('.qOptText')).map(el => el.value || '');
      const imgs = Array.from(body.querySelectorAll('.qOptText')).map(el => el.dataset.img || '');
      const correctIndex = Array.from(body.querySelectorAll('.qOptCorrect')).findIndex(s=>s.value==='1');
      newQ.options = texts.map((t,i) => {
        if (imgs[i]) return { text: t, image: imgs[i] };
        return t;
      });
      if (correctIndex >= 0) newQ.answer = correctIndex;
    } else if (type === 'tf') {
      const ans = body.querySelector('#qTfAnswer').value;
      newQ.answer = Number(ans);
    } else if (type === 'open') {
      try {
        newQ.keywords = JSON.parse(body.querySelector('#qKeywords').value || '[]');
      } catch (e) { newQ.keywords = []; }
    }

    // insertar en editingTest
    if (activeQuestionIndex === null) {
      editingTest.questions = editingTest.questions || [];
      editingTest.questions.push(newQ);
    } else {
      editingTest.questions[activeQuestionIndex] = newQ;
    }
    modal.classList.remove('open');
    renderQuestionsEditor();
  };
}

// convertir file a dataURL (base64)
function fileToDataURL(file){
  return new Promise((res,rej)=>{
    const reader = new FileReader();
    reader.onload = ()=>res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// guardar prueba
function saveTest(){
  if (!editingTest) return;
  editingTest.name = $('editName').value.trim();
  editingTest.time = Number($('editTime').value) || 0;
  editingTest.points = { ok: Number($('editPtsOk').value) || 1, bad: Number($('editPtsBad').value) || 0 };
  editingTest.from = $('editFrom').value;
  editingTest.to = $('editTo').value;
  editingTest.showResults = $('editShowRes').value === 'true';
  editingTest.showCorrect = $('editShowCorrect').value === 'true';
  editingTest.groups = $('editGroups').value ? $('editGroups').value.split(',').map(s=>s.trim()) : [];

  tests.tests = tests.tests || [];
  if (!editingTest.code) editingTest.code = `T-${Date.now()}`;
  const foundIndex = tests.tests.findIndex(t => t.code === editingTest.code);
  if (foundIndex >= 0) tests.tests[foundIndex] = editingTest;
  else tests.tests.push(editingTest);
  // persist in localStorage
  localStorage.setItem('tests_storage', JSON.stringify(tests));
  alert('Prueba guardada.');
  renderTests();
  showPanelSection('tests');
}

// eliminar prueba
function promptDeleteTest(code){
  if (!confirm('Eliminar prueba?')) return;
  tests.tests = tests.tests.filter(t => t.code !== code);
  localStorage.setItem('tests_storage', JSON.stringify(tests));
  renderTests();
}

// ======================
// Export / Import tests
// ======================
function exportSingleTestJson(code){
  const t = (tests.tests||[]).find(x=>x.code===code);
  if (!t) return alert('Prueba no encontrada');
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${t.code||'test'}.json`; a.click();
}
function exportSingleTestPdf(code){
  const t = (tests.tests||[]).find(x=>x.code===code);
  if (!t) return alert('Prueba no encontrada');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14); doc.text(t.name || 'Prueba', 20, 30);
  doc.setFontSize(10); let y = 44;
  (t.questions||[]).forEach((q, i) => {
    if (y > 760) { doc.addPage(); y = 40; }
    doc.text(`${i+1}. ${q.title}`, 20, y); y+=8;
    if (q.image) { doc.text('[Imagen incluida]', 24, y); y+=8; }
    if (q.type === 'mcq') {
      (q.options||[]).forEach((opt, j) => {
        const label = typeof opt === 'string' ? opt : (opt.text || '');
        doc.text(`   - ${label}`, 24, y); y+=6;
      });
    }
    y+=4;
  });
  doc.save(`${t.code||'prueba'}.pdf`);
}

function exportAllJson(){
  const blob = new Blob([JSON.stringify(tests, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `all_tests.json`; a.click();
}
function exportAllPdf(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('Todas las pruebas', 20, 30);
  let y = 46;
  (tests.tests||[]).forEach((t, idx) => {
    if (y > 700) { doc.addPage(); y = 40; }
    doc.setFontSize(12); doc.text(`${idx+1}. ${t.name} (${t.code})`, 20, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Duración: ${t.time} min — Preguntas: ${ (t.questions||[]).length }`, 24, y); y+=8;
    (t.questions||[]).slice(0,6).forEach((q,i) => {
      if (y > 720) { doc.addPage(); y = 40; }
      doc.text(`  • ${q.title}`, 28, y); y += 6;
    });
    y += 8;
  });
  doc.save('all_tests.pdf');
}

// ======================
// guardar / cargar tests en localStorage
// ======================
function saveTestsToLocalStorage(){ localStorage.setItem('tests_storage', JSON.stringify(tests)); alert('Tests guardados en localStorage'); }
function loadTestsFromLocalStorage(){
  const raw = localStorage.getItem('tests_storage');
  if (!raw) return alert('No hay tests en localStorage');
  try {
    tests = JSON.parse(raw);
    renderTests();
    alert('Tests cargados desde localStorage');
  } catch(e){ alert('Error al cargar tests'); }
}

// ======================
// Importar archivo (json, docx, pdf) - el input está en teacher.html id=fileImport
// Para .json hacemos parse directo y abrimos editor con la prueba importada.
// Para .docx / .pdf mostramos texto extraído (si es posible) y dejamos crear preguntas desde allí.
// ======================
async function handleFileImport(file){
  if (!file) return;
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const txt = await file.text();
    try {
      const obj = JSON.parse(txt);
      // si es una prueba (tiene questions) abrimos editor con ella
      if (obj.questions) {
        editingTest = obj;
        showPanelSection('editor');
        renderQuestionsEditor();
        alert('Prueba importada. Revisa el editor para ajustar.');
      } else {
        // tal vez es un bundle de tests
        if (obj.tests) {
          tests = obj;
          localStorage.setItem('tests_storage', JSON.stringify(tests));
          renderTests();
          alert('Tests importados correctamente.');
        } else {
          alert('JSON no contiene una prueba ni tests.');
        }
      }
    } catch (e) {
      alert('JSON inválido.');
    }
  } else if (name.endsWith('.docx') || name.endsWith('.pdf')) {
    // simple: leemos como texto (no perfecto) y mostramos preview en modal para crear preguntas manualmente
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromArrayBuffer(arrayBuffer, name.endsWith('.docx') ? 'docx' : 'pdf');
    // mostrar en modal de texto
    showTextImportModal(file.name, text);
  } else {
    alert('Formato no soportado.');
  }
}

// heurística de extracción ligera (tendremos texto bruto — uso mínimo: para ayudarte a crear preguntas)
async function extractTextFromArrayBuffer(ab, type){
  if (type === 'docx') {
    try {
      const zip = await JSZip.loadAsync(ab);
      const xml = await zip.file("word/document.xml").async("string");
      return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } catch(e){ return 'No se pudo extraer texto del .docx automáticamente.'; }
  }
  if (type === 'pdf') {
    try {
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      let text = "";
      for (let i=1; i<=pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it=>it.str).join(" ") + "\n";
      }
      return text;
    } catch(e){ return 'No se pudo extraer texto del PDF automáticamente.'; }
  }
  return '';
}

function showTextImportModal(filename, text){
  let modal = document.querySelector('#importTextModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'importTextModal';
    modal.className = 'modal';
    modal.innerHTML = `<div class="card"><h4>Importar desde ${escapeHtml(filename)}</h4>
      <div style="max-height:420px; overflow:auto; border:1px solid #eee; padding:8px; white-space:pre-wrap;" id="importTextContent"></div>
      <p class="small-muted">Usa este texto para crear preguntas manualmente o copiar/pegar en el editor.</p>
      <div style="margin-top:8px;" class="row">
        <button id="importTextOpenEditor" class="btn">Abrir editor (crear nueva prueba)</button>
        <button id="importTextClose" class="btn">Cerrar</button>
      </div></div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#importTextContent').textContent = text;
  modal.classList.add('open');
  modal.querySelector('#importTextClose').onclick = ()=>modal.classList.remove('open');
  modal.querySelector('#importTextOpenEditor').onclick = ()=>{
    modal.classList.remove('open');
    editingTest = { name: `Import - ${filename}`, time:30, points:{ok:1,bad:0}, questions:[] };
    showPanelSection('editor');
    renderQuestionsEditor();
  };
}

// conectar input fileImport
document.addEventListener('change', (ev) => {
  if (ev.target && ev.target.id === 'fileImport') {
    const f = ev.target.files[0];
    handleFileImport(f);
    ev.target.value = '';
  }
});

// ======================
// Banco de preguntas
// ======================
function renderBank(filter = {}){
  const list = $('bankList');
  const rows = (bank.questions || []).filter(q=>{
    if (filter.title && !String(q.title||'').toLowerCase().includes(filter.title.toLowerCase())) return false;
    if (filter.subject && q.subject && !String(q.subject).toLowerCase().includes(filter.subject.toLowerCase())) return false;
    if (filter.grade && q.grade && !String(q.grade).toLowerCase().includes(filter.grade.toLowerCase())) return false;
    if (filter.topic && q.topic && !String(q.topic).toLowerCase().includes(filter.topic.toLowerCase())) return false;
    return true;
  });
  if (!rows.length) { list.innerHTML = '<div class="small-muted">No se encontraron preguntas.</div>'; return; }
  list.innerHTML = rows.map((q, idx)=>`
    <div class="question-preview">
      <strong>${escapeHtml(q.title)}</strong>
      <div class="small-muted">Tipo: ${q.type || '—'} — Asignatura: ${escapeHtml(q.subject||'')} — Grado: ${escapeHtml(q.grade||'')}</div>
      ${q.image ? `<img src="${q.image}" class="img-thumb" />` : ''}
      <div style="margin-top:6px;">
        <button class="btn btn-add-bank" data-idx="${idx}">Añadir a prueba</button>
        <button class="btn btn-edit-bank" data-idx="${idx}">Editar</button>
      </div>
    </div>
  `).join('');
  // events
  list.querySelectorAll('.btn-add-bank').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const idx = e.currentTarget.dataset.idx*1;
      openChooseTestModalForBank(idx);
    });
  });
  list.querySelectorAll('.btn-edit-bank').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const idx = e.currentTarget.dataset.idx*1;
      editBankQuestion(idx);
    });
  });
}

// filtros
$('btnFilterBank')?.addEventListener('click', ()=>{
  renderBank({
    title: $('bankFilterTitle').value.trim(),
    subject: $('bankFilterSubject').value.trim(),
    grade: $('bankFilterGrade').value.trim(),
    topic: $('bankFilterTopic').value.trim()
  });
});
$('btnClearBankFilter')?.addEventListener('click', ()=>{
  $('bankFilterTitle').value = $('bankFilterSubject').value = $('bankFilterGrade').value = $('bankFilterTopic').value = '';
  renderBank();
});

// modal seleccionar prueba destino
function openChooseTestModalForBank(bankIdx){
  const modal = $('modalChooseTest');
  const list = $('modalTestsList');
  list.innerHTML = (tests.tests||[]).map(t => `<div style="margin-bottom:6px;">
    <strong>${escapeHtml(t.name)}</strong> — ${t.code}
    <div class="row" style="margin-top:6px;">
      <button class="btn modal-choose-test" data-code="${t.code}">Seleccionar</button>
    </div>
  </div>`).join('');
  modal.classList.add('open');
  modal.querySelectorAll('.modal-choose-test').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const code = btn.dataset.code;
      const t = tests.tests.find(x=>x.code===code);
      if (!t) { alert('Prueba no encontrada'); return; }
      t.questions = t.questions || [];
      const q = JSON.parse(JSON.stringify(bank.questions[bankIdx])); // clone
      t.questions.push(q);
      localStorage.setItem('tests_storage', JSON.stringify(tests));
      modal.classList.remove('open');
      alert('Pregunta añadida a la prueba.');
      renderTests();
    });
  });
  $('modalClose').onclick = ()=>modal.classList.remove('open');
}

// editar pregunta del banco -> usa el modal de pregunta del editor
function editBankQuestion(idx){
  const q = bank.questions[idx];
  activeQuestionIndex = null;
  showQuestionModal(q);
  // al guardar en modal, sobreescribiremos en banco (ajusta showQuestionModal guardar)
  // para simplicidad he usado la misma lógica que en editor; después del guardado, actualizamos banco
  // Nota: al guardar, la función que guarda añade la pregunta en editingTest; aquí hacemos override manual:
  // Para manejarlo sin duplicar código, pedimos al usuario corregir manualmente en el banco UI por ahora.
  alert('Nota: la edición directa del banco usa el modal de creación. Tras guardar la pregunta en el editor, cópiala manualmente al banco (implementación completa en próxima iteración).');
}

// importar/export banco
function importBankJson(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try {
      const obj = JSON.parse(e.target.result);
      if (obj.questions) {
        bank = obj;
      } else if (Array.isArray(obj)) {
        bank = { questions: obj };
      } else {
        throw new Error('JSON inválido');
      }
      localStorage.setItem('bank_storage', JSON.stringify(bank));
      renderBank();
      alert('Banco importado.');
    } catch (err){ alert('JSON inválido para banco.'); }
  };
  reader.readAsText(file);
}
$('btnImportBank')?.addEventListener('click', ()=> {
  const input = document.createElement('input'); input.type = 'file'; input.accept='.json';
  input.onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    importBankJson(f);
  };
  input.click();
});
$('btnExportBank')?.addEventListener('click', ()=> {
  const blob = new Blob([JSON.stringify(bank, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'banco_preguntas.json'; a.click();
});

// ======================
// Resultados: cargar y exportar
// ======================
$('btnLoadResultsFromLS')?.addEventListener('click', ()=>{
  try {
    const rs = JSON.parse(localStorage.getItem('results') || '[]');
    renderResultsList(rs);
  } catch(e){ alert('No hay resultados en localStorage.'); }
});
$('btnExportResultsJson')?.addEventListener('click', ()=>{
  const data = localStorage.getItem('results') || '[]';
  const blob = new Blob([data], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'results_all.json'; a.click();
});
$('btnExportResultsPdf')?.addEventListener('click', ()=>{
  const rs = JSON.parse(localStorage.getItem('results') || '[]');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y=30; doc.setFontSize(14); doc.text('Resultados', 20, y); y+=12; doc.setFontSize(10);
  rs.forEach((r,i)=>{
    if (y>760){ doc.addPage(); y=30; }
    doc.text(`${i+1}. ${r.test} — ${r.student} — ${r.timestamp} — Puntaje: ${r.score}`, 20, y); y+=8;
  });
  doc.save('results_all.pdf');
});

function renderResultsList(resultsArray){
  const out = $('resultsList');
  if (!resultsArray || !resultsArray.length) { out.innerHTML = '<div class="small-muted">No hay resultados.</div>'; return; }
  out.innerHTML = resultsArray.map((r, i) => `
    <div class="card">
      <strong>${i+1}. ${escapeHtml(r.test)} — ${escapeHtml(r.student)}</strong>
      <div class="small-muted">${r.timestamp} — Puntaje: ${r.score}</div>
      <div style="margin-top:6px;">
        <button class="btn" data-idx="${i}" onclick="viewResult(${i})">Ver</button>
        <button class="btn" data-idx="${i}" onclick="deleteResult(${i})">Eliminar</button>
      </div>
    </div>
  `).join('');
}
window.viewResult = function(i){
  const rs = JSON.parse(localStorage.getItem('results') || '[]');
  const r = rs[i];
  if (!r) return alert('Resultado no encontrado');
  // mostrar en modal simple
  alert(`Resultado: ${r.test}\nEstudiante: ${r.student}\nPuntaje: ${r.score}\nDetalles: ${JSON.stringify(r.details || []).slice(0,800)}`);
};
window.deleteResult = function(i){
  if (!confirm('Eliminar resultado?')) return;
  const rs = JSON.parse(localStorage.getItem('results') || '[]');
  rs.splice(i,1);
  localStorage.setItem('results', JSON.stringify(rs));
  renderResultsList(rs);
}

// ======================
// Guía
// ======================
function renderGuideShort(){
  const el = $('guideShort');
  if (!guia || !guia.short) { el.textContent = 'Guía no disponible.'; return; }
  el.textContent = guia.short;
}
$('btnOpenGuide')?.addEventListener('click', ()=>{
  if (!guia || !guia.full) { alert('Guía no disponible.'); return; }
  let modal = document.querySelector('#guideModal');
  if (!modal) {
    modal = document.createElement('div'); modal.id='guideModal'; modal.className='modal';
    modal.innerHTML = `<div class="card" style="max-width:900px;"><h3>Guía completa</h3><div id="guideContent" style="max-height:560px; overflow:auto;"></div><div style="margin-top:8px;" class="row"><button id="closeGuide" class="btn">Cerrar</button></div></div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#guideContent').innerHTML = `<pre style="white-space:pre-wrap;">${escapeHtml(guia.full)}</pre>`;
  modal.classList.add('open');
  modal.querySelector('#closeGuide').onclick = ()=>modal.classList.remove('open');
});

// ======================
// Unblock students
// ======================

function renderBlocked(){
  const div = $('blockedList');
  const blocked = JSON.parse(localStorage.getItem('blockedStudents') || '[]');
  if (!blocked.length) { div.innerHTML = '<div class="small-muted">No hay estudiantes bloqueados.</div>'; return; }
  div.innerHTML = blocked.map((b,i)=>`
    <div class="card">
      <strong>${escapeHtml(b.name)}</strong> — ${escapeHtml(b.code)}
      <div style="margin-top:6px;">
        <button class="btn" onclick="unblockStudent(${i})">Desbloquear</button>
      </div>
    </div>
  `).join('');
}
window.unblockStudent = function(i){
  let blocked = JSON.parse(localStorage.getItem('blockedStudents') || '[]');
  blocked.splice(i,1);
  localStorage.setItem('blockedStudents', JSON.stringify(blocked));
  renderBlocked();
};

// ======================
// Helpers
// ======================
function escapeHtml(s){ if (!s && s !== 0) return ''; return String(s).replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

// ======================
// Event listeners iniciales
// ======================
window.addEventListener('DOMContentLoaded', async ()=>{
  await loadInitialData();
  // enlazar botones
  $('btnLogin')?.addEventListener('click', login);
  $('btnLogout')?.addEventListener('click', logout);
  $('btnNewTest')?.addEventListener('click', ()=> { editingTest = { name:'Nueva prueba', time:30, points:{ok:1,bad:0}, questions:[] }; showPanelSection('editor'); renderQuestionsEditor(); });
  $('btnSaveTest')?.addEventListener('click', saveTest);
  $('btnCancelEdit')?.addEventListener('click', ()=> showPanelSection('tests'));
  $('btnExportAllJson')?.addEventListener('click', exportAllJson);
  $('btnExportAllPdf')?.addEventListener('click', exportAllPdf);
  $('btnSaveJSON')?.addEventListener('click', saveTestsToLocalStorage);
  $('fileImport')?.addEventListener('change', (e)=> handleFileImport(e.target.files[0]));
  $('btnLoadResultsFromLS')?.addEventListener('click', ()=>{ const rs = JSON.parse(localStorage.getItem('results') || '[]'); renderResultsList(rs); });
  // export results
  $('btnExportResultsJson')?.addEventListener('click', ()=> {
    const data = localStorage.getItem('results') || '[]';
    const blob = new Blob([data], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'results_all.json'; a.click();
  });

  $('btnExportResultsPdf')?.addEventListener('click', ()=> {
    const rs = JSON.parse(localStorage.getItem('results') || '[]');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y=30; doc.setFontSize(14); doc.text('Resultados', 20, y); y+=12;
    rs.forEach((r,i)=>{
      if (y>270){ doc.addPage(); y=30; }
      doc.setFontSize(10); doc.text(`${i+1}. ${r.test} - ${r.student} - Puntaje: ${r.score}`, 20, y); y+=8;
    });
    doc.save('results_all.pdf');
  });
  // file import
  $('fileImport')?.addEventListener('change', (e)=> handleFileImport(e.target.files[0]));
  // nav
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', ()=> showPanelSection(btn.dataset.section)));
  // inicial render
  renderTests(); renderBank(); renderGuideShort(); renderBlocked();
});

// hago accesibles algunas funciones globales para botones inline
window.editTest = editTest;
window.exportSingleTestJson = exportSingleTestJson;
window.exportSingleTestPdf = exportSingleTestPdf;
window.promptDeleteTest = promptDeleteTest;
