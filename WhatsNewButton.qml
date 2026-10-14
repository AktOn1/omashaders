import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// SHARED SOURCE (omarchy-plugins/shared/whatsnew/WhatsNewButton.qml). Do not edit the copy inside a plugin; edit the shared file and run
// omarchy-plugins/shared/whatsnew/sync.sh. The "What's new" icon for the top right corner of a plugin's window: a small
// newspaper icon that turns accent coloured, pulses and gets a "NEW" tag while an update is waiting, a tooltip, and a flyout with the README "What's new" list and the update button.
// Needs bin/update-check next to this file's folder. Host: place it in the window's top right corner, set `flyoutParent` to the
// window's content item, call toggle() from a key if you like, and close it first on Esc (`open`, close()).
Item {
  id: root
  required property string pluginId
  property Item flyoutParent: root
  property color fg: Color.popups.text   // popup colour, never the bar's (bar text turns dark over a bright wallpaper)
  property color bg: Color.popups.background
  property string fontFamily: Style.font.family
  property int size: Style.space(28)
  property string keyHint: "u"   // the key the host binds to toggle(); empty when it has none
  property bool open: false

  property bool updAvail: false
  property bool updBusy: false
  property string updState: ""        // "", "ok" or "fail" after an update run
  property string updOut: ""
  property string updCur: ""
  property string updLatest: ""
  property bool updDirty: false
  property var updChanges: []
  property var updRecent: []
  property bool copied: false
  readonly property string updCmd: "omarchy plugin update " + pluginId + " --yes"
  readonly property bool hot: updAvail && updState !== "ok"

  readonly property color accent: Color.accent
  implicitWidth: hot ? size + newLabel.implicitWidth + Style.space(6) - Style.space(4) : size
  implicitHeight: size
  width: implicitWidth
  height: size

  function path(rel) { return decodeURIComponent(Qt.resolvedUrl(rel).toString().replace(/^file:\/\//, "")) }
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  function accentA(a) { return Qt.rgba(accent.r, accent.g, accent.b, a) }
  function bgA(a) { return Qt.rgba(bg.r, bg.g, bg.b, a) }
  property double checkedAt: 0
  function refresh() { if (Date.now() - checkedAt > 1800000) check() }
  function scrollBy(d) { flick.scrollBy(d) }
  function check() { if (updBusy || checkProc.running) return; checkedAt = Date.now(); checkProc.running = true }
  function toggle() { open = !open; if (open && !updAvail && updState === "") check() }
  function close() { open = false }
  function runUpdate() { if (updBusy) return; updBusy = true; updState = ""; updOut = ""; runProc.running = true }

  Component.onCompleted: firstCheck.start()
  Timer { id: firstCheck; interval: 25000; onTriggered: root.check() }
  Timer { id: copiedTimer; interval: 1600; onTriggered: root.copied = false }

  Process {
    id: checkProc
    command: ["python3", root.path("bin/update-check"), root.path(".")]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim())
          root.updAvail = d.available === true
          root.updCur = String(d.current || ""); root.updLatest = String(d.latest || "")
          root.updChanges = d.changes || []; root.updRecent = d.recent || []; root.updDirty = d.dirty === true
        } catch (e) { }
      }
    }
  }
  Process {
    id: runProc
    command: ["bash", "-c", 'omarchy plugin update "$1" --yes 2>&1', "bash", root.pluginId]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.updOut = String(text).trim().split("\n").slice(-4).join("\n")
    }
    onExited: function(exitCode, exitStatus) {
      root.updBusy = false
      root.updState = exitCode === 0 ? "ok" : "fail"
      if (exitCode === 0) root.updAvail = false
    }
  }

  Rectangle {
    id: face
    anchors.fill: parent
    radius: height / 2
    color: root.hot ? root.accentA(root.open || mouse.containsMouse ? 0.34 : 0.2)
                    : (root.open ? root.fgA(0.22) : (mouse.containsMouse ? root.fgA(0.14) : "transparent"))
    border.width: root.hot ? 1 : 0
    border.color: root.accent
  }
  Canvas {
    id: spark
    width: root.size
    height: root.size
    anchors.left: parent.left
    anchors.verticalCenter: parent.verticalCenter
    opacity: root.hot || root.open || mouse.containsMouse ? 1 : 0.7
    scale: 1
    property color ink: root.hot ? root.accent : root.fg
    onInkChanged: requestPaint()
    onWidthChanged: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      var w = width
      ctx.strokeStyle = ink
      ctx.lineWidth = Math.max(1.3, w * 0.065)
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
      var top = w * 0.22, bot = w * 0.78, l = w * 0.24, r = w * 0.88
      ctx.fillStyle = Qt.rgba(ink.r, ink.g, ink.b, root.hot ? 0.35 : 0)
      ctx.beginPath(); ctx.rect(l, top, r - l, bot - top); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(l - w * 0.1, top + w * 0.1); ctx.lineTo(l - w * 0.1, bot); ctx.lineTo(l, bot); ctx.stroke()
      ctx.beginPath(); ctx.rect(l + w * 0.07, top + w * 0.07, w * 0.2, w * 0.17); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(l + w * 0.34, top + w * 0.1); ctx.lineTo(r - w * 0.07, top + w * 0.1)
      ctx.moveTo(l + w * 0.34, top + w * 0.21); ctx.lineTo(r - w * 0.07, top + w * 0.21)
      ctx.moveTo(l + w * 0.07, top + w * 0.33); ctx.lineTo(r - w * 0.07, top + w * 0.33)
      ctx.moveTo(l + w * 0.07, top + w * 0.44); ctx.lineTo(r - w * 0.07, top + w * 0.44)
      ctx.stroke()
    }
    Connections { target: root; function onHotChanged() { spark.requestPaint() } }
    SequentialAnimation on scale {
      running: root.hot && !root.open
      loops: Animation.Infinite
      NumberAnimation { to: 1.18; duration: 900; easing.type: Easing.InOutSine }
      NumberAnimation { to: 1.0; duration: 900; easing.type: Easing.InOutSine }
      onRunningChanged: if (!running) spark.scale = 1
    }
  }
  Text {
    id: newLabel
    visible: root.hot
    anchors.left: spark.right
    anchors.leftMargin: -Style.space(4)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: "NEW"
    color: root.fg
    font.family: root.fontFamily
    font.pixelSize: Math.round(root.size * 0.4)
    font.bold: true
    font.letterSpacing: 0.5
  }
  MouseArea {
    id: mouse
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: { root.tipShown = false; root.toggle() }
    onContainsMouseChanged: { if (containsMouse) tipDelay.restart(); else { tipDelay.stop(); root.tipShown = false } }
  }
  // Drawn inside the panel, not a Qt ToolTip: that one is its own window and needs a graphics surface of its own.
  Timer { id: tipDelay; interval: 400; onTriggered: root.tipShown = mouse.containsMouse && !root.open }
  property bool tipShown: false
  Rectangle {
    id: tip
    parent: root.flyoutParent
    visible: root.tipShown && !root.open
    z: 60
    property point at: root.tipShown ? root.mapToItem(parent, root.width, root.height) : Qt.point(0, 0)
    width: tipText.implicitWidth + Style.space(16)
    height: tipText.implicitHeight + Style.space(10)
    x: Math.max(Style.space(4), Math.min(parent.width - width - Style.space(4), at.x - width))
    y: at.y + Style.space(4)
    radius: Style.space(4)
    color: root.bgA(1)
    border.width: 1
    border.color: root.fgA(0.5)
    Text {
      id: tipText
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: (root.hot ? "Update " + root.updLatest + " is ready" : "What's new") + (root.keyHint !== "" ? " (" + root.keyHint + ")" : "")
      color: root.fg
      font.family: root.fontFamily
      font.pixelSize: Style.font.bodySmall
    }
  }

  Rectangle {
    id: fly
    parent: root.flyoutParent
    visible: root.open
    z: 50
    width: Math.min(parent.width - Style.space(20), Style.space(520))
    height: col.implicitHeight + Style.space(24)
    x: parent.width - width - Style.space(10)
    y: Style.space(10) + root.size + Style.space(4)
    radius: Style.space(8)
    color: root.bgA(1)
    border.width: 1
    border.color: root.fgA(0.6)

    MouseArea { anchors.fill: parent }

    Column {
      id: col
      x: Style.space(12)
      y: Style.space(12)
      width: parent.width - Style.space(24)
      spacing: Style.space(8)

      Text {
        width: parent.width
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
        text: root.updState === "ok" ? "Updated" + (root.updLatest !== "" ? " to " + root.updLatest : "")
              : (root.updState === "fail" ? "The update did not finish"
              : (root.updAvail ? "Update available" + (root.updLatest !== "" ? ": " + (root.updCur !== "" ? root.updCur + " to " : "") + root.updLatest : "")
              : "What's new" + (root.updCur !== "" ? " (you have " + root.updCur + ")" : "")))
        color: root.fg
        font.family: root.fontFamily
        font.pixelSize: Style.font.body * 1.1
        font.bold: true
      }
      Text {
        visible: root.updState === ""
        width: parent.width
        textFormat: Text.PlainText
        text: (root.updAvail ? root.updChanges : root.updRecent).length === 0 ? "No release notes yet."
              : (root.updAvail ? "What changed (scroll for more)" : "All updates so far, newest first (scroll)")
        opacity: 0.7
        color: root.fg
        font.family: root.fontFamily
        font.pixelSize: Style.font.body * 0.9
      }
      Flickable {
        id: flick
        visible: root.updState === ""
        width: parent.width
        height: Math.min(contentHeight, Math.round(fly.parent.height * 0.5))
        contentWidth: width
        contentHeight: list.height
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        function scrollBy(d) {
          cancelFlick()
          contentY = Math.max(0, Math.min(Math.max(0, contentHeight - height), contentY + d))
        }
        WheelHandler {
          acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
          onWheel: function(event) { flick.scrollBy(-(event.pixelDelta.y !== 0 ? event.pixelDelta.y : event.angleDelta.y * 1.25)) }
        }
        Rectangle {
          visible: flick.contentHeight > flick.height
          x: flick.width - width
          y: flick.contentY + flick.contentY / Math.max(1, flick.contentHeight - flick.height) * (flick.height - height)
          width: Style.space(4)
          height: Math.max(Style.space(30), flick.height * flick.height / flick.contentHeight)
          radius: width / 2
          color: root.fgA(0.4)
          z: 5
        }
        Column {
          id: list
          width: flick.width - Style.space(10)
          spacing: Style.space(3)
          Repeater {
            model: root.updAvail ? root.updChanges : root.updRecent
            delegate: Text {
              required property string modelData
              width: parent.width
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
              text: "·  " + modelData
              color: root.fg
              font.family: root.fontFamily
              font.pixelSize: Style.font.body * 0.95
            }
          }
        }
      }
      Text {
        visible: root.updState === "" && root.updDirty
        width: parent.width
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
        text: "This copy has local edits. The update may refuse to run until they are saved or undone."
        color: root.fg
        opacity: 0.85
        font.family: root.fontFamily
        font.pixelSize: Style.font.body * 0.9
      }
      Text {
        visible: root.updState !== ""
        width: parent.width
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
        text: root.updState === "ok" ? "Restart the shell to load the new version. The bar is gone for a minute or two." : root.updOut
        color: root.fg
        font.family: root.fontFamily
        font.pixelSize: Style.font.body * 0.95
      }
      Row {
        width: parent.width
        spacing: Style.space(8)
        readonly property int n: (root.updAvail && root.updState !== "ok" ? 2 : 0) + (root.updState === "ok" ? 1 : 0) + 1
        readonly property real w: Math.floor((width - spacing * (n - 1)) / n)
        WnRow {
          visible: root.updAvail && (root.updState === "" || root.updState === "fail")
          width: parent.w
          label: root.updBusy ? "Updating..." : (root.updState === "fail" ? "Try again" : "Update now")
          dim: root.updBusy
          onClicked: root.runUpdate()
        }
        WnRow {
          visible: root.updAvail && root.updState !== "ok"
          width: parent.w
          label: root.copied ? "Copied" : "Copy command"
          onClicked: { Quickshell.execDetached(["wl-copy", root.updCmd]); root.copied = true; copiedTimer.restart() }
        }
        WnRow {
          visible: root.updState === "ok"
          width: parent.w
          label: "Restart the shell now"
          onClicked: Quickshell.execDetached(["omarchy-restart-shell"])
        }
        WnRow {
          width: parent.w
          label: root.updState === "ok" ? "Later" : (root.updAvail ? "Not now" : "Close")
          onClicked: root.close()
        }
      }
    }
  }

  component WnRow: Rectangle {
    id: wr
    property string label: ""
    property bool dim: false
    signal clicked()
    height: Style.space(28)
    radius: Style.space(6)
    color: wm.containsMouse && !dim ? root.fgA(0.14) : root.fgA(0.06)
    opacity: dim ? 0.4 : 1
    Text {
      anchors.fill: parent
      anchors.leftMargin: Style.space(8)
      anchors.rightMargin: Style.space(8)
      verticalAlignment: Text.AlignVCenter
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
      textFormat: Text.PlainText
      text: wr.label
      color: root.fg
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
    }
    MouseArea {
      id: wm
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: wr.dim ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: if (!wr.dim) wr.clicked()
    }
  }
}
