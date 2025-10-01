export default function Sidebar({ onToggleGridMode, onToggleGridVisibility, onChangeConnectionMode, onToggleLabels }) {
  return (
    <div className="fixed top-0 left-0 h-full w-64 bg-neutral-900 text-white shadow-lg p-4 space-y-4">
      <h2 className="text-xl font-bold mb-4">Controls</h2>

      <button
        onClick={onToggleGridMode}
        className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
      >
        Toggle Grid Mode
      </button>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          defaultChecked={true}
          onChange={onToggleGridVisibility}
          id="show-grid-checkbox"
          className="form-checkbox"
        />
        <label htmlFor="show-grid-checkbox">Show Grid</label>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          defaultChecked={true}
          onChange={onToggleLabels}
          id="show-labels-checkbox"
          className="form-checkbox"
        />
        <label htmlFor="show-labels-checkbox">Show Labels</label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            name="connection-mode"
            id="show-stalks-radio"
            className="form-radio"
            onChange={() => onChangeConnectionMode('stalks')}
          />
          <label htmlFor="show-stalks-radio">Show Stalks</label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            name="connection-mode"
            id="show-connections-radio"
            defaultChecked={true}
            className="form-radio"
            onChange={() => onChangeConnectionMode('connections')}
          />
          <label htmlFor="show-connections-radio">Show Connections</label>
        </div>
      </div>
      
    </div>
  );
}