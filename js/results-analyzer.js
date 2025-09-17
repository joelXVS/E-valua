class ResultsAnalyzer {
    constructor() {
        this.currentResults = [];
        this.filteredResults = [];
        this.currentTest = null;
        this.init();
    }

    init() {
        this.loadResults();
        this.setupEventListeners();
        this.renderTestSelector();
    }

    setupEventListeners() {
        // Selector de prueba
        document.getElementById('test-selector')?.addEventListener('change', (e) => {
            this.selectTest(e.target.value);
        });

        // Filtros
        document.getElementById('student-filter')?.addEventListener('input', (e) => {
            this.applyFilters();
        });

        document.getElementById('grade-filter')?.addEventListener('change', (e) => {
            this.applyFilters();
        });

        document.getElementById('date-filter')?.addEventListener('change', (e) => {
            this.applyFilters();
        });

        // Botones de exportación
        document.getElementById('export-excel')?.addEventListener('click', () => {
            this.exportToExcel();
        });

        document.getElementById('export-pdf')?.addEventListener('click', () => {
            this.exportToPDF();
        });

        // Botón de estadísticas detalladas
        document.getElementById('detailed-stats')?.addEventListener('click', () => {
            this.showDetailedStats();
        });
    }

    loadResults() {
        try {
            const results = JSON.parse(localStorage.getItem('resultados') || '[]');
            this.currentResults = results;
            this.filteredResults = [...results];
        } catch (error) {
            console.error('Error loading results:', error);
            this.currentResults = [];
            this.filteredResults = [];
        }
    }

    renderTestSelector() {
        const selector = document.getElementById('test-selector');
        if (!selector) return;

        const tests = JSON.parse(localStorage.getItem('pruebas') || '[]');
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        // Filtrar pruebas del docente actual
        const userTests = tests.filter(test => test.createdBy === currentUser.id);

        selector.innerHTML = '<option value="">Seleccionar prueba...</option>';
        userTests.forEach(test => {
            const option = document.createElement('option');
            option.value = test.id;
            option.textContent = `${test.title} - ${test.subject}`;
            selector.appendChild(option);
        });
    }

    selectTest(testId) {
        if (!testId) {
            this.currentTest = null;
            this.renderResults([]);
            return;
        }

        const tests = JSON.parse(localStorage.getItem('pruebas') || '[]');
        this.currentTest = tests.find(test => test.id === testId);
        
        // Filtrar resultados de la prueba seleccionada
        const testResults = this.currentResults.filter(result => result.testId === testId);
        this.filteredResults = testResults;
        
        this.renderResults(testResults);
        this.renderStatistics(testResults);
        this.renderQuestionAnalysis(testResults);
    }

    applyFilters() {
        if (!this.currentTest) return;

        const studentFilter = document.getElementById('student-filter')?.value.toLowerCase() || '';
        const gradeFilter = document.getElementById('grade-filter')?.value || '';
        const dateFilter = document.getElementById('date-filter')?.value || '';

        let filtered = this.currentResults.filter(result => result.testId === this.currentTest.id);

        // Filtro por estudiante
        if (studentFilter) {
            filtered = filtered.filter(result => 
                result.studentName.toLowerCase().includes(studentFilter) ||
                result.studentId.toLowerCase().includes(studentFilter)
            );
        }

        // Filtro por calificación
        if (gradeFilter) {
            const [min, max] = gradeFilter.split('-').map(Number);
            filtered = filtered.filter(result => {
                const grade = (result.score / result.totalQuestions) * 100;
                return grade >= min && grade <= max;
            });
        }

        // Filtro por fecha
        if (dateFilter) {
            const filterDate = new Date(dateFilter);
            filtered = filtered.filter(result => {
                const resultDate = new Date(result.completedAt);
                return resultDate.toDateString() === filterDate.toDateString();
            });
        }

        this.filteredResults = filtered;
        this.renderResults(filtered);
        this.renderStatistics(filtered);
    }

    renderResults(results) {
        const container = document.getElementById('results-table');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = '<p class="no-results">No hay resultados para mostrar</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'results-table';
        
        // Encabezados
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Estudiante</th>
                    <th>ID</th>
                    <th>Puntuación</th>
                    <th>Porcentaje</th>
                    <th>Tiempo</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => this.renderResultRow(result)).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);
    }

    renderResultRow(result) {
        const percentage = ((result.score / result.totalQuestions) * 100).toFixed(1);
        const timeSpent = this.formatTime(result.timeSpent);
        const completedDate = new Date(result.completedAt).toLocaleDateString();
        
        const gradeClass = this.getGradeClass(percentage);

        return `
            <tr>
                <td>${result.studentName}</td>
                <td>${result.studentId}</td>
                <td>${result.score}/${result.totalQuestions}</td>
                <td class="${gradeClass}">${percentage}%</td>
                <td>${timeSpent}</td>
                <td>${completedDate}</td>
                <td>
                    <button onclick="resultsAnalyzer.viewDetailedResult('${result.id}')" class="btn-view">
                        Ver Detalle
                    </button>
                </td>
            </tr>
        `;
    }

    getGradeClass(percentage) {
        if (percentage >= 90) return 'grade-excellent';
        if (percentage >= 80) return 'grade-good';
        if (percentage >= 70) return 'grade-average';
        if (percentage >= 60) return 'grade-below-average';
        return 'grade-poor';
    }

    renderStatistics(results) {
        const container = document.getElementById('statistics-summary');
        if (!container || results.length === 0) return;

        const stats = this.calculateStatistics(results);
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Estudiantes</h3>
                    <div class="stat-value">${stats.totalStudents}</div>
                </div>
                <div class="stat-card">
                    <h3>Promedio General</h3>
                    <div class="stat-value">${stats.averageScore.toFixed(1)}%</div>
                </div>
                <div class="stat-card">
                    <h3>Puntuación Más Alta</h3>
                    <div class="stat-value">${stats.highestScore.toFixed(1)}%</div>
                </div>
                <div class="stat-card">
                    <h3>Puntuación Más Baja</h3>
                    <div class="stat-value">${stats.lowestScore.toFixed(1)}%</div>
                </div>
                <div class="stat-card">
                    <h3>Tiempo Promedio</h3>
                    <div class="stat-value">${this.formatTime(stats.averageTime)}</div>
                </div>
                <div class="stat-card">
                    <h3>Tasa de Aprobación</h3>
                    <div class="stat-value">${stats.passRate.toFixed(1)}%</div>
                </div>
            </div>
            <div class="grade-distribution">
                <h3>Distribución de Calificaciones</h3>
                <div class="distribution-bars">
                    ${this.renderGradeDistribution(stats.gradeDistribution)}
                </div>
            </div>
        `;
    }

    calculateStatistics(results) {
        if (results.length === 0) return {};

        const scores = results.map(r => (r.score / r.totalQuestions) * 100);
        const times = results.map(r => r.timeSpent);
        
        const totalStudents = results.length;
        const averageScore = scores.reduce((a, b) => a + b, 0) / totalStudents;
        const highestScore = Math.max(...scores);
        const lowestScore = Math.min(...scores);
        const averageTime = times.reduce((a, b) => a + b, 0) / totalStudents;
        const passRate = (scores.filter(score => score >= 60).length / totalStudents) * 100;

        // Distribución de calificaciones
        const gradeDistribution = {
            'A (90-100%)': scores.filter(s => s >= 90).length,
            'B (80-89%)': scores.filter(s => s >= 80 && s < 90).length,
            'C (70-79%)': scores.filter(s => s >= 70 && s < 80).length,
            'D (60-69%)': scores.filter(s => s >= 60 && s < 70).length,
            'F (0-59%)': scores.filter(s => s < 60).length
        };

        return {
            totalStudents,
            averageScore,
            highestScore,
            lowestScore,
            averageTime,
            passRate,
            gradeDistribution
        };
    }

    renderGradeDistribution(distribution) {
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        if (total === 0) return '';

        return Object.entries(distribution).map(([grade, count]) => {
            const percentage = (count / total) * 100;
            return `
                <div class="distribution-bar">
                    <div class="bar-label">${grade}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${percentage}%"></div>
                        <span class="bar-count">${count}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderQuestionAnalysis(results) {
        const container = document.getElementById('question-analysis');
        if (!container || !this.currentTest || results.length === 0) return;

        const analysis = this.analyzeQuestions(results);
        
        container.innerHTML = `
            <h3>Análisis por Pregunta</h3>
            <div class="question-stats">
                ${analysis.map((q, index) => `
                    <div class="question-stat">
                        <h4>Pregunta ${index + 1}</h4>
                        <p class="question-text">${q.question}</p>
                        <div class="question-metrics">
                            <span class="metric">
                                <strong>Correctas:</strong> ${q.correct}/${results.length} (${q.correctPercentage.toFixed(1)}%)
                            </span>
                            <span class="metric difficulty-${q.difficulty}">
                                <strong>Dificultad:</strong> ${q.difficultyLabel}
                            </span>
                        </div>
                        ${q.type === 'multiple-choice' ? this.renderAnswerDistribution(q.answerDistribution) : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    analyzeQuestions(results) {
        if (!this.currentTest) return [];

        return this.currentTest.questions.map((question, qIndex) => {
            const correct = results.filter(result => {
                const answer = result.answers[qIndex];
                return this.isAnswerCorrect(question, answer);
            }).length;

            const correctPercentage = (correct / results.length) * 100;
            
            let difficulty, difficultyLabel;
            if (correctPercentage >= 80) {
                difficulty = 'easy';
                difficultyLabel = 'Fácil';
            } else if (correctPercentage >= 60) {
                difficulty = 'medium';
                difficultyLabel = 'Medio';
            } else {
                difficulty = 'hard';
                difficultyLabel = 'Difícil';
            }

            const analysis = {
                question: question.question,
                type: question.type,
                correct,
                correctPercentage,
                difficulty,
                difficultyLabel
            };

            // Análisis de distribución de respuestas para preguntas de opción múltiple
            if (question.type === 'multiple-choice') {
                const answerDistribution = {};
                question.options.forEach((option, optIndex) => {
                    answerDistribution[optIndex] = results.filter(result => 
                        result.answers[qIndex] === optIndex
                    ).length;
                });
                analysis.answerDistribution = answerDistribution;
            }

            return analysis;
        });
    }

    renderAnswerDistribution(distribution) {
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        if (total === 0) return '';

        return `
            <div class="answer-distribution">
                <h5>Distribución de Respuestas:</h5>
                ${Object.entries(distribution).map(([optionIndex, count]) => {
                    const percentage = (count / total) * 100;
                    return `
                        <div class="answer-bar">
                            <span>Opción ${String.fromCharCode(65 + parseInt(optionIndex))}</span>
                            <div class="bar">
                                <div class="fill" style="width: ${percentage}%"></div>
                                <span>${count} (${percentage.toFixed(1)}%)</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    isAnswerCorrect(question, answer) {
        switch (question.type) {
            case 'multiple-choice':
                return answer === question.correctAnswer;
            case 'multiple-response':
                if (!Array.isArray(answer) || !Array.isArray(question.correctAnswers)) return false;
                return JSON.stringify(answer.sort()) === JSON.stringify(question.correctAnswers.sort());
            case 'true-false':
                return answer === question.correctAnswer;
            case 'open-ended':
                // Para respuestas abiertas, se requiere revisión manual
                return question.manualGrading ? answer.manualScore > 0 : false;
            default:
                return false;
        }
    }

    viewDetailedResult(resultId) {
        const result = this.currentResults.find(r => r.id === resultId);
        if (!result) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content detailed-result">
                <div class="modal-header">
                    <h2>Resultado Detallado - ${result.studentName}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="result-summary">
                        <div class="summary-item">
                            <strong>Puntuación:</strong> ${result.score}/${result.totalQuestions} (${((result.score/result.totalQuestions)*100).toFixed(1)}%)
                        </div>
                        <div class="summary-item">
                            <strong>Tiempo:</strong> ${this.formatTime(result.timeSpent)}
                        </div>
                        <div class="summary-item">
                            <strong>Fecha:</strong> ${new Date(result.completedAt).toLocaleString()}
                        </div>
                    </div>
                    <div class="detailed-answers">
                        ${this.renderDetailedAnswers(result)}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners para el modal
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    renderDetailedAnswers(result) {
        if (!this.currentTest) return '';

        return this.currentTest.questions.map((question, index) => {
            const userAnswer = result.answers[index];
            const isCorrect = this.isAnswerCorrect(question, userAnswer);
            
            return `
                <div class="answer-detail ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="question-header">
                        <h4>Pregunta ${index + 1} ${isCorrect ? '✓' : '✗'}</h4>
                        <span class="points">${isCorrect ? question.points : 0}/${question.points} pts</span>
                    </div>
                    <p class="question-text">${question.question}</p>
                    ${this.renderAnswerComparison(question, userAnswer)}
                </div>
            `;
        }).join('');
    }

    renderAnswerComparison(question, userAnswer) {
        switch (question.type) {
            case 'multiple-choice':
                return `
                    <div class="answer-comparison">
                        <div class="user-answer">
                            <strong>Respuesta del estudiante:</strong> 
                            ${userAnswer !== undefined ? question.options[userAnswer] : 'Sin respuesta'}
                        </div>
                        <div class="correct-answer">
                            <strong>Respuesta correcta:</strong> 
                            ${question.options[question.correctAnswer]}
                        </div>
                    </div>
                `;
            case 'multiple-response':
                const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
                return `
                    <div class="answer-comparison">
                        <div class="user-answer">
                            <strong>Respuestas del estudiante:</strong>
                            <ul>
                                ${userAnswers.map(idx => `<li>${question.options[idx]}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="correct-answer">
                            <strong>Respuestas correctas:</strong>
                            <ul>
                                ${question.correctAnswers.map(idx => `<li>${question.options[idx]}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            case 'true-false':
                return `
                    <div class="answer-comparison">
                        <div class="user-answer">
                            <strong>Respuesta del estudiante:</strong> 
                            ${userAnswer !== undefined ? (userAnswer ? 'Verdadero' : 'Falso') : 'Sin respuesta'}
                        </div>
                        <div class="correct-answer">
                            <strong>Respuesta correcta:</strong> 
                            ${question.correctAnswer ? 'Verdadero' : 'Falso'}
                        </div>
                    </div>
                `;
            case 'open-ended':
                return `
                    <div class="answer-comparison">
                        <div class="user-answer">
                            <strong>Respuesta del estudiante:</strong>
                            <p>${userAnswer || 'Sin respuesta'}</p>
                        </div>
                        <div class="sample-answer">
                            <strong>Respuesta modelo:</strong>
                            <p>${question.sampleAnswer || 'No disponible'}</p>
                        </div>
                    </div>
                `;
            default:
                return '';
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    exportToExcel() {
        if (this.filteredResults.length === 0) {
            alert('No hay resultados para exportar');
            return;
        }

        // Crear datos para Excel
        const data = [
            ['Estudiante', 'ID', 'Puntuación', 'Porcentaje', 'Tiempo', 'Fecha']
        ];

        this.filteredResults.forEach(result => {
            const percentage = ((result.score / result.totalQuestions) * 100).toFixed(1);
            const timeSpent = this.formatTime(result.timeSpent);
            const completedDate = new Date(result.completedAt).toLocaleDateString();
            
            data.push([
                result.studentName,
                result.studentId,
                `${result.score}/${result.totalQuestions}`,
                `${percentage}%`,
                timeSpent,
                completedDate
            ]);
        });

        // Convertir a CSV (simulando Excel)
        const csvContent = data.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `resultados_${this.currentTest?.title || 'prueba'}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        window.URL.revokeObjectURL(url);
    }

    exportToPDF() {
        if (this.filteredResults.length === 0) {
            alert('No hay resultados para exportar');
            return;
        }

        // Crear contenido HTML para PDF
        const stats = this.calculateStatistics(this.filteredResults);
        const htmlContent = `
            <html>
            <head>
                <title>Reporte de Resultados - ${this.currentTest?.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
                    .stat-card { border: 1px solid #ddd; padding: 15px; text-align: center; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Reporte de Resultados</h1>
                    <h2>${this.currentTest?.title} - ${this.currentTest?.subject}</h2>
                    <p>Generado el: ${new Date().toLocaleDateString()}</p>
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <h3>Total Estudiantes</h3>
                        <div>${stats.totalStudents}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Promedio General</h3>
                        <div>${stats.averageScore.toFixed(1)}%</div>
                    </div>
                    <div class="stat-card">
                        <h3>Tasa de Aprobación</h3>
                        <div>${stats.passRate.toFixed(1)}%</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Estudiante</th>
                            <th>ID</th>
                            <th>Puntuación</th>
                            <th>Porcentaje</th>
                            <th>Tiempo</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredResults.map(result => {
                            const percentage = ((result.score / result.totalQuestions) * 100).toFixed(1);
                            const timeSpent = this.formatTime(result.timeSpent);
                            const completedDate = new Date(result.completedAt).toLocaleDateString();
                            
                            return `
                                <tr>
                                    <td>${result.studentName}</td>
                                    <td>${result.studentId}</td>
                                    <td>${result.score}/${result.totalQuestions}</td>
                                    <td>${percentage}%</td>
                                    <td>${timeSpent}</td>
                                    <td>${completedDate}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        // Abrir en nueva ventana para imprimir/guardar como PDF
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    }

    showDetailedStats() {
        if (!this.currentTest || this.filteredResults.length === 0) return;

        const stats = this.calculateStatistics(this.filteredResults);
        const questionAnalysis = this.analyzeQuestions(this.filteredResults);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content detailed-stats">
                <div class="modal-header">
                    <h2>Estadísticas Detalladas - ${this.currentTest.title}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="stats-section">
                        <h3>Resumen General</h3>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <label>Total de Estudiantes:</label>
                                <span>${stats.totalStudents}</span>
                            </div>
                            <div class="stat-item">
                                <label>Promedio General:</label>
                                <span>${stats.averageScore.toFixed(2)}%</span>
                            </div>
                            <div class="stat-item">
                                <label>Mediana:</label>
                                <span>${this.calculateMedian(this.filteredResults).toFixed(2)}%</span>
                            </div>
                            <div class="stat-item">
                                <label>Desviación Estándar:</label>
                                <span>${this.calculateStandardDeviation(this.filteredResults).toFixed(2)}</span>
                            </div>
                            <div class="stat-item">
                                <label>Puntuación Más Alta:</label>
                                <span>${stats.highestScore.toFixed(1)}%</span>
                            </div>
                            <div class="stat-item">
                                <label>Puntuación Más Baja:</label>
                                <span>${stats.lowestScore.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    <div class="stats-section">
                        <h3>Análisis de Dificultad por Pregunta</h3>
                        <div class="question-difficulty">
                            ${questionAnalysis.map((q, index) => `
                                <div class="difficulty-item">
                                    <span class="question-num">P${index + 1}</span>
                                    <div class="difficulty-bar">
                                        <div class="difficulty-fill difficulty-${q.difficulty}" 
                                             style="width: ${q.correctPercentage}%"></div>
                                    </div>
                                    <span class="difficulty-percent">${q.correctPercentage.toFixed(1)}%</span>
                                    <span class="difficulty-label">${q.difficultyLabel}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="stats-section">
                        <h3>Distribución de Tiempo</h3>
                        <div class="time-stats">
                            <div class="stat-item">
                                <label>Tiempo Promedio:</label>
                                <span>${this.formatTime(stats.averageTime)}</span>
                            </div>
                            <div class="stat-item">
                                <label>Tiempo Mínimo:</label>
                                <span>${this.formatTime(Math.min(...this.filteredResults.map(r => r.timeSpent)))}</span>
                            </div>
                            <div class="stat-item">
                                <label>Tiempo Máximo:</label>
                                <span>${this.formatTime(Math.max(...this.filteredResults.map(r => r.timeSpent)))}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    calculateMedian(results) {
        const scores = results.map(r => (r.score / r.totalQuestions) * 100).sort((a, b) => a - b);
        const mid = Math.floor(scores.length / 2);
        return scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
    }

    calculateStandardDeviation(results) {
        const scores = results.map(r => (r.score / r.totalQuestions) * 100);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
        return Math.sqrt(variance);
    }
}

// Inicializar el analizador de resultados
let resultsAnalyzer;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('results-analyzer')) {
        resultsAnalyzer = new ResultsAnalyzer();
    }
});
