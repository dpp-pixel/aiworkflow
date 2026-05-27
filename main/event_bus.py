# main/event_bus.py
from __future__ import annotations
import asyncio, json
from typing import Any, Dict, List

class EventBus:
    def __init__(self) -> None:
        self._subs: List[asyncio.Queue] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subs.remove(q)
        except ValueError:
            pass

    async def publish(self, event: Dict[str, Any]) -> None:
        msg = json.dumps(event, ensure_ascii=False)
        dead = []
        for q in self._subs:
            try:
                await q.put(msg)
            except Exception:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)

    def publish_sync(self, event: Dict[str, Any]) -> None:
        """sync 컨텍스트(스레드 풀, 워처 스레드)에서 안전하게 발행"""
        loop = self._loop
        if loop is None or not loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(self.publish(event), loop)

BUS = EventBus()
