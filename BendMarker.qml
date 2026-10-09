import QtQuick
import Quickshell
import Quickshell.Wayland

// A 3x2 pixel block (magenta, green, magenta columns; a 1px-tall layer is not mapped by Hyprland) in the top-left corner of the monitor that holds the pointer.
// The cursor-bend screen shader reads them to tell that monitor from the others and hides them again.
Scope {
  id: marker

  property bool active: false
  property point mouse: Qt.point(-10000, -10000)

  Variants {
    model: marker.active ? Quickshell.screens : []

    PanelWindow {
      id: win
      required property var modelData
      screen: modelData
      readonly property bool here: marker.mouse.x >= screen.x && marker.mouse.x < screen.x + screen.width
                                   && marker.mouse.y >= screen.y && marker.mouse.y < screen.y + screen.height
      visible: here
      color: "transparent"
      exclusionMode: ExclusionMode.Ignore
      anchors { top: true; left: true }
      implicitWidth: 3
      implicitHeight: 2
      mask: Region {}
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.namespace: "omashaders-bend-marker"

      Row {
        anchors.fill: parent
        Rectangle { width: 1; height: 2; color: "#ff00ff" }
        Rectangle { width: 1; height: 2; color: "#00ff00" }
        Rectangle { width: 1; height: 2; color: "#ff00ff" }
      }
    }
  }
}
