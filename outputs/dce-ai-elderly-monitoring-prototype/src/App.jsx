import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import DCEQuestion from './components/DCEQuestion'
import ResultModal from './components/ResultModal'
import SimulationModal from './components/SimulationModal'
import { SCHEMES } from './data/schemes'

function App() {
  const [selectedSchemeId, setSelectedSchemeId] = useState(null)
  const [simulationSchemeId, setSimulationSchemeId] = useState(null)
  const [isResultOpen, setIsResultOpen] = useState(false)
  const [isExperienceComplete, setIsExperienceComplete] = useState(false)

  const selectedScheme = selectedSchemeId ? SCHEMES[selectedSchemeId] : null
  const simulationScheme = simulationSchemeId ? SCHEMES[simulationSchemeId] : null

  function handleConfirm() {
    if (selectedSchemeId) {
      setIsResultOpen(true)
    }
  }

  function handleComplete() {
    setIsResultOpen(false)
    setIsExperienceComplete(true)
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {isExperienceComplete && (
          <div
            className="mb-5 flex items-start gap-3 rounded-2xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800 shadow-card"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>本次原型体验已完成。您的选择仅保留在当前页面，不会上传或提交。</p>
          </div>
        )}

        <DCEQuestion
          selectedSchemeId={selectedSchemeId}
          onSelectScheme={setSelectedSchemeId}
          onOpenSimulation={setSimulationSchemeId}
          onConfirm={handleConfirm}
        />
      </div>

      {simulationScheme && (
        <SimulationModal
          scheme={simulationScheme}
          onClose={() => setSimulationSchemeId(null)}
        />
      )}

      {isResultOpen && selectedScheme && (
        <ResultModal
          scheme={selectedScheme}
          onClose={() => setIsResultOpen(false)}
          onReselect={() => {
            setIsResultOpen(false)
            setSelectedSchemeId(null)
          }}
          onComplete={handleComplete}
        />
      )}
    </main>
  )
}

export default App
