// ViolationModal.jsx
import React from "react";

const reasonLabel = {
  OUT_OF_METHOD_BODY: "메서드 밖 수정",
  IMPORT_ONLY_ALLOWED: "import만 허용", 
  CONTEXT_MISMATCH: "문맥 불일치",
  FILE_NOT_ALLOWED: "허용되지 않은 파일",
  MULTI_FILE_NOT_SUPPORTED: "다중 파일 미지원",
  SIGNATURE_MISMATCH: "시그니처 불일치",
};

export default function ViolationModal({ open, list, onClose }) {
  if (!open || !list?.length) return null;
  
  const handleJumpToAnchor = (violation) => {
    // 커스텀 이벤트를 통해 메인 패널에 앵커 포커스 요청
    window.dispatchEvent(new CustomEvent("focus-anchor", {
      detail: { 
        anchor: violation.anchor, 
        highlight: violation.attempted, 
        allowed: violation.allowed 
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-start justify-center p-6">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-lg p-6 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Guard 위반 {list.length}건
          </h3>
          <button 
            onClick={onClose} 
            className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-3 px-2 font-medium">사유</th>
                <th className="py-3 px-2 font-medium">앵커</th>
                <th className="py-3 px-2 font-medium">파일</th>
                <th className="py-3 px-2 font-medium">시도범위</th>
                <th className="py-3 px-2 font-medium">허용범위</th>
                <th className="py-3 px-2 font-medium">이동</th>
              </tr>
            </thead>
            <tbody>
              {list.map((violation, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <span className="inline-flex px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                      {reasonLabel[violation.reason] || violation.reason}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-xs font-mono text-blue-600 max-w-xs truncate" title={violation.anchor}>
                    {violation.anchor}
                  </td>
                  <td className="py-3 px-2 text-xs text-gray-600">
                    {violation.file}
                  </td>
                  <td className="py-3 px-2 text-xs">
                    {violation.attempted 
                      ? `${violation.attempted.start}~${violation.attempted.end}`
                      : "-"
                    }
                  </td>
                  <td className="py-3 px-2 text-xs">
                    {violation.allowed 
                      ? `${violation.allowed.start}~${violation.allowed.end}` 
                      : "-"
                    }
                  </td>
                  <td className="py-3 px-2">
                    <button
                      className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors"
                      onClick={() => handleJumpToAnchor(violation)}
                    >
                      이동
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            💡 <strong>도움말:</strong> "이동" 버튼을 클릭하면 해당 메서드 카드로 스크롤되며, 
            시도한 범위는 <span className="bg-red-100 px-1 rounded">빨간색</span>으로, 
            허용 범위는 <span className="bg-green-100 px-1 rounded">초록색</span>으로 하이라이트됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}