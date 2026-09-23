import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Expeditions from './pages/Expeditions'
import Cargo from './pages/Cargo'
import Inventory from './pages/Inventory'
import Personnel from './pages/Personnel'
import Emergency from './pages/Emergency'
import Assets from './pages/Assets'
import AuditLog from './pages/AuditLog'

function getPageFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('page') || 'dashboard'
}

const PAGES = {
  dashboard: Dashboard,
  expeditions: Expeditions,
  cargo: Cargo,
  inventory: Inventory,
  personnel: Personnel,
  emergency: Emergency,
  assets: Assets,
  audit: AuditLog,
}

export default function App() {
  const [page, setPage] = useState(getPageFromUrl())
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onPop = () => setPage(getPageFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const navigate = (nextPage) => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', nextPage)
    window.history.pushState({}, '', url)
    setPage(nextPage)
  }

  const Page = PAGES[page] || Dashboard

  return (
    <div className="flex min-h-screen bg-base-950">
      <Navbar current={page} onNavigate={navigate} online={online} />
      <main className="flex-1 min-w-0 px-6 py-6 md:px-8 md:py-8">
        <Page navigate={navigate} />
      </main>
    </div>
  )
}
