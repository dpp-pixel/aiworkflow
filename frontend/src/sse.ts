// sse.ts
export type ApplyOkEvt = { 
  anchor?: string | null; 
  changedFiles: string[]; 
  checkpointId?: string | null;
};

export type ApplyFailEvt = { 
  anchor?: string | null; 
  error: string; 
  violations?: any[];
};

export type CheckpointEvt = { 
  checkpointId: string;
};

export type IndexUpdatedEvt = { 
  files: string[];
};

export function connectSSE(apiBase: string, projectId: string, handlers: {
  onApplyOk?: (e: ApplyOkEvt) => void;
  onApplyFail?: (e: ApplyFailEvt) => void;
  onCheckpoint?: (e: CheckpointEvt) => void;
  onIndexUpdated?: (e: IndexUpdatedEvt) => void;
}) {
  const url = `${apiBase}/main/events?projectId=${encodeURIComponent(projectId)}`;
  let es = new EventSource(url, { withCredentials: false });

  es.addEventListener("apply_succeeded", (ev: MessageEvent) => {
    try {
      const e = JSON.parse(ev.data) as ApplyOkEvt;
      handlers.onApplyOk?.(e);
    } catch (err) {
      console.warn('Failed to parse apply_succeeded event:', err);
    }
  });

  es.addEventListener("apply_failed", (ev: MessageEvent) => {
    try {
      const e = JSON.parse(ev.data) as ApplyFailEvt;
      handlers.onApplyFail?.(e);
    } catch (err) {
      console.warn('Failed to parse apply_failed event:', err);
    }
  });

  es.addEventListener("checkpoint_restored", (ev: MessageEvent) => {
    try {
      const e = JSON.parse(ev.data) as CheckpointEvt;
      handlers.onCheckpoint?.(e);
    } catch (err) {
      console.warn('Failed to parse checkpoint_restored event:', err);
    }
  });

  es.addEventListener("index_updated", (ev: MessageEvent) => {
    try {
      const e = JSON.parse(ev.data) as IndexUpdatedEvt;
      handlers.onIndexUpdated?.(e);
    } catch (err) {
      console.warn('Failed to parse index_updated event:', err);
    }
  });

  es.addEventListener("ping", () => {
    // keep-alive - no action needed
  });

  // 자동 재연결(지수적 백오프)
  let closed = false;
  let reconnectAttempts = 0;
  
  const reconnect = () => {
    if (closed) return;
    
    reconnectAttempts++;
    const wait = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000) + Math.random() * 1000;
    
    console.log(`SSE reconnecting in ${Math.round(wait)}ms (attempt ${reconnectAttempts})`);
    
    setTimeout(() => {
      if (!closed) {
        try {
          es = new EventSource(url, { withCredentials: false });
          
          // Re-attach event listeners
          es.addEventListener("apply_succeeded", (ev: MessageEvent) => {
            const e = JSON.parse(ev.data) as ApplyOkEvt;
            handlers.onApplyOk?.(e);
          });
          
          es.addEventListener("apply_failed", (ev: MessageEvent) => {
            const e = JSON.parse(ev.data) as ApplyFailEvt;
            handlers.onApplyFail?.(e);
          });
          
          es.addEventListener("checkpoint_restored", (ev: MessageEvent) => {
            const e = JSON.parse(ev.data) as CheckpointEvt;
            handlers.onCheckpoint?.(e);
          });
          
          es.addEventListener("index_updated", (ev: MessageEvent) => {
            const e = JSON.parse(ev.data) as IndexUpdatedEvt;
            handlers.onIndexUpdated?.(e);
          });

          es.onopen = () => {
            console.log('SSE reconnected successfully');
            reconnectAttempts = 0;
          };

          es.onerror = reconnect;
        } catch (err) {
          console.error('Failed to reconnect SSE:', err);
          reconnect();
        }
      }
    }, wait);
  };

  es.onerror = reconnect;

  return {
    close() { 
      closed = true; 
      es.close(); 
    }
  };
}