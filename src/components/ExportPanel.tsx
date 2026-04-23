import { ExportProgress } from '../types';

interface Props {
  onExport: () => void;
  progress: ExportProgress;
}

export function ExportPanel({ onExport, progress }: Props) {
  const isExporting = progress.status === 'encoding';

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-4">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Export all'}
        </button>
        {isExporting && (
          <>
            <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">
              {progress.current}/{progress.total}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
