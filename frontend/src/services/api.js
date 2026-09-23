// The only file in this app allowed to call fetch(). Every screen goes
// through here so backend field names and transport concerns never leak
// into components.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TIMEOUT_MS = 8000

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out — is the backend running on port 8000?', 0)
    }
    throw new ApiError('Cannot reach the backend. Is uvicorn running on port 8000?', 0)
  }
  clearTimeout(timeout)

  if (response.status === 204) return null

  const isPdf = response.headers.get('content-type')?.includes('application/pdf')
  if (isPdf) {
    if (!response.ok) throw new ApiError('Failed to generate report', response.status)
    return response.blob()
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // no JSON body
  }

  if (!response.ok) {
    const message = body?.detail || `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }

  return body
}

const get = (path) => request(path)
const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data ?? {}) })
const patch = (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) })

export const api = {
  // health
  health: () => get('/health'),

  // stations
  listStations: () => get('/stations'),

  // expeditions
  listExpeditions: () => get('/expeditions'),
  createExpedition: (data) => post('/expeditions', data),
  getExpedition: (id) => get(`/expeditions/${id}`),
  updateExpedition: (id, data) => patch(`/expeditions/${id}`, data),

  // cargo
  listCargo: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/cargo${qs ? `?${qs}` : ''}`)
  },
  createCargo: (data) => post('/cargo', data),
  updateCargo: (id, data) => patch(`/cargo/${id}`, data),

  // inventory
  listInventory: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/inventory${qs ? `?${qs}` : ''}`)
  },
  createInventoryItem: (data) => post('/inventory', data),
  adjustInventory: (id, data) => patch(`/inventory/${id}/adjust`, data),
  inventoryAlerts: () => get('/inventory/alerts'),

  // personnel
  listPersonnel: () => get('/personnel'),
  createPersonnel: (data) => post('/personnel', data),
  checkin: (id) => post(`/personnel/${id}/checkin`),

  // emergency
  listEmergency: () => get('/emergency'),
  raiseEmergency: (data) => post('/emergency', data),
  updateEmergency: (id, data) => patch(`/emergency/${id}`, data),

  // assets
  listAssets: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/assets${qs ? `?${qs}` : ''}`)
  },
  createAsset: (data) => post('/assets', data),
  pushTelemetry: (id, data) => patch(`/assets/${id}/telemetry`, data),

  // alerts
  getAlerts: () => get('/alerts'),

  // audit log
  getAuditLog: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/audit-log${qs ? `?${qs}` : ''}`)
  },

  // dashboard
  getDashboardSummary: () => get('/dashboard/summary'),

  // assistant
  askAssistant: (question) => post('/assistant/query', { question }),

  // reports
  getSituationReportBlob: () => get('/reports/situation'),
}

export { ApiError }
