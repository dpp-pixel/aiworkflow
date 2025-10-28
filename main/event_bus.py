# main/event_bus.py
from __future__ import annotations
import asyncio, json
from typing import Any, Dict, List

class EventBus:
    def __init__(self) -> None:
        self._subs: List[asyncio.Queue] = []

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
        dead = []
        for q in self._subs:
            try:
                await q.put(json.dumps(event, ensure_ascii=False))
            except Exception:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)

BUS = EventBus()