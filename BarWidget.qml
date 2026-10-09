import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// Bar icon for the screen-shader script: left click = list of effects to pick from, right click = off,
// scroll = previous / next. Hyprland forgets the shader on a config reload, so it is re-applied.
BarWidget {
  id: root
  moduleName: "io.github.akton1.screen-shaders"

  readonly property string script: Qt.resolvedUrl("bin/screen-shader").toString().replace(/^file:\/\//, "")
  readonly property string stateFile: (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state"))
                                      + "/omarchy/io.github.akton1.screen-shaders/current"
  readonly property string animatedFile: stateFile.replace(/current$/, "animated")
  // the menu switch (state file) wins; the plugin setting is the default until it is first used
  property string animatedFlag: ""
  readonly property bool includeAnimated: animatedFlag !== "" ? animatedFlag === "1" : setting("includeAnimated", false) === true
  property string gpuText: ""
  property string current: ""
  readonly property bool shaderOn: current !== ""

  property bool popupOpen: false
  property var entries: []
  function close() { popupOpen = false }

  IpcHandler {
    target: "io.github.akton1.screen-shaders"
    function toggle(): void { root.popupOpen = !root.popupOpen }
    function open(): void { root.popupOpen = true }
    function close(): void { root.popupOpen = false }
    function set(name: string): void { root.pick(name === "off" ? "" : name) }
  }

  function pick(name) {
    Quickshell.execDetached([root.script, name === "" ? "off" : "set", name])
    root.popupOpen = false
  }

  Process {
    id: lister
    command: [root.script, "listall"]
    stdout: StdioCollector {
      onStreamFinished: {
        var out = []
        String(text).split("\n").forEach(function(line) {
          var p = line.trim().split(" ")
          if (p[0] && (root.includeAnimated || p[1] !== "animated")) out.push({ name: p[0], animated: p[1] === "animated" })
        })
        root.entries = out
      }
    }
  }
  onPopupOpenChanged: if (popupOpen) { lister.running = true; gpu.running = true }

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
    onLoaded: { root.animatedFlag = String(text() || "").trim(); lister.running = true }
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
    tooltipText: (root.shaderOn ? "Screen shader: " + root.current : "Screen shader: off")
                 + "\nclick: pick from list · right-click: off · scroll: step"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.run("off")
      else root.popupOpen = !root.popupOpen
    }
    onWheelMoved: function(delta) { root.run(delta > 0 ? "prev" : "next") }
  }

  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(270))
    contentHeight: popup.fittedContentHeight(list.implicitHeight)

    Column {
      id: list
      width: parent.width
      spacing: Style.space(2)

      Rectangle {
        width: list.width
        height: Style.space(30)
        radius: Style.space(6)
        color: animMouse.containsMouse ? Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.14) : "transparent"

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          text: "Animated effects"
          color: root.bar.barForeground
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
        }
        Rectangle {
          anchors.right: parent.right
          anchors.rightMargin: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          width: Style.space(34)
          height: Style.space(18)
          radius: height / 2
          color: root.includeAnimated ? root.bar.barForeground : Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.25)
          Rectangle {
            width: parent.height - Style.space(4)
            height: width
            radius: width / 2
            y: Style.space(2)
            x: root.includeAnimated ? parent.width - width - Style.space(2) : Style.space(2)
            color: root.includeAnimated ? Qt.rgba(0, 0, 0, 0.75) : root.bar.barForeground
          }
        }
        MouseArea {
          id: animMouse
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: root.setAnimated()
        }
      }

      Rectangle {
        width: list.width
        height: 1
        color: Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.2)
      }

      Repeater {
        model: [{ name: "", animated: false }].concat(root.entries)

        Rectangle {
          required property var modelData
          readonly property bool isCurrent: modelData.name === root.current
          width: list.width
          height: Style.space(30)
          radius: Style.space(6)
          color: rowMouse.containsMouse ? Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.14)
                 : isCurrent ? Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.08) : "transparent"

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            text: (modelData.name === "" ? "off" : modelData.name) + (modelData.animated ? "  (heavy)" : "")
            color: root.bar.barForeground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            visible: parent.isCurrent
            text: "󰄬"
            color: root.bar.barForeground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          MouseArea {
            id: rowMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.pick(modelData.name)
          }
        }
      }

      Rectangle {
        width: list.width
        height: 1
        color: Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.2)
      }
      Text {
        width: list.width
        height: Style.space(26)
        verticalAlignment: Text.AlignVCenter
        leftPadding: Style.space(10)
        textFormat: Text.PlainText
        text: root.gpuText
        color: root.bar.barForeground
        opacity: 0.8
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
      }
    }
  }
}
