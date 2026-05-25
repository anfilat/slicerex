import { ExportProgress } from '../types';

interface Props {
  onExport: () => void;
  progress: ExportProgress;
}

export function ExportPanel({ onExport, progress }: Props) {
  const isExporting = progress.status === 'encoding';
  const isError = progress.status === 'error';

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-4">
        <button
          onClick={onExport}
          disabled={isExporting}
          className={`px-4 py-2 rounded text-white disabled:opacity-50 ${isError ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
        >
          {isExporting ? 'Exporting...' : isError ? 'Export failed — retry' : 'Export all'}
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
