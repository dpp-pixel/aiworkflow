from pathlib import Path
from typing import Dict, Any, List
from .base import IndexerBase


class JavaIndexer(IndexerBase):

    @property
    def extensions(self) -> List[str]:
        return [".java"]

    def index_workspace(self, workspace: Path) -> Dict[str, Any]:
        from main.java_indexer import index_workspace as _index
        return _index(workspace)

    def get_namespace(self, content: str, file_path: Path, workspace: Path) -> str:
        from main.java_indexer import _find_package
        return _find_package(content)

    def get_units(self, content: str) -> List[Dict[str, Any]]:
        from main.java_indexer import _iter_classes
        return [{"name": name, "start_byte": pos, "kind": "class"}
                for name, pos in _iter_classes(content)]

    def parse_file_members(self, content: str, file_path: Path, workspace: Path) -> List[Dict[str, Any]]:
        from main.java_indexer import _make_parser, _ts_text, _get_body_members, _parse_method

        TYPE_DECL_TYPES = {
            "class_declaration", "interface_declaration",
            "enum_declaration", "record_declaration",
        }
        parser = _make_parser()
        src = content.encode("utf-8", "ignore")
        tree = parser.parse(src)
        root = tree.root_node

        namespace = ""
        for child in root.named_children:
            if child.type == "package_declaration":
                for pkg_child in child.named_children:
                    if pkg_child.type in ("scoped_identifier", "identifier"):
                        namespace = _ts_text(src, pkg_child)
                        break
                break

        members = []
        for child in root.named_children:
            if child.type not in TYPE_DECL_TYPES:
                continue
            name_node = child.child_by_field_name("name")
            if not name_node:
                continue
            class_name = _ts_text(src, name_node)
            for member in _get_body_members(child):
                if member.type != "method_declaration":
                    continue
                m = _parse_method(member, src, namespace, class_name)
                if m:
                    members.append({"id": m["id"], "range": m["range"], "loc": m["loc"]})
        return members
