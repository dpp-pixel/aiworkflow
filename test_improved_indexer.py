#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""개선된 java_indexer 테스트"""

from pathlib import Path
from main.java_indexer import index_workspace
import json

# 테스트 워크스페이스
workspace = Path("test_workspace/movie_collector")

if workspace.exists():
    print(f"✅ 워크스페이스 발견: {workspace}")
    print(f"   Java 파일 수: {len(list(workspace.rglob('*.java')))}")

    # 인덱싱 실행
    result = index_workspace(workspace)

    print(f"\n📦 패키지 수: {len(result['packages'])}")

    for pkg in result['packages']:
        print(f"\n패키지: {pkg['name']}")
        print(f"  클래스 수: {len(pkg['classes'])}")

        for cls in pkg['classes'][:2]:  # 처음 2개만 출력
            print(f"\n  클래스: {cls['name']}")
            print(f"    메서드: {len(cls['methods'])}개")
            print(f"    필드: {len(cls['fields'])}개")

            # 첫 번째 메서드 샘플
            if cls['methods']:
                m = cls['methods'][0]
                print(f"    첫 메서드: {m['sig'][:50]}...")

    print("\n✅ 테스트 성공!")
else:
    print(f"❌ 워크스페이스 없음: {workspace}")
