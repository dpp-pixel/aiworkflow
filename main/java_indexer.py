# main/java_indexer.py
from pathlib import Path
import re
from typing import Dict, Any, List, Optional
from .anchor_utils import anchor_pkg, anchor_cls, anchor_field, anchor_method, normalize_method_signature, ui_anchor, ai_anchor

import tree_sitter_java as _tsjava
from tree_sitter import Language as _TSLanguage, Parser as _TSParser

_JAVA_LANGUAGE = _TSLanguage(_tsjava.language())


def _make_parser():
    try:
        return _TSParser(_JAVA_LANGUAGE)
    except TypeError:
        p = _TSParser()
        p.set_language(_JAVA_LANGUAGE)
        return p


def _extract_visibility(sig: str, is_interface: bool = False) -> str:
    if re.search(r'\bprivate\b',   sig): return 'private'
    if re.search(r'\bprotected\b', sig): return 'protected'
    if re.search(r'\bpublic\b',    sig): return 'public'
    return 'public' if is_interface else 'package'


def _ts_text(src: bytes, node) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", "ignore")


_ANNOT_TYPES = {"marker_annotation", "annotation", "single_element_annotation", "normal_annotation"}

def _extract_annotations(node, src: bytes) -> List[str]:
    result = []
    for child in node.children:
        if child.type == "modifiers":
            for mod in child.children:
                if mod.type in _ANNOT_TYPES:
                    name_node = mod.child_by_field_name("name")
                    if name_node:
                        result.append(_ts_text(src, name_node))
        elif child.type in _ANNOT_TYPES:
            name_node = child.child_by_field_name("name")
            if name_node:
                result.append(_ts_text(src, name_node))
    return result


def _get_body_members(class_node) -> list:
    BODY_TYPES = {"class_body", "interface_body", "enum_body", "record_body"}
    body = class_node.child_by_field_name("body")
    if not body:
        for child in class_node.named_children:
            if child.type in BODY_TYPES:
                body = child
                break
    if not body:
        return []
    members = []
    for child in body.named_children:
        if child.type == "enum_body_declarations":
            members.extend(child.named_children)
        else:
            members.append(child)
    return members


def _parse_method(node, src: bytes, package: str, class_name: str, is_interface: bool = False) -> Optional[Dict]:
    if not node.child_by_field_name("name"):
        return None

    body = node.child_by_field_name("body")
    if body:
        sig_raw = src[node.start_byte:body.start_byte].decode("utf-8", "ignore")
    else:
        sig_raw = _ts_text(src, node).rstrip(";")

    sig = re.sub(r"\s+", " ", sig_raw).strip()

    sl, sc = node.start_point
    el, ec = node.end_point
    loc = el - sl + 1
    normalized = normalize_method_signature(sig)

    return {
        "id":         anchor_method(package, class_name, sig),
        "sig":        normalized,
        "uiLabel":    ui_anchor(class_name, sig),
        "aiId":       ai_anchor(package, class_name, sig),
        "visibility":   _extract_visibility(sig, is_interface=is_interface),
        "annotations":  _extract_annotations(node, src),
        "static":       bool(re.search(r'\bstatic\b', sig)),
        "loc":        loc,
        "collapsed":  loc > 20,
        "preview":    f"{normalized} {{ ... }}",
        "range":      {"start": [sl, sc], "end": [el, ec]},
    }


def _extract_methods(class_node, src: bytes, package: str, class_name: str, kind: str = 'class') -> List[Dict]:
    methods = []
    is_interface = kind == 'interface'
    for member in _get_body_members(class_node):
        if member.type == "method_declaration":
            m = _parse_method(member, src, package, class_name, is_interface=is_interface)
            if m:
                methods.append(m)
    return methods


