import { useState } from 'react'
import { Toaster } from 'sonner'
import { HeaderBar } from '@/components/HeaderBar'
import { Inspector } from '@/components/Inspector'
import { MindCanvas } from '@/components/MindCanvas'
import { useMindMap } from '@/hooks/useMindMap'

export default function Home() {
  const api = useMindMap()
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[rgb(245,246,242)]">
      <MindCanvas api={api} padRight={panelOpen ? 384 : 0} />
      <HeaderBar api={api} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />
      <Inspector api={api} open={panelOpen} />
      <Toaster position="bottom-center" toastOptions={{ style: { fontSize: 13 } }} />
    </div>
  )
}
