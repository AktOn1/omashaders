import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui

// A one-line text box drawn and edited by this file, with no Qt text-input item inside.
// Why: Qt's own text inputs read the clipboard by themselves every time any program changes it, before the length limit
// applies, with no byte limit and no deadline, so a hostile clipboard owner could stall the shell. This box never touches
// the clipboard on its own. Ctrl+V and Shift+Insert ask `wl-paste` in a separate process (2 s deadline, 4 bytes per allowed
// character at most); middle click and the primary selection are ignored.
// Enter, Escape, Tab and the arrow keys up/down are left to the caller's Keys.onPressed; editingFinished fires when focus leaves after an edit.
// It has the same property names as the shell's TextField (text, placeholderText, foreground, font, verticalPadding,
// maximumLength, activeFocus, editingFinished, selectAll, ...), so callers read the same.
Item {
  id: pf

  property string text: ""
  property string placeholderText: ""
  property int maximumLength: 32767
  property bool readOnly: false
  property color foreground: Color.foreground
  property color accent: Color.accent
  property real verticalPadding: Style.spacing.inputPaddingY
  property real horizontalPadding: Style.spacing.controlPaddingX
  property font font: Qt.font({ family: Style.font.family, pixelSize: Style.font.body })
  property int cursorPosition: 0
  readonly property int length: text.length
  readonly property bool hovered: hover.hovered

  signal editingFinished()
  signal textEdited()

  activeFocusOnTab: true
  implicitHeight: Math.ceil(fm.height) + 2 * verticalPadding + 2
  implicitWidth: 200

  property int _anchor: 0
  property bool _selfEdit: false
  property bool _dirty: false
  property real _scroll: 0
  property bool _caretOn: true
  property real _cx: 0
  property real _sx0: 0
  property real _sx1: 0

  readonly property int selStart: Math.min(_anchor, cursorPosition)
  readonly property int selEnd: Math.max(_anchor, cursorPosition)
  readonly property bool hasSelection: selStart !== selEnd

  FontMetrics { id: fm; font: pf.font }
  TextMetrics { id: tm; font: pf.font }
  HoverHandler { id: hover }

  function _w(n) { tm.text = pf.text.substring(0, n); return tm.advanceWidth }
  function _pos(x) {
    var s = String(pf.text), lo = 0, hi = s.length
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1
      if (_w(mid) <= x) lo = mid; else hi = mid - 1
    }
    if (lo < s.length && x - _w(lo) > (_w(lo + 1) - _w(lo)) / 2) lo++
    return lo
  }
  function _view() { return Math.max(0, clipBox.width - 2) }
  function _layout() { _cx = _w(cursorPosition); _sx0 = _w(selStart); _sx1 = _w(selEnd) }
  function _reveal() {
    _layout()
    var cx = _cx, v = _view()
    if (cx - _scroll > v) _scroll = cx - v
    if (cx < _scroll) _scroll = cx
    if (_w(text.length) <= v) _scroll = 0
    _caretOn = true
    blink.restart()
  }

  function selectAll() { _anchor = 0; cursorPosition = text.length; _reveal() }
  function select(a, b) { _anchor = Math.max(0, Math.min(a, text.length)); cursorPosition = Math.max(0, Math.min(b, text.length)); _reveal() }
  function deselect() { _anchor = cursorPosition }
  function clear() { _setText(""); }
  function insert(pos, s) { var t = text.substring(0, pos) + s + text.substring(pos); _setText(t.substring(0, maximumLength)) }

  function _setText(t) {
    if (t === text) return
    _selfEdit = true
    text = t
    _selfEdit = false
    _dirty = true
    textEdited()
  }
  function _replaceSelection(s) {
    if (readOnly) return
    s = String(s).replace(/[\u0000-\u001f]/g, " ")
    var a = selStart, b = selEnd
    var room = maximumLength - (text.length - (b - a))
    if (room <= 0) return
    if (s.length > room) s = s.substring(0, room)
    _setText(text.substring(0, a) + s + text.substring(b))
    cursorPosition = a + s.length
    _anchor = cursorPosition
    _reveal()
  }
  function _delete(forward, word) {
    if (readOnly) return
    if (hasSelection) { _replaceSelection(""); return }
    var a = cursorPosition, b = cursorPosition
    if (forward) b = word ? _wordRight(a) : Math.min(text.length, a + 1)
    else a = word ? _wordLeft(a) : Math.max(0, a - 1)
    if (a === b) return
    _setText(text.substring(0, a) + text.substring(b))
    cursorPosition = a
    _anchor = a
    _reveal()
  }
  function _wordLeft(p) { var s = String(text); while (p > 0 && s.charAt(p - 1) === " ") p--; while (p > 0 && s.charAt(p - 1) !== " ") p--; return p }
  function _wordRight(p) { var s = String(text), n = s.length; while (p < n && s.charAt(p) !== " ") p++; while (p < n && s.charAt(p) === " ") p++; return p }
  function _move(p, extend) {
    cursorPosition = Math.max(0, Math.min(text.length, p))
    if (!extend) _anchor = cursorPosition
    _reveal()
  }

  function paste() {
    if (readOnly || pasteProc.running) return
    var room = maximumLength - (text.length - (selEnd - selStart))
    if (room <= 0) return
    var bytes = Math.max(16, Math.min(65536, room * 4))
    pasteProc.command = ["sh", "-c", "timeout 2 wl-paste -n -t text/plain 2>/dev/null | head -c " + Math.floor(bytes)]
    pasteProc.running = true
  }
  Process {
    id: pasteProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: pf._replaceSelection(String(text).replace(/[\r\n]+/g, " "))
    }
  }

  onTextChanged: {
    if (!_selfEdit) { cursorPosition = text.length; _anchor = cursorPosition; _dirty = false }
    else if (cursorPosition > text.length) { cursorPosition = text.length; _anchor = Math.min(_anchor, text.length) }
    _reveal()
  }
  onWidthChanged: _reveal()
  onFontChanged: _reveal()
  on_AnchorChanged: _layout()
  onCursorPositionChanged: _layout()
  onActiveFocusChanged: {
    if (activeFocus) { _caretOn = true; blink.restart() }
    else { _anchor = cursorPosition; blink.stop(); _caretOn = false; if (_dirty) { _dirty = false; editingFinished() } }
  }

  readonly property var _borderSpec: Border.controlSpec(activeFocus ? "focus" : (hovered ? "hover-cursor" : "normal"), foreground, accent)

  BorderSurface {
    anchors.fill: parent
    color: Style.controlFill(pf.activeFocus, pf.hovered, pf.foreground, pf.accent)
    borderSpec: pf._borderSpec
    radius: Style.cornerRadius
  }

  Item {
    id: clipBox
    x: pf.horizontalPadding + Border.left(pf._borderSpec)
    y: 0
    width: pf.width - x - pf.horizontalPadding - Border.right(pf._borderSpec)
    height: pf.height
    clip: true

    Rectangle {
      visible: pf.hasSelection && pf.activeFocus
      x: pf._sx0 - pf._scroll
      width: pf._sx1 - pf._sx0
      y: (parent.height - Math.ceil(fm.height)) / 2
      height: Math.ceil(fm.height)
      color: Style.selectionFillFor(pf.foreground, pf.accent)
    }
    Text {
      visible: pf.text === ""
      x: 0
      anchors.verticalCenter: parent.verticalCenter
      width: parent.width
      elide: Text.ElideRight
      textFormat: Text.PlainText
      text: pf.placeholderText
      color: Qt.darker(pf.foreground, 1.6)
      font: pf.font
    }
    Text {
      x: -pf._scroll
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: pf.text
      color: pf.foreground
      font: pf.font
    }
    Rectangle {
      visible: pf.activeFocus && pf._caretOn && !pf.readOnly
      x: pf._cx - pf._scroll
      y: (parent.height - Math.ceil(fm.height)) / 2
      width: 1
      height: Math.ceil(fm.height)
      color: pf.foreground
    }
  }

  Timer { id: blink; interval: 530; repeat: true; onTriggered: pf._caretOn = !pf._caretOn }

  MouseArea {
    anchors.fill: parent
    acceptedButtons: Qt.LeftButton | Qt.MiddleButton
    cursorShape: Qt.IBeamCursor
    onPressed: function(m) {
      if (m.button !== Qt.LeftButton) return
      pf.forceActiveFocus()
      pf._move(pf._pos(m.x - clipBox.x + pf._scroll), false)
    }
    onPositionChanged: function(m) {
      if (pressedButtons & Qt.LeftButton) pf._move(pf._pos(m.x - clipBox.x + pf._scroll), true)
    }
    onDoubleClicked: function(m) { if (m.button === Qt.LeftButton) pf.selectAll() }
  }

  // A forwardTo target sees a key before the caller's own Keys.onPressed, so `ev` leaves Enter, Escape, Tab and the up/down keys to the caller.
  Keys.forwardTo: [ev]
  Item {
    id: ev
    Keys.onPressed: function(event) {
      var ctrl = (event.modifiers & Qt.ControlModifier) !== 0
      var shift = (event.modifiers & Qt.ShiftModifier) !== 0
      var alt = (event.modifiers & (Qt.AltModifier | Qt.MetaModifier)) !== 0
      var k = event.key
      event.accepted = true
      if (k === Qt.Key_Backspace) pf._delete(false, ctrl)
      else if (k === Qt.Key_Delete) pf._delete(true, ctrl)
      else if (k === Qt.Key_Left) pf._move(ctrl ? pf._wordLeft(pf.cursorPosition) : (pf.hasSelection && !shift ? pf.selStart : pf.cursorPosition - 1), shift)
      else if (k === Qt.Key_Right) pf._move(ctrl ? pf._wordRight(pf.cursorPosition) : (pf.hasSelection && !shift ? pf.selEnd : pf.cursorPosition + 1), shift)
      else if (k === Qt.Key_Home) pf._move(0, shift)
      else if (k === Qt.Key_End) pf._move(pf.text.length, shift)
      else if (ctrl && k === Qt.Key_A) pf.selectAll()
      else if (ctrl && k === Qt.Key_U) { pf.select(0, pf.cursorPosition); pf._replaceSelection("") }
      else if ((ctrl && !shift && k === Qt.Key_V) || (shift && !ctrl && k === Qt.Key_Insert) || (ctrl && shift && k === Qt.Key_V)) pf.paste()
      else if (!ctrl && !alt && event.text.length > 0 && event.text.charCodeAt(0) >= 32 && event.text.charCodeAt(0) !== 127) pf._replaceSelection(event.text)
      else event.accepted = false
    }
  }
}