def _extract_fields(class_node, src: bytes, package: str, class_name: str) -> List[Dict]:
    fields = []
    for member in _get_body_members(class_node):
        if member.type == "enum_constant":
            name_node = member.child_by_field_name("name")
            if name_node:
                fname = _ts_text(src, name_node)
                fields.append({
                    "id":          anchor_field(package, class_name, fname),
                    "name":        fname,
                    "declaration": fname,
                    "visibility":  "public",
                })
        elif member.type == "field_declaration":
            decl = re.sub(r"\s+", " ", _ts_text(src, member)).strip().rstrip(";").strip()
            for child in member.named_children:
                if child.type == "variable_declarator":
                    name_node = child.child_by_field_name("name")
                    if name_node:
                        fname = _ts_text(src, name_node)
                        fields.append({
                            "id":          anchor_field(package, class_name, fname),
                            "name":        fname,
                            "declaration": decl,
                            "visibility":  _extract_visibility(decl),
                        })
    return fields


def _find_package(text: str) -> str:
    """텍스트에서 package 선언 추출 (graph_utils/compare_utils 호환용)"""
    parser = _make_parser()
    src = text.encode("utf-8", "ignore")
    tree = parser.parse(src)
    for child in tree.root_node.named_children:
        if child.type == "package_declaration":
            for pkg_child in child.named_children:
                if pkg_child.type in ("scoped_identifier", "identifier"):
                    return _ts_text(src, pkg_child)
            break
    return ""


def _iter_classes(text: str) -> List[tuple]:
    """최상위 타입 선언 목록 반환: [(class_name, start_byte), ...]"""
    TYPE_DECL_TYPES = {"class_declaration", "interface_declaration", "enum_declaration", "record_declaration"}
    parser = _make_parser()
    src = text.encode("utf-8", "ignore")
    tree = parser.parse(src)
    result = []
    for child in tree.root_node.named_children:
        if child.type in TYPE_DECL_TYPES:
            name_node = child.child_by_field_name("name")
            if name_node:
                result.append((_ts_text(src, name_node), child.start_byte))
    return result


def index_workspace(workspace: Path) -> Dict[str, Any]:
    parser = _make_parser()
    EXCLUDE_DIRS    = {"build", "out", "bin", "target", ".git", "backup", "node_modules"}
    TYPE_DECL_TYPES = {"class_declaration", "interface_declaration", "enum_declaration", "record_declaration"}

    by_package: Dict[str, Any] = {}
    seen_fqcn:  Dict[str, str] = {}

    for java_file in workspace.rglob("*.java"):
        if any(part in EXCLUDE_DIRS for part in java_file.parts):
            continue
        try:
            src = java_file.read_bytes()
        except Exception:
            continue

        tree = parser.parse(src)
        root = tree.root_node

        package = ""
        for child in root.named_children:
            if child.type == "package_declaration":
                for pkg_child in child.named_children:
                    if pkg_child.type in ("scoped_identifier", "identifier"):
                        package = _ts_text(src, pkg_child)
                        break
                break

        for child in root.named_children:
            if child.type not in TYPE_DECL_TYPES:
                continue
            name_node = child.child_by_field_name("name")
            if not name_node:
                continue

            class_name = _ts_text(src, name_node)
            class_fqcn = f"{package}.{class_name}" if package else class_name
            if class_fqcn in seen_fqcn:
                continue
            seen_fqcn[class_fqcn] = str(java_file.relative_to(workspace))

            pkg_id = anchor_pkg(package) if package else "pkg:"
            cls_id = anchor_cls(package, class_name)
            if pkg_id not in by_package:
                by_package[pkg_id] = {"id": pkg_id, "name": package, "classes": []}

            kind = child.type.replace("_declaration", "")
            by_package[pkg_id]["classes"].append({
                "id":          cls_id,
                "name":        class_name,
                "fqcn":        class_fqcn,
                "file":        str(java_file.relative_to(workspace)),
                "kind":        kind,
                "annotations": _extract_annotations(child, src),
                "metrics": {},
                "methods": _extract_methods(child, src, package, class_name, kind=kind),
                "fields":  _extract_fields(child, src, package, class_name),
            })

    return {"packages": list(by_package.values()), "relations": []}
