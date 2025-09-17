// Utilidades generales para E-valua
class Utils {
  // Formatear fecha
  static formatDate(date) {
    if (!date) return "N/A"
    const d = new Date(date)
    return d.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Formatear duración en minutos
  static formatDuration(minutes) {
    if (!minutes) return "0 min"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return `${hours}h ${mins}min`
    }
    return `${mins} min`
  }

  // Generar ID único
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Validar email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Escapar HTML
  static escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  // Calcular porcentaje
  static calculatePercentage(value, total) {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  // Obtener color según porcentaje
  static getScoreColor(percentage) {
    if (percentage >= 90) return "#27ae60"
    if (percentage >= 80) return "#f39c12"
    if (percentage >= 70) return "#e67e22"
    return "#e74c3c"
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // Mostrar notificación
  static showNotification(message, type = "info") {
    // Crear elemento de notificación
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `

    // Agregar estilos si no existen
    if (!document.getElementById("notification-styles")) {
      const styles = document.createElement("style")
      styles.id = "notification-styles"
      styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 5px;
                    color: white;
                    z-index: 10000;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                .notification-info { background: #3498db; }
                .notification-success { background: #27ae60; }
                .notification-warning { background: #f39c12; }
                .notification-error { background: #e74c3c; }
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    float: right;
                    margin-left: 10px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `
      document.head.appendChild(styles)
    }

    document.body.appendChild(notification)

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, 5000)
  }

  // Exportar datos a CSV
  static exportToCSV(data, filename) {
    const csvContent = this.arrayToCSV(data)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", filename)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Convertir array a CSV
  static arrayToCSV(data) {
    if (!data.length) return ""

    const headers = Object.keys(data[0])
    const csvRows = []

    // Agregar headers
    csvRows.push(headers.join(","))

    // Agregar datos
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header]
        return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
      })
      csvRows.push(values.join(","))
    }

    return csvRows.join("\n")
  }

  // Validar contraseña fuerte
  static isStrongPassword(password) {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
  }

  // Obtener información del dispositivo
  static getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timestamp: new Date().toISOString(),
    }
  }

  // Verificar si está en modo offline
  static isOffline() {
    return !navigator.onLine
  }

  // Comprimir imagen
  static compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(resolve, "image/jpeg", quality)
      }

      img.src = URL.createObjectURL(file)
    })
  }
}

// Hacer disponible globalmente
window.Utils = Utils
