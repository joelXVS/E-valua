// ======================
// Datos precargados
// ======================
import teachers from './teachers.json' assert { type: 'json' };
import tests from './tests.json' assert { type: 'json' };

// Variables
let currentTeacher = null;
let editingTest = null;

// ======================
// Utilidades
// ======================
function $(id) { return document.getElementById(id); }
function showPanelSection(name) {
  document.querySelectorAll('.panel-section').forEach(s => s.classList.add('hidden'));
  $(`panel-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.nav-btn[data-section="${name}"]`).classList.add('active');
}

// ======================
// Login
// ======================
function login() {
  const user = $('teacherUser').value.trim();
  const pass = $('teacherPass').value.trim();
  const found = teachers.find(t => t.user === user && t.pass === pass);
  if (!found) {
    alert('Usuario o contraseña incorrecta.');
    return;
  }
  currentTeacher = found;
  $('welcome').textContent = `Hola ${found.name}`;
  $('login').classList.add('hidden');
  $('panel').classList.remove('hidden');
  showPanelSection('tests');
  renderTests();
}

// ======================
// Logout
// ======================
function logout() {
  currentTeacher = null;
  location.reload();
}

// ======================
// Renderizar lista de pruebas
// ======================
function renderTests() {
  const div = $('testsList');
  div.innerHTML = tests.map(t => `
    <div class="card">
      <h5>${t.name}</h5>
      <p>Duración: ${t.time} min | Código: ${t.code}</p>
      <button class="btn" onclick="editTest('${t.code}')">Editar</button>
    </div>
  `).join('');
}

// ======================
// Editor de prueba
// ======================
function editTest(code) {
  editingTest = tests.find(t => t.code === code) || { questions: [], points: { ok: 1, bad: 0 } };
  $('editName').value = editingTest.name || '';
  $('editTime').value = editingTest.time || 0;
  $('editPtsOk').value = editingTest.points.ok || 1;
  $('editPtsBad').value = editingTest.points.bad || 0;
  $('editFrom').value = editingTest.from || '';
  $('editTo').value = editingTest.to || '';
  $('editShowRes').value = editingTest.showResults || 'true';
  $('editShowCorrect').value = editingTest.showCorrect || 'false';
  $('editGroups').value = (editingTest.groups || []).join(',');
  showPanelSection('editor');
}

function saveTest() {
  if (!editingTest) return;
  editingTest.name = $('editName').value.trim();
  editingTest.time = parseInt($('editTime').value) || 0;
  editingTest.points.ok = parseInt($('editPtsOk').value) || 1;
  editingTest.points.bad = parseInt($('editPtsBad').value) || 0;
  editingTest.from = $('editFrom').value;
  editingTest.to = $('editTo').value;
  editingTest.showResults = $('editShowRes').value === 'true';
  editingTest.showCorrect = $('editShowCorrect').value === 'true';
  editingTest.groups = $('editGroups').value ? $('editGroups').value.split(',').map(g => g.trim()) : [];

  if (!tests.find(t => t.code === editingTest.code)) {
    editingTest.code = `T-${Date.now()}`;
    tests.push(editingTest);
  }
  alert('Prueba guardada.');
  renderTests();
  showPanelSection('tests');
}

// ======================
// Crear docente Yolanda
// ======================
function createYolanda() {
  if (!teachers.find(t => t.user === 'yvalencia')) {
    teachers.push({
      name: 'Yolanda Valencia Valenzuela',
      user: 'yvalencia',
      pass: '@yvalencia',
      tests: []
    });
    $('settingsMsg').textContent = 'Docente Yolanda creada.';
  } else {
    $('settingsMsg').textContent = 'Docente Yolanda ya existe.';
  }
}

// ======================
// Enlazar prueba a Yolanda
// ======================
function linkCONS() {
  const consTest = tests.find(t => t.code === 'CONS-0801-P3');
  const yolanda = teachers.find(t => t.user === 'yvalencia');
  if (consTest && yolanda) {
    if (!yolanda.tests.includes(consTest.code)) {
      yolanda.tests.push(consTest.code);
    }
    $('settingsMsg').textContent = 'Prueba CONS-0801-P3 enlazada a Yolanda.';
  } else {
    $('settingsMsg').textContent = 'Error: prueba o docente no encontrados.';
  }
}

// ======================
// Eventos
// ======================
window.addEventListener('DOMContentLoaded', () => {
  $('btnLogin').addEventListener('click', login);
  $('btnLogout').addEventListener('click', logout);
  $('btnNewTest').addEventListener('click', () => editTest(null));
  $('btnSaveTest').addEventListener('click', saveTest);
  $('btnCancelEdit').addEventListener('click', () => showPanelSection('tests'));
  $('btnCreateYolanda').addEventListener('click', createYolanda);
  $('btnLinkCONS').addEventListener('click', linkCONS);
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPanelSection(btn.dataset.section));
  });
});

// Hacer funciones accesibles desde inline
window.editTest = editTest;
