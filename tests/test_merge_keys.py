import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("merge_keys", ROOT / "tools" / "merge_keys.py")
mk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mk)

OURS = {"layout:index": {"cmd-j": "index.next-needs-you", "cmd-shift-e": "index.files"}}
BASE = {"global": {"cmd-t": "tab.new"}, "terminal": {"cmd-c": "terminal.copy"}}
no = lambda q: False
yes = lambda q: True


class MergeKeys(unittest.TestCase):
    def test_adds_section_when_absent(self):
        out, msgs = mk.merge(OURS, copy.deepcopy(BASE), no)
        self.assertEqual(out["layout:index"], OURS["layout:index"])
        self.assertEqual(out["global"], BASE["global"])
        self.assertEqual(out["terminal"], BASE["terminal"])
        self.assertEqual(msgs, [])

    def test_idempotent(self):
        once, _ = mk.merge(OURS, copy.deepcopy(BASE), no)
        twice, msgs = mk.merge(OURS, copy.deepcopy(once), no)
        self.assertEqual(twice, once)
        self.assertEqual(msgs, [])

    def test_does_not_mutate_input(self):
        theirs = copy.deepcopy(BASE)
        mk.merge(OURS, theirs, yes)
        self.assertEqual(theirs, BASE)

    def test_global_conflict_asks(self):
        theirs = {"global": {"cmd-j": "x"}}
        out, msgs = mk.merge(OURS, copy.deepcopy(theirs), no)
        self.assertNotIn("cmd-j", out.get("layout:index", {}))
        self.assertTrue(any("cmd-j" in m for m in msgs))
        out, _ = mk.merge(OURS, copy.deepcopy(theirs), yes)
        self.assertEqual(out["layout:index"]["cmd-j"], "index.next-needs-you")
        self.assertEqual(out["global"]["cmd-j"], "x")

    def test_terminal_conflict_skips_even_if_yes(self):
        theirs = {"terminal": {"cmd-j": "x"}}
        out, msgs = mk.merge(OURS, copy.deepcopy(theirs), yes)
        self.assertNotIn("cmd-j", out.get("layout:index", {}))
        self.assertTrue(any("terminal" in m and "cmd-j" in m for m in msgs))

    def test_same_section_conflict_replaces_on_yes(self):
        theirs = {"layout:index": {"cmd-j": "x"}}
        out, _ = mk.merge(OURS, copy.deepcopy(theirs), no)
        self.assertEqual(out["layout:index"]["cmd-j"], "x")
        out, _ = mk.merge(OURS, copy.deepcopy(theirs), yes)
        self.assertEqual(out["layout:index"]["cmd-j"], "index.next-needs-you")


if __name__ == "__main__":
    unittest.main()
