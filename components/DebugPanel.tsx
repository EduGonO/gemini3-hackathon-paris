"use client";

interface DebugInfo {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  rawTextLength?: number;
  rawTextPreview?: string;
  sceneCount?: number;
  ocrStatus?: string;
  parseStatus?: string;
  error?: string;
  log: string[];
}

interface Props {
  info: DebugInfo;
  onClose: () => void;
}

export default function DebugPanel({ info, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-gray-300 bg-gray-950 text-green-400 shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
          <span className="font-bold text-green-300">debug panel</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto p-4 space-y-3">

          {/* File info */}
          {info.fileName && (
            <section>
              <div className="text-gray-500 mb-1">— file —</div>
              <div>name: <span className="text-white">{info.fileName}</span></div>
              {info.fileSize !== undefined && (
                <div>size: <span className="text-white">{(info.fileSize / 1024).toFixed(1)} KB</span></div>
              )}
              {info.fileType && (
                <div>type: <span className="text-white">{info.fileType}</span></div>
              )}
            </section>
          )}

          {/* OCR status */}
          <section>
            <div className="text-gray-500 mb-1">— pipeline —</div>
            <div>
              ocr:{" "}
              <span className={info.ocrStatus === "ok" ? "text-green-300" : info.ocrStatus === "error" ? "text-red-400" : "text-gray-500"}>
                {info.ocrStatus ?? "idle"}
              </span>
            </div>
            <div>
              parse:{" "}
              <span className={info.parseStatus === "ok" ? "text-green-300" : info.parseStatus === "error" ? "text-red-400" : "text-gray-500"}>
                {info.parseStatus ?? "idle"}
              </span>
            </div>
            {info.rawTextLength !== undefined && (
              <div>text length: <span className="text-white">{info.rawTextLength.toLocaleString()} chars</span></div>
            )}
            {info.sceneCount !== undefined && (
              <div>scenes found: <span className="text-white">{info.sceneCount}</span></div>
            )}
          </section>

          {/* Error */}
          {info.error && (
            <section>
              <div className="text-red-400 mb-1">— error —</div>
              <div className="text-red-300 whitespace-pre-wrap">{info.error}</div>
            </section>
          )}

          {/* Raw text preview */}
          {info.rawTextPreview && (
            <section>
              <div className="text-gray-500 mb-1">— raw text preview —</div>
              <pre className="text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {info.rawTextPreview}
              </pre>
            </section>
          )}

          {/* Log */}
          {info.log.length > 0 && (
            <section>
              <div className="text-gray-500 mb-1">— log —</div>
              {info.log.map((entry, i) => (
                <div key={i} className="text-gray-400">{entry}</div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
