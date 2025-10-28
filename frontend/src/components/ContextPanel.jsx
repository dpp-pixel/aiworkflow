import React, { useState, useEffect } from "react";

const API = (window).__API_BASE__ ?? "";

export default function ContextPanel({ onRegisterRefresh }) {
  const [files, setFiles] = useState([]);
  const [selectedPrimary, setSelectedPrimary] = useState([]);
  const [selectedReference, setSelectedReference] = useState([]);
  const [preview, setPreview] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workspaceSet, setWorkspaceSet] = useState(false);

  // 새로고침 함수 등록
  useEffect(() => {
    const refresh = () => {
      loadFiles();
      loadRecipes();
    };
    onRegisterRefresh?.(refresh);
    refresh();
  }, []);

  // 파일 목록 로드
  const loadFiles = async () => {
    try {
      const res = await fetch(`${API}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        setWorkspaceSet(true);
      }
    } catch (error) {
      console.error("파일 로드 실패:", error);
      setWorkspaceSet(false);
    }
  };

  // 레시피 목록 로드
  const loadRecipes = async () => {
    try {
      const res = await fetch(`${API}/context/recipes`);
      if (res.ok) {
        const data = await res.json();
        setRecipes(data);
      }
    } catch (error) {
      console.error("레시피 로드 실패:", error);
    }
  };

  // 컨텍스트 미리보기
  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/context/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary: selectedPrimary,
          reference: selectedReference,
          mask_secrets: true,
          snippet_chars: 200
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (error) {
      console.error("미리보기 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 컨텍스트 패킷 준비
  const handlePrepare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/context/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary: selectedPrimary,
          reference: selectedReference,
          mask: true
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`패킷이 준비되었습니다!\n경로: ${data.path}\n토큰: ${data.total_token_guess}`);
      }
    } catch (error) {
      console.error("패킷 준비 실패:", error);
      alert("패킷 준비에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 워크스페이스 설정 함수
  const handleSetWorkspace = async () => {
    const currentPath = window.location.pathname.includes('my_project')
      ? 'C:\\Users\\82104\\my_project'
      : 'C:/Users/82104/my_project';

    try {
      const res = await fetch(`${API}/workspace/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath })
      });

      if (res.ok) {
        const data = await res.json();
        console.log("워크스페이스 설정 성공:", data);
        setWorkspaceSet(true);
        // 워크스페이스 스캔
        await handleScanWorkspace();
      } else {
        const error = await res.text();
        console.error("워크스페이스 설정 실패:", error);
        alert(`워크스페이스 설정 실패: ${error}`);
      }
    } catch (error) {
      console.error("워크스페이스 설정 오류:", error);
      alert(`워크스페이스 설정 오류: ${error.message}`);
    }
  };

  // 워크스페이스 스캔 함수
  const handleScanWorkspace = async () => {
    try {
      const res = await fetch(`${API}/workspace/scan`, {
        method: "POST"
      });

      if (res.ok) {
        const data = await res.json();
        console.log("워크스페이스 스캔 성공:", data);
        loadFiles(); // 파일 목록 새로고침
      }
    } catch (error) {
      console.error("워크스페이스 스캔 오류:", error);
    }
  };

  if (!workspaceSet) {
    return (
      <div className="p-8 text-center" style={{ backgroundColor: '#010409', color: '#E6EDF3', height: '100%' }}>
        <h2 className="text-xl mb-4">워크스페이스가 설정되지 않았습니다</h2>
        <p className="text-gray-400 mb-4">먼저 워크스페이스를 설정해주세요.</p>
        <button
          onClick={handleSetWorkspace}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          워크스페이스 설정 (my_project)
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ backgroundColor: '#0F141A', color: '#E6EDF3' }}>
      {/* 메인 영역 */}
      <div style={{
        flex: 1,
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 상단 텍스트 입력 영역 */}
        <div style={{
          flex: 1,
          marginBottom: '1rem'
        }}>
          <textarea
            placeholder="사용자가 텍스트를 사용할 수 있는 위치"
            style={{
              width: '100%',
              height: '100%',
              padding: '1rem',
              backgroundColor: '#010409',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#E6EDF3',
              fontSize: '0.875rem',
              resize: 'none',
              outline: 'none'
            }}
          />
        </div>

        {/* 하단 선택된 파일 칩들 */}
        <div style={{
          minHeight: '3rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'flex-start'
        }}>
          {/* Primary 파일들 */}
          {selectedPrimary.map(fileId => {
            const file = files.find(f => f.id === fileId);
            return file ? (
              <span key={fileId} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '12px',
                fontSize: '0.75rem',
                gap: '0.25rem'
              }}>
                {file.path.split('\\').pop()}
                <button
                  onClick={() => setSelectedPrimary(selectedPrimary.filter(id => id !== fileId))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '0'
                  }}
                >
                  ×
                </button>
              </span>
            ) : null;
          })}

          {/* Reference 파일들 */}
          {selectedReference.map(fileId => {
            const file = files.find(f => f.id === fileId);
            return file ? (
              <span key={fileId} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#059669',
                color: 'white',
                borderRadius: '12px',
                fontSize: '0.75rem',
                gap: '0.25rem'
              }}>
                {file.path.split('\\').pop()}
                <button
                  onClick={() => setSelectedReference(selectedReference.filter(id => id !== fileId))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '0'
                  }}
                >
                  ×
                </button>
              </span>
            ) : null;
          })}

          {/* 파일 추가 버튼 */}
          <select
            onChange={(e) => {
              const fileId = parseInt(e.target.value);
              if (fileId && !selectedPrimary.includes(fileId) && !selectedReference.includes(fileId)) {
                setSelectedPrimary([...selectedPrimary, fileId]);
              }
              e.target.value = '';
            }}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#E6EDF3',
              fontSize: '0.75rem'
            }}
          >
            <option value="">+ 파일 추가</option>
            {files.filter(f => !selectedPrimary.includes(f.id) && !selectedReference.includes(f.id)).map(file => (
              <option key={file.id} value={file.id}>
                {file.path.split('\\').pop()}
              </option>
            ))}
          </select>

          {/* 컨텍스트 패킷 준비 버튼 */}
          <button
            onClick={handlePrepare}
            disabled={loading || (selectedPrimary.length === 0 && selectedReference.length === 0)}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: loading || (selectedPrimary.length === 0 && selectedReference.length === 0) ? '#6b7280' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || (selectedPrimary.length === 0 && selectedReference.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.75rem'
            }}
          >
            패킷 준비
          </button>
        </div>
      </div>

      {/* 우측 자세히 보기 버튼 */}
      <div style={{
        width: '4rem',
        borderLeft: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <button
          onClick={handlePreview}
          disabled={loading || (selectedPrimary.length === 0 && selectedReference.length === 0)}
          style={{
            width: '3rem',
            height: '12rem',
            backgroundColor: loading || (selectedPrimary.length === 0 && selectedReference.length === 0) ? '#6b7280' : '#21262d',
            color: loading || (selectedPrimary.length === 0 && selectedReference.length === 0) ? '#9ca3af' : '#E6EDF3',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: loading || (selectedPrimary.length === 0 && selectedReference.length === 0) ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed'
          }}
        >
          자세히 보기
        </button>
      </div>

      {/* 미리보기 모달 */}
      {preview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '80%',
            height: '80%',
            backgroundColor: '#0F141A',
            border: '1px solid #30363d',
            borderRadius: '8px',
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>컨텍스트 미리보기</h2>
              <button
                onClick={() => setPreview(null)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* 통계 */}
            <div style={{
              backgroundColor: '#21262d',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                fontSize: '0.875rem'
              }}>
                <div>
                  <div style={{ color: '#9ca3af' }}>Primary Files</div>
                  <div style={{ fontWeight: '600' }}>{preview.counts.primary_files}</div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af' }}>Reference Files</div>
                  <div style={{ fontWeight: '600' }}>{preview.counts.reference_files}</div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af' }}>Total Tokens</div>
                  <div style={{ fontWeight: '600' }}>{preview.total_token_guess}</div>
                </div>
              </div>
            </div>

            {/* 섹션 목록 */}
            <div style={{
              maxHeight: '24rem',
              overflowY: 'auto',
              border: '1px solid #30363d',
              borderRadius: '6px',
              backgroundColor: '#010409'
            }}>
              {preview.sections.map((section, index) => (
                <div key={index} style={{
                  padding: '0.75rem',
                  borderBottom: index < preview.sections.length - 1 ? '1px solid #30363d' : 'none',
                  backgroundColor: section.role === 'primary' ? '#1e3a8a20' : '#14532d20'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        backgroundColor: section.role === 'primary' ? '#2563eb' : '#059669',
                        color: 'white'
                      }}>
                        {section.role}
                      </span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '600' }}>{section.title}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#9ca3af' }}>
                      <div>{section.token_guess} tokens</div>
                      {section.warnings.length > 0 && (
                        <div style={{ color: '#fbbf24' }}>
                          {section.warnings.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#c9d1d9' }}>{section.file}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    {section.snippet}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}