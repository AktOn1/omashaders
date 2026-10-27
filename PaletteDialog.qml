import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "palette.js" as Pal

// The Palette editor, opened by Core.qml through FxHost (props: core, open) from the Color list ("Palette…").
// A palette is a colour grade made of a few numbers (see bin/omspalette.py): a ramp of 2 to 5 colours the brightness is looked up on,
// how much of the original colours stays, a tint for the shadows and for the lights, saturation / contrast / midtones, and flat levels.
// The look changes live as you edit (the colour name is "pal-…", so strength, favorites, themes and share codes work as for any grade).
Item {
  id: pd
  property var core: null
  property bool open: false

  readonly property color fg: core ? core.fg : "white"
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  readonly property string font: core ? core.bar.fontFamily : "sans"

  property var p: Pal.neutral()
  property string origin: ""
  property string note: ""
  property int editing: 0     // how many hex boxes have the keyboard
  readonly property string pid: Pal.encode(p)
  readonly property bool isFav: core ? core.colorFavs.indexOf(pid) >= 0 : false
  readonly property bool hasRamp: p.stops.length >= 2

  // leave() = the user going out (Esc, q, Done): the next menu open is the main list; close() = dismissed (icon, click away): the next open comes back here
  function leave() { if (core) core.hideViews(false) }
  function close() { if (core) core.hideViews(true) }
  function closeForPopoutSwitch() { close() }

  // ---- editing: every change makes a new palette object, which updates the look after a short pause
  function change(mut) {
    var q = JSON.parse(JSON.stringify(p))
    mut(q)
    q.stops.sort(function(a, b) { return a[0] - b[0] })
    p = q
    note = ""
    applyTimer.start()
  }
  function show(id) {
    var q = Pal.decode(id)
    if (q) { p = q; note = ""; applyTimer.start() }
  }
  // starts (does not restart) the timer: while a slider is dragged the screen follows every 220 ms instead of only after you stop
  Timer {
    id: applyTimer
    interval: 220
    onTriggered: { if (pd.core) { pd.core.colorOrigin = pd.pid; pd.core.colorPreviewed = false; pd.core.applyColor(pd.pid) } }
  }
  function setStop(i, pos, hex) {
    change(function(q) { if (hex !== null) q.stops[i][1] = hex; if (pos !== null) q.stops[i][0] = Math.max(0, Math.min(1, pos)) })
  }
  function addStop() {
    if (p.stops.length >= Pal.MAX_STOPS) return
    change(function(q) {
      if (q.stops.length < 2) { q.stops = [[0, "202020"], [1, "f0f0f0"]]; return }
      var best = 0, gap = 0
      for (var i = 1; i < q.stops.length; i++) if (q.stops[i][0] - q.stops[i - 1][0] > gap) { gap = q.stops[i][0] - q.stops[i - 1][0]; best = i }
      var mid = (q.stops[best][0] + q.stops[best - 1][0]) / 2
      var c = Pal.rampAt({ stops: q.stops }, mid)
      q.stops.push([mid, c.substring(1)])
    })
  }
  function removeStop(i) { change(function(q) { q.stops.splice(i, 1); if (q.stops.length < 2) q.stops = [] }) }
  function surprise() {
    var q = Pal.surprise()
    p = q
    note = "Surprise: " + q.title + ". Press again for another."
    applyTimer.start()
  }
  function toggleFav() {
    if (!core) return
    var next = core.colorFavs.filter(function(f) { return f !== pid })
    if (next.length === core.colorFavs.length) next.push(pid)
    core.colorFavs = next
    core.writeFile(core.colorFavFile, next.join("\n"))
  }
  function revert() {
    if (!core) return
    applyTimer.stop()
    core.applyColor(origin)
    core.colorOrigin = origin
    var q = Pal.decode(origin)
    p = q ? q : Pal.neutral()
    note = origin === "" ? "Back to no colour grade." : "Back to how it was when you opened this."
  }

  onOpenChanged: {
    if (!open) return
    origin = core ? core.colorCurrent : ""
    var q = Pal.decode(origin)
    p = q ? q : JSON.parse(JSON.stringify(Pal.decode(Pal.starters[0].id)))
    note = q ? "" : "Pick a start below, or edit the colours. The screen changes as you edit."
    if (!q) applyTimer.start()
    presetLoader.reload()
    focusTimer.restart()
  }
  Timer { id: focusTimer; interval: 300; onTriggered: keys.forceActiveFocus() }

  // ---- starting points: a few built in, plus palettes fitted to the shipped colour grades (palettes/presets.tsv)
  property var presetRows: []
  FileView {
    id: presetLoader
    path: pd.core ? pd.core.path("palettes/presets.tsv") : ""
    printErrors: false
    onLoaded: {
      var out = []
      String(text()).split("\n").forEach(function(l) {
        var f = l.split("\t")
        if (f.length >= 3 && Pal.isId(f[1])) out.push({ value: f[1], label: f[0] + (f[2] === "exact" ? "  (same look)" : "  (close)") })
      })
      pd.presetRows = out
    }
    onLoadFailed: pd.presetRows = []
  }
  readonly property var startOptions: Pal.starters.map(function(s) { return { value: s.id, label: s.label } }).concat(presetRows)

  component Btn: Rectangle {
    id: b
    property string label: ""
    property bool dim: false
    signal clicked()
    height: Style.space(28)
    width: txt.implicitWidth + Style.space(24)
    radius: Style.space(6)
    color: pd.fgA(ma.containsMouse && !dim ? 0.32 : 0.22)
    opacity: dim ? 0.45 : 1
    Text {
      id: txt
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: b.label
      color: pd.fg
      font.family: pd.font
      font.pixelSize: Style.font.body
      font.bold: true
    }
    MouseArea {
      id: ma
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: b.dim ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: if (!b.dim) b.clicked()
    }
  }

  // one labelled slider row; `shown` is the text at the right
  component Knob: Item {
    id: kn
    property string label: ""
    property real value: 0
    property real from: 0
    property real to: 1
    property real stepBy: 0.01
    property bool whole: false
    property string shown: ""
    signal moved(real v)
    width: parent ? parent.width : 300
    height: Style.space(26)
    Text {
      id: knLabel
      width: Style.space(120)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: kn.label
      color: pd.fg
      opacity: 0.85
      font.family: pd.font
      font.pixelSize: Style.font.body
    }
    PanelSlider {
      anchors.left: knLabel.right
      anchors.right: knVal.left
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
      bar: pd.core ? pd.core.bar : null
      fillColor: pd.fg
      knobColor: pd.fg
      trackColor: pd.fgA(0.2)
      minimum: kn.from
      maximum: kn.to
      step: kn.stepBy
      integer: kn.whole
      value: kn.value
      onMoved: function(v) { kn.moved(v) }
    }
    Text {
      id: knVal
      width: Style.space(58)
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      horizontalAlignment: Text.AlignRight
      textFormat: Text.PlainText
      text: kn.shown
      color: pd.fg
      font.family: pd.font
      font.pixelSize: Style.font.body * 0.9
    }
  }

  // a colour box: swatch + rrggbb field (the swatch also shows when the text is not a colour yet)
  component HexBox: Row {
    id: hb
    property string hex: "808080"
    signal picked(string hex)
    spacing: Style.space(6)
    property bool typing: f.activeFocus
    onTypingChanged: pd.editing += typing ? 1 : -1
    Rectangle {
      width: Style.space(22)
      height: Style.space(22)
      anchors.verticalCenter: parent.verticalCenter
      radius: Style.space(4)
      color: "#" + hb.hex
      border.width: 1
      border.color: pd.fgA(0.5)
    }
    PlainField {
      id: f
      width: Style.space(86)
      height: Style.space(26)
      anchors.verticalCenter: parent.verticalCenter
      verticalPadding: Style.space(2)
      maximumLength: 7
      placeholderText: "rrggbb"
      foreground: pd.fg
      font.family: pd.font
      font.pixelSize: Style.font.body
      Binding on text { when: !f.activeFocus; value: hb.hex }
      onTextEdited: { var h = Pal.normHex(text); if (h !== "" && h !== hb.hex) hb.picked(h) }
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape || event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { keys.forceActiveFocus(); event.accepted = true }
      }
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: pd.core
    bar: pd.core ? pd.core.bar : null
    owner: pd
    open: pd.open
    focusTarget: keys
    contentWidth: panel.fittedContentWidth(Style.space(620))
    contentHeight: panel.fittedContentHeight(Style.space(760))

    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      blocked: startDrop.popupOpen || pd.editing > 0
      onMoveRequested: function(dx, dy) {}
      onActivateRequested: pd.leave()
      onDeleteRequested: {}
      onCloseRequested: pd.leave()
      onTextKey: function(t) {
        if (t === "q") pd.leave()
        else if (t === "f") pd.toggleFav()
        else if (t === "r") pd.revert()
        else if (t === "a") pd.addStop()
        else if (t === "s") pd.surprise()
      }

      Column {
        id: col
        anchors.fill: parent
        spacing: Style.space(8)

        Text {
          width: col.width
          textFormat: Text.PlainText
          text: "Palette"
          color: pd.fg
          font.family: pd.font
          font.pixelSize: Style.font.body * 1.35
          font.bold: true
        }
        Text {
          width: col.width
          wrapMode: Text.WordWrap
          textFormat: Text.PlainText
          text: pd.note !== "" ? pd.note : "Your own colour grade. Everything you change shows on the screen at once; Color strength (in the menu) still blends it with the real picture."
          color: pd.fg
          opacity: 0.8
          font.family: pd.font
          font.pixelSize: Style.font.body * 0.95
        }

        Row {
          spacing: Style.space(8)
          Text { anchors.verticalCenter: parent.verticalCenter; textFormat: Text.PlainText; text: "Start from"; color: pd.fg; opacity: 0.85; font.family: pd.font; font.pixelSize: Style.font.body }
          SearchableDropdown {
            id: startDrop
            showLabel: false
            width: col.width - Style.space(100)
            foreground: pd.fg
            fontFamily: pd.font
            options: pd.startOptions
            value: ""
            triggerLabel: "Pick a starting point…"
            onChanged: function(v) { pd.show(v) }
          }
        }

        // the ramp: dark end on the left, bright end on the right
        Text { textFormat: Text.PlainText; text: "Colours (dark to bright)"; color: pd.fg; font.family: pd.font; font.pixelSize: Style.font.body; font.bold: true }
        Rectangle {
          width: col.width
          height: Style.space(22)
          radius: Style.space(5)
          color: pd.fgA(0.08)
          border.width: 1
          border.color: pd.fgA(0.3)
          clip: true
          Row {
            anchors.fill: parent
            visible: pd.hasRamp
            Repeater {
              model: 64
              Rectangle { width: parent.width / 64; height: parent.height; color: pd.hasRamp ? Pal.rampAt(pd.p, index / 63) : "transparent" }
            }
          }
          Text {
            anchors.centerIn: parent
            visible: !pd.hasRamp
            textFormat: Text.PlainText
            text: "No colour ramp: the original colours are kept (tints, saturation and levels below still apply)"
            color: pd.fg
            opacity: 0.7
            font.family: pd.font
            font.pixelSize: Style.font.body * 0.85
          }
        }
        Repeater {
          model: pd.p.stops.length
          Row {
            id: stopRow
            required property int index
            spacing: Style.space(8)
            HexBox {
              hex: pd.p.stops[stopRow.index] ? pd.p.stops[stopRow.index][1] : "808080"
              onPicked: function(h) { pd.setStop(stopRow.index, null, h) }
            }
            Text { anchors.verticalCenter: parent.verticalCenter; textFormat: Text.PlainText; text: "at brightness"; color: pd.fg; opacity: 0.7; font.family: pd.font; font.pixelSize: Style.font.body * 0.9 }
            PanelSlider {
              width: col.width - Style.space(330)
              anchors.verticalCenter: parent.verticalCenter
              bar: pd.core ? pd.core.bar : null
              fillColor: pd.fg
              knobColor: pd.fg
              trackColor: pd.fgA(0.2)
              minimum: 0
              maximum: 1
              step: 0.01
              value: pd.p.stops[stopRow.index] ? pd.p.stops[stopRow.index][0] : 0
              onMoved: function(v) { pd.setStop(stopRow.index, v, null) }
            }
            Text {
              width: Style.space(40)
              anchors.verticalCenter: parent.verticalCenter
              horizontalAlignment: Text.AlignRight
              textFormat: Text.PlainText
              text: Math.round((pd.p.stops[stopRow.index] ? pd.p.stops[stopRow.index][0] : 0) * 100) + "%"
              color: pd.fg
              font.family: pd.font
              font.pixelSize: Style.font.body * 0.9
            }
            Btn { label: "×"; onClicked: pd.removeStop(stopRow.index) }
          }
        }
        Row {
          spacing: Style.space(8)
          Btn { visible: pd.p.stops.length < Pal.MAX_STOPS; label: pd.hasRamp ? "+ Add a colour  (a)" : "Use a colour ramp  (a)"; onClicked: pd.addStop() }
          Btn { visible: pd.hasRamp; label: "Remove the ramp"; onClicked: pd.change(function(q) { q.stops = [] }) }
        }

        Text { textFormat: Text.PlainText; text: "Mix with the real picture"; color: pd.fg; font.family: pd.font; font.pixelSize: Style.font.body; font.bold: true; topPadding: Style.space(4) }
        Knob {
          label: "Keep original"; value: pd.p.keep; from: 0; to: 1
          shown: Math.round(pd.p.keep * 100) + "%"
          onMoved: function(v) { pd.change(function(q) { q.keep = v }) }
        }
        Knob {
          label: "Saturation"; value: pd.p.sat; from: 0; to: 1.99
          shown: Math.round(pd.p.sat * 100) + "%"
          onMoved: function(v) { pd.change(function(q) { q.sat = v }) }
        }
        Knob {
          label: "Contrast"; value: pd.p.con; from: 0; to: 1.99
          shown: Math.round(pd.p.con * 100) + "%"
          onMoved: function(v) { pd.change(function(q) { q.con = v }) }
        }
        Knob {
          label: "Midtones"; value: pd.p.gam; from: 0.2; to: 1.99
          shown: pd.p.gam < 0.97 ? "lighter" : (pd.p.gam > 1.03 ? "darker" : "normal")
          onMoved: function(v) { pd.change(function(q) { q.gam = v }) }
        }
        Knob {
          label: "Flat levels"; value: pd.p.steps < 2 ? 1 : pd.p.steps; from: 1; to: 15; stepBy: 1; whole: true
          shown: pd.p.steps < 2 ? "off" : String(pd.p.steps)
          onMoved: function(v) { pd.change(function(q) { q.steps = v < 2 ? 0 : Math.round(v) }) }
        }

        Text { textFormat: Text.PlainText; text: "Tint the original colours"; color: pd.fg; font.family: pd.font; font.pixelSize: Style.font.body; font.bold: true; topPadding: Style.space(4) }
        Row {
          spacing: Style.space(8)
          Text { width: Style.space(70); anchors.verticalCenter: parent.verticalCenter; textFormat: Text.PlainText; text: "Shadows"; color: pd.fg; opacity: 0.85; font.family: pd.font; font.pixelSize: Style.font.body }
          HexBox { hex: pd.p.shadow[0]; onPicked: function(h) { pd.change(function(q) { q.shadow[0] = h; if (q.shadow[1] < 0.01) q.shadow[1] = 0.5 }) } }
          PanelSlider {
            width: col.width - Style.space(70) - Style.space(140) - Style.space(70)
            anchors.verticalCenter: parent.verticalCenter
            bar: pd.core ? pd.core.bar : null
            fillColor: pd.fg
            knobColor: pd.fg
            trackColor: pd.fgA(0.2)
            minimum: 0
            maximum: 1
            step: 0.01
            value: pd.p.shadow[1]
            onMoved: function(v) { pd.change(function(q) { q.shadow[1] = v }) }
          }
          Text { width: Style.space(40); anchors.verticalCenter: parent.verticalCenter; horizontalAlignment: Text.AlignRight; textFormat: Text.PlainText; text: Math.round(pd.p.shadow[1] * 100) + "%"; color: pd.fg; font.family: pd.font; font.pixelSize: Style.font.body * 0.9 }
        }
        Row {
          spacing: Style.space(8)
          Text { width: Style.space(70); anchors.verticalCenter: parent.verticalCenter; textFormat: Text.PlainText; text: "Lights"; color: pd.fg; opacity: 0.85; font.family: pd.font; font.pixelSize: Style.font.body }
          HexBox { hex: pd.p.light[0]; onPicked: function(h) { pd.change(function(q) { q.light[0] = h; if (q.light[1] < 0.01) q.light[1] = 0.5 }) } }
          PanelSlider {
            width: col.width - Style.space(70) - Style.space(140) - Style.space(70)
            anchors.verticalCenter: parent.verticalCenter
            bar: pd.core ? pd.core.bar : null
            fillColor: pd.fg
            knobColor: pd.fg
            trackColor: pd.fgA(0.2)
            minimum: 0
            maximum: 1
            step: 0.01
            value: pd.p.light[1]
            onMoved: function(v) { pd.change(function(q) { q.light[1] = v }) }
          }
          Text { width: Style.space(40); anchors.verticalCenter: parent.verticalCenter; horizontalAlignment: Text.AlignRight; textFormat: Text.PlainText; text: Math.round(pd.p.light[1] * 100) + "%"; color: pd.fg; font.family: pd.font; font.pixelSize: Style.font.body * 0.9 }
        }

        Text {
          width: col.width
          elide: Text.ElideMiddle
          textFormat: Text.PlainText
          text: pd.pid
          color: pd.fg
          opacity: 0.5
          font.family: pd.font
          font.pixelSize: Style.font.caption
        }
        Row {
          spacing: Style.space(8)
          Btn { label: "Surprise me  (s)"; onClicked: pd.surprise() }
          Btn { label: pd.isFav ? "★ Favorite  (f)" : "☆ Favorite  (f)"; onClicked: pd.toggleFav() }
          Btn { label: "Undo all  (r)"; onClicked: pd.revert() }
          Btn { label: "Done  (esc)"; onClicked: pd.leave() }
        }
      }
    }
  }

}
