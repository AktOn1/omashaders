import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// Bar icon for the omashader script. Click (or `omarchy-shell io.github.akton1.omashader toggle`)
// opens a keyboard menu: categories on the left, effects on the right, hjkl to move, live preview.
// Right click = off, scroll = previous / next. Hyprland forgets the shader on a config reload, so it is re-applied.
BarWidget {
  id: root
  moduleName: "io.github.akton1.omashader"

  readonly property string script: Qt.resolvedUrl("bin/omashader").toString().replace(/^file:\/\//, "")
  readonly property string stateFile: (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state"))
                                      + "/omarchy/io.github.akton1.omashader/current"
  readonly property string animatedFile: stateFile.replace(/current$/, "animated")
  // the menu switch (state file) wins; the plugin setting is the default until it is first used
  property string animatedFlag: ""
  readonly property bool includeAnimated: animatedFlag !== "" ? animatedFlag === "1" : setting("includeAnimated", false) === true
  property string gpuText: ""
  property string current: ""
  readonly property bool shaderOn: current !== ""

  // ---- menu state ----
  property bool popupOpen: false
  property var allEntries: []          // { name, animated, cat, desc }
  property int catIndex: 0             // index into catNames; catNames.length is the "Off" row
  property int itemIndex: 0
  property int column: 0               // 0 = categories, 1 = effects
  property string origin: ""           // effect when the menu opened, restored on cancel
  property bool committed: false
  property bool previewed: false
  property string pending: ""

  readonly property var catOrder: ["Comfort", "Color", "Retro", "Devices", "Mood", "Motion"]
  readonly property var catNames: {
    var seen = {}, out = []
    root.catOrder.forEach(function(c) { seen[c] = true; out.push(c) })
    root.allEntries.forEach(function(e) { if (!seen[e.cat]) { seen[e.cat] = true; out.push(e.cat) } })
    return out
  }
  readonly property bool offSelected: catIndex >= catNames.length
  readonly property string catName: offSelected ? "" : catNames[catIndex]
  readonly property var catItems: offSelected ? [] : entriesFor(catName)
  readonly property bool motionHidden: !offSelected && catName === "Motion" && !includeAnimated
  readonly property var selectedItem: (column === 1 && itemIndex < catItems.length) ? catItems[itemIndex] : null
  readonly property int rowCount: {
    var m = catNames.length + 1
    catNames.forEach(function(c) { m = Math.max(m, allEntries.filter(function(e) { return e.cat === c }).length) })
    return m
  }
  readonly property color fg: root.bar.barForeground
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }

  function entriesFor(cat) {
    return allEntries.filter(function(e) { return e.cat === cat && (includeAnimated || !e.animated) })
  }
  function syncToCurrent() {
    column = 0
    catIndex = 0
    itemIndex = 0
    for (var i = 0; i < allEntries.length; i++) {
      if (allEntries[i].name === current) {
        var ci = catNames.indexOf(allEntries[i].cat)
        if (ci >= 0) catIndex = ci
        itemIndex = Math.max(0, entriesFor(allEntries[i].cat).indexOf(allEntries[i]))
        return
      }
    }
  }
  function indexOfCurrentInCat() {
    for (var i = 0; i < catItems.length; i++) if (catItems[i].name === current) return i
    return 0
  }

  function open() {
    origin = current
    committed = false
    previewed = false
    syncToCurrent()
    popupOpen = true
  }
  function close() {
    if (popupOpen && !committed && previewed) {
      previewTimer.stop()
      applyNow(origin)
    }
    popupOpen = false
  }
  function applyNow(name) {
    Quickshell.execDetached(name === "" ? [root.script, "off"] : [root.script, "set", name])
  }
  function pick(name) {
    previewTimer.stop()
    applyNow(name)
    committed = true
    popupOpen = false
  }
  function preview() {
    if (!selectedItem) return
    pending = selectedItem.name
    previewed = true
    previewTimer.restart()
  }
  Timer {
    id: previewTimer
    interval: 140
    onTriggered: root.applyNow(root.pending)
  }

  function move(dx, dy) {
    if (dy !== 0) {
      if (column === 0) {
        catIndex = Math.max(0, Math.min(catNames.length, catIndex + dy))
        itemIndex = indexOfCurrentInCat()
      } else if (catItems.length > 0) {
        itemIndex = Math.max(0, Math.min(catItems.length - 1, itemIndex + dy))
        preview()
      }
    } else if (dx > 0) {
      activate()
    } else if (dx < 0 && column === 1) {
      column = 0
    }
  }
  function activate() {
    if (column === 0) {
      if (offSelected) pick("")
      else if (catItems.length > 0) { column = 1; itemIndex = Math.min(itemIndex, catItems.length - 1); preview() }
    } else if (selectedItem) {
      pick(selectedItem.name)
    }
  }
  function jump(toEnd) {
    if (column === 0) {
      catIndex = toEnd ? catNames.length : 0
      itemIndex = indexOfCurrentInCat()
    } else if (catItems.length > 0) {
      itemIndex = toEnd ? catItems.length - 1 : 0
      preview()
    }
  }
  function handleText(t) {
    if (t === "q") close()
    else if (t === "a") setAnimated()
    else if (t === "o" || t === "0") pick("")
    else if (t === "g") jump(false)
    else if (t === "G") jump(true)
    else if (t >= "1" && t <= "9") {
      var n = parseInt(t) - 1
      if (n <= catNames.length) { column = 0; catIndex = n; itemIndex = indexOfCurrentInCat() }
    }
  }

  IpcHandler {
    target: "io.github.akton1.omashader"
    function toggle(): void { if (root.popupOpen) root.close(); else root.open() }
    function open(): void { if (!root.popupOpen) root.open() }
    function close(): void { root.close() }
    function set(name: string): void { root.applyNow(name === "off" ? "" : name) }
  }

  Process {
    id: lister
    command: [root.script, "listall"]
    stdout: StdioCollector {
      onStreamFinished: {
        var out = []
        String(text).split("\n").forEach(function(line) {
          var p = line.split("\t")
          if (p[0]) out.push({ name: p[0], animated: p[1] === "animated", cat: p[2] || "Other", desc: p[3] || "" })
        })
        var first = root.allEntries.length === 0
        root.allEntries = out
        if (first && root.popupOpen) root.syncToCurrent()
      }
    }
  }
  Component.onCompleted: lister.running = true
  onPopupOpenChanged: if (popupOpen) gpu.running = true
  onIncludeAnimatedChanged: itemIndex = Math.max(0, Math.min(itemIndex, catItems.length - 1))

  Process {
    id: gpu
    command: [root.script, "gpu"]
    stdout: StdioCollector {
      onStreamFinished: {
        var p = String(text).trim().split(/\s+/)
        root.gpuText = p.length === 3 ? "GPU " + p[0] + "% · VRAM " + (p[1] / 1024).toFixed(1) + "/" + (p[2] / 1024).toFixed(1) + " GB" : "GPU usage unavailable"
      }
    }
  }
  Timer {
    interval: 1000
    repeat: true
    running: root.popupOpen
    onTriggered: if (!gpu.running) gpu.running = true
  }

  function setAnimated() {
    Quickshell.execDetached([root.script, "animated", root.includeAnimated ? "off" : "on"])
  }

  function run(verb) {
    var cmd = [root.script, verb]
    if (root.includeAnimated && (verb === "next" || verb === "prev")) cmd.push("-a")
    Quickshell.execDetached(cmd)
  }

  FileView {
    path: root.animatedFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.animatedFlag = String(text() || "").trim()
    onLoadFailed: root.animatedFlag = ""
  }

  FileView {
    path: root.stateFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.current = String(text() || "").trim()
    onLoadFailed: root.current = ""
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event.name === "configreloaded" && root.shaderOn) reapplyTimer.restart()
    }
  }
  Timer {
    id: reapplyTimer
    interval: 400
    onTriggered: root.run("reapply")
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰍹"
    active: root.shaderOn
    tooltipText: (root.shaderOn ? "OmaShader: " + root.current : "OmaShader: off")
                 + "\nclick: open menu (hjkl) · right-click: off · scroll: step"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.run("off")
      else if (root.popupOpen) root.close()
      else root.open()
    }
    onWheelMoved: function(delta) { root.run(delta > 0 ? "prev" : "next") }
  }

  component MenuRow: Rectangle {
    id: row
    property string label: ""
    property string tag: ""
    property bool selected: false
    property bool strong: false
    property bool checked: false
    property bool arrow: false
    signal clicked()
    width: parent ? parent.width : 0
    height: Style.space(28)
    radius: Style.space(6)
    color: selected ? root.fgA(strong ? 0.22 : 0.10) : (mouse.containsMouse ? root.fgA(0.08) : "transparent")

    Text {
      anchors.left: parent.left
      anchors.leftMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: row.label
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      font.bold: row.selected && row.strong
    }
    Text {
      anchors.right: parent.right
      anchors.rightMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: (row.tag !== "" ? row.tag + "  " : "") + (row.checked ? "󰄬" : "") + (row.arrow ? "›" : "")
      color: root.fg
      opacity: 0.7
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
    }
    MouseArea {
      id: mouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: row.clicked()
    }
  }

  KeyboardPanel {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    focusTarget: keys
    contentWidth: popup.fittedContentWidth(Style.space(500))
    contentHeight: popup.fittedContentHeight(body.implicitHeight)

    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      onMoveRequested: function(dx, dy) { root.move(dx, dy) }
      onActivateRequested: root.activate()
      onCloseRequested: root.close()
      onTextKey: function(t) { root.handleText(t) }

      Column {
        id: body
        width: parent.width
        spacing: Style.space(4)

        MenuRow {
          label: "Animated effects  (a)"
          tag: root.includeAnimated ? "on" : "off"
          checked: root.includeAnimated
          onClicked: root.setAnimated()
        }

        Rectangle { width: body.width; height: 1; color: root.fgA(0.2) }

        Row {
          width: body.width
          height: root.rowCount * Style.space(28)
          spacing: Style.space(8)

          Column {
            id: cats
            width: Style.space(150)
            Repeater {
              model: root.catNames.length + 1
              MenuRow {
                required property int index
                readonly property bool isOff: index >= root.catNames.length
                width: cats.width
                label: isOff ? "Off" : root.catNames[index]
                selected: root.catIndex === index
                strong: root.column === 0
                arrow: !isOff && root.catIndex === index
                onClicked: {
                  if (isOff) { root.catIndex = index; root.pick("") }
                  else { root.column = 0; root.catIndex = index; root.itemIndex = root.indexOfCurrentInCat() }
                }
              }
            }
          }

          Rectangle { width: 1; height: parent.height; color: root.fgA(0.2) }

          Column {
            id: items
            width: body.width - cats.width - Style.space(8) * 2 - 1
            Repeater {
              model: root.catItems
              MenuRow {
                required property var modelData
                required property int index
                width: items.width
                label: modelData.name
                tag: modelData.animated ? "heavy" : ""
                selected: root.column === 1 && root.itemIndex === index
                strong: true
                checked: modelData.name === root.current
                onClicked: root.pick(modelData.name)
              }
            }
            Text {
              visible: root.motionHidden
              width: items.width
              wrapMode: Text.WordWrap
              leftPadding: Style.space(10)
              topPadding: Style.space(6)
              text: "Heavy GPU use. Press a to turn animated effects on."
              color: root.fg
              opacity: 0.7
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              visible: root.offSelected
              width: items.width
              wrapMode: Text.WordWrap
              leftPadding: Style.space(10)
              topPadding: Style.space(6)
              text: "Enter turns the effect off."
              color: root.fg
              opacity: 0.7
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
          }
        }

        Rectangle { width: body.width; height: 1; color: root.fgA(0.2) }

        Text {
          width: body.width
          height: Style.space(24)
          verticalAlignment: Text.AlignVCenter
          leftPadding: Style.space(10)
          elide: Text.ElideRight
          textFormat: Text.PlainText
          text: root.selectedItem ? root.selectedItem.desc : (root.current !== "" ? "Active: " + root.current : "No effect active")
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
        }
        Item {
          width: body.width
          height: Style.space(22)
          opacity: 0.65
          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            text: "hjkl move · ⏎ apply · esc undo · o off"
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            text: root.gpuText.replace(" · VRAM ", " · ").replace(" GB", "G")
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
        }
      }
    }
  }
}
