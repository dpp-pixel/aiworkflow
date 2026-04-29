#!/usr/bin/env python3
"""Test the enhanced Java indexer"""
from pathlib import Path
from main.java_indexer import index_workspace
import json

def test_indexer():
    workspace = Path("test_workspace/movie_collector")
    print(f"Testing indexer on: {workspace}")
    print("=" * 60)

    # Run indexer
    result = index_workspace(workspace)

    # Print summary
    print(f"\nPackages found: {len(result['packages'])}")

    for pkg in result['packages']:
        print(f"\nPackage: {pkg['name']}")
        print(f"   ID: {pkg['id']}")

        # Test new files[] structure
        if 'files' in pkg:
            print(f"   Files: {len(pkg['files'])}")
            for file in pkg['files'][:3]:  # Show first 3 files
                print(f"      File: {file['path']}")
                summary = file['summary']
                print(f"         Classes: {summary['classCount']}, Methods: {summary['methodCount']}, Fields: {summary['fieldCount']}, LOC: {summary['locSum']}")

                # Show classes in file
                for cls in file['classes'][:2]:  # Show first 2 classes
                    print(f"         +-- {cls['name']} [{cls['kind']}]")
                    print(f"            Role: {cls['role']}, MainLike: {cls['mainLike']}")
                    print(f"            Metrics: {cls['metrics']}")

        # Test backward compatibility with classes[]
        if 'classes' in pkg:
            print(f"   Classes (flat): {len(pkg['classes'])}")
            for cls in pkg['classes'][:3]:  # Show first 3 classes
                print(f"      Class: {cls['fqcn']}")
                print(f"         File: {cls['file']}")
                print(f"         Role: {cls['role']}, MainLike: {cls['mainLike']}")
                print(f"         Methods: {len(cls['methods'])}, Fields: {len(cls['fields'])}")

    print("\n" + "=" * 60)
    print("Test completed successfully!")

    # Save to JSON for inspection
    output_path = Path("test_indexer_output.json")
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Full output saved to: {output_path}")

if __name__ == "__main__":
    test_indexer()
