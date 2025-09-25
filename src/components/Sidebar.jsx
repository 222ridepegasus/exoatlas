export default function Sidebar({ onToggleGrid }) {
  return (
    <div className="fixed top-0 left-0 h-full w-64 bg-neutral-900 text-white shadow-lg p-4 space-y-4">
      <h2 className="text-xl font-bold mb-4">Controls</h2>

      <button
        onClick={onToggleGrid}
        className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
      >
        Toggle Grid
      </button>
    </div>
  );
}