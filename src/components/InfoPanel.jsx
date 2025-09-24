export default function InfoPanel({ star, onClose }) {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 bg-neutral-900 text-white shadow-lg transform transition-transform duration-300 ${
        star ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
        <h2 className="text-xl font-bold">Star Info</h2>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {star ? (
        <div className="p-4 space-y-2">
          <p>
            <span className="font-semibold">Name:</span> {star.name}
          </p>
          <p>
            <span className="font-semibold">Distance:</span> {star.distance} ly
          </p>
          <p>
            <span className="font-semibold">Type:</span> {star.type}
          </p>
        </div>
      ) : (
        <div className="p-4 text-neutral-500">Select a star…</div>
      )}
    </div>
  );
}