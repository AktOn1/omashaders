import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// The Wallhaven browser: a big keyboard + mouse panel to search wallhaven.cc (public API, safe-for-work only,
// no key) and set a picture as the wallpaper. All network work is done by bin/wallhaven (curl); this file only
// shows results. Loaded by Core.qml through FxHost (props: core, open).
//   keys: arrows / hjkl move, Enter or Space = use as wallpaper, / = search, ,/. = previous/next page,
//         s sort, r resolution, a ratio, c colour, 1 2 3 = categories, t = create a theme from it, o = open the page, Esc = close
Item {
  id: wh
  property var core: null
  property bool open: false

  readonly property color fg: core ? core.fg : "white"
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  readonly property string font: core ? core.bar.fontFamily : "sans"
  function close() { if (core) core.whOpen = false }
  function closeForPopoutSwitch() { close() }

  // ------------------------------------------------------------ filters
  readonly property var sorts: [
    { id: "toplist", label: "Top" }, { id: "relevance", label: "Relevance" }, { id: "random", label: "Random" },
    { id: "views", label: "Most viewed" }, { id: "favorites", label: "Most favorited" }, { id: "date_added", label: "Newest" }]
  readonly property var ratios: [
    { id: "", label: "any shape" }, { id: "16x9", label: "16:9" }, { id: "16x10", label: "16:10" }, { id: "21x9", label: "21:9" },
    { id: "4x3", label: "4:3" }, { id: "9x16", label: "portrait" }]
  readonly property var swatches: ["660000", "990000", "cc0000", "cc3333", "ea4c88", "993399", "663399", "333399", "0066cc", "0099cc", "66cccc",
    "77cc33", "669900", "336600", "666600", "999900", "cccc33", "ffff00", "ffcc33", "ff9900", "ff6600", "cc6633", "996633", "663300",
    "000000", "999999", "cccccc", "ffffff", "424153"]
  readonly property string monitorRes: panel.screen ? Math.round(panel.screen.width * panel.screen.devicePixelRatio) + "x" + Math.round(panel.screen.height * panel.screen.devicePixelRatio) : "1920x1080"
  readonly property var resolutions: {
    var l = [{ id: "", label: "any size" }, { id: monitorRes, label: monitorRes + " (this screen)" }]
    ;["1920x1080", "2560x1440", "3840x2160"].forEach(function(r) { if (r !== monitorRes) l.push({ id: r, label: "at least " + r }) })
    return l
  }
  property string query: ""
  property string cats: "111"
  property int sortIdx: 0
  property int resIdx: 1
  property int ratioIdx: 0
  property string colorHex: ""
  property int page: 1
  property int lastPage: 1
  property int total: 0
  property string seed: ""

  property var results: []
  property int sel: 0
  readonly property var item: results.length > 0 ? results[Math.max(0, Math.min(sel, results.length - 1))] : null
  property bool loading: false
  property string status: ""
  property bool statusBad: false
  property bool used: false
  property string previewPath: ""
  property bool searched: false
  readonly property bool busy: loading || useProc.running

  function say(t, bad) { status = t; statusBad = !!bad }

  // ------------------------------------------------------------ searching (debounced; bin/wallhaven also spaces API calls)
  property bool pending: false
  function changed() { page = 1; seed = ""; debounce.restart() }
  function searchNow() { debounce.stop(); if (searchProc.running) { pending = true; return } doSearch() }
  function doSearch() {
    pending = false
    loading = true
    say("Searching…", false)
    var sortId = sorts[sortIdx].id
    var c = ["python3", core.path("bin/wallhaven"), "search", "--q", query.trim(), "--cats", cats, "--sort", sortId, "--page", String(page)]
    if (resolutions[resIdx].id !== "") c.push("--atleast", resolutions[resIdx].id)
    if (ratios[ratioIdx].id !== "") c.push("--ratio", ratios[ratioIdx].id)
    if (colorHex !== "") c.push("--color", colorHex)
    if (sortId === "random" && seed !== "") c.push("--seed", seed)
    c.push("--json")
    searchProc.command = c
    searchProc.running = true
  }
  function goPage(d) {
    var n = Math.max(1, Math.min(lastPage, page + d))
    if (n === page) return
    page = n
    searchNow()
  }
  Timer { id: debounce; interval: 700; onTriggered: wh.searchNow() }
  Process {
    id: searchProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        wh.loading = false
        var d = null
        try { d = JSON.parse(String(text)) } catch (e) { d = null }
        if (!d) wh.say("Wallhaven did not answer. Check the network and try again.", true)
        else if (d.error) wh.say(d.error, true)
        else {
          wh.results = d.results || []
          wh.lastPage = Math.max(1, d.last_page || 1)
          wh.total = d.total || 0
          wh.seed = d.seed || wh.seed
          wh.sel = 0
          wh.searched = true
          wh.say(wh.results.length === 0 ? "Nothing found. Try another word or loosen a filter." : "", false)
          grid.positionViewAtBeginning()
        }
        if (wh.pending) wh.doSearch()
      }
    }
  }

  // ------------------------------------------------------------ preview + use
  onItemChanged: { used = false; previewPath = ""; if (item) previewDelay.restart() }
  Timer { id: previewDelay; interval: 250; onTriggered: if (wh.item) { previewProc.id = wh.item.id; previewProc.command = ["python3", wh.core.path("bin/wallhaven"), "preview", wh.item.id]; previewProc.running = true } }
  Process {
    id: previewProc
    property string id: ""
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: if (wh.item && wh.item.id === previewProc.id && String(text).trim() !== "") wh.previewPath = String(text).trim()
    }
  }
  function useIt() {
    if (!item || busy) return
    var id = item.id
    say("Downloading " + id + " (" + item.res + ")…", false)
    useProc.id = id
    useProc.command = ["python3", core.path("bin/wallhaven"), "use", id]
    useProc.running = true
  }
  Process {
    id: useProc
    property string id: ""
    stdout: StdioCollector { id: useOut; waitForEnd: true }
    stderr: StdioCollector { id: useErr; waitForEnd: true }
    onExited: function(code) {
      if (code === 0) {
        wh.say("Wallpaper set: Wallhaven " + useProc.id, false)
        if (wh.item && wh.item.id === useProc.id) wh.used = true
        wh.core.wallhavenUsed(useProc.id)
      } else {
        var e = String(useErr.text).trim().split("\n").pop()
        wh.say(e !== "" ? e : "Could not set the wallpaper", true)
      }
    }
  }
  function themeIt() {
    if (!item) return
    if (!core.aiAvailable) { say("Needs an AI command: see “AI themes” in the README (setting aiCommand).", true); return }
    core.aiThemeFromWallhaven(item.id)
    close()
  }
  function openPage() { if (item) Quickshell.execDetached(["xdg-open", "https://wallhaven.cc/w/" + item.id]) }

  function cycle(which, d) {
    if (which === "sort") sortIdx = (sortIdx + d + sorts.length) % sorts.length
    else if (which === "res") resIdx = (resIdx + d + resolutions.length) % resolutions.length
    else if (which === "ratio") ratioIdx = (ratioIdx + d + ratios.length) % ratios.length
    else if (which === "color") {
      var i = swatches.indexOf(colorHex) + d
      colorHex = i < 0 || i >= swatches.length ? "" : swatches[i]
    }
    changed()
  }
  function toggleCat(i) {
    var a = cats.split("")
    a[i] = a[i] === "1" ? "0" : "1"
    cats = a.join("") === "000" ? "111" : a.join("")
    changed()
  }
  function move(dx, dy) {
    if (results.length === 0) return
    var cols = grid.cols
    var n = sel + dx + dy * cols
    if (dy !== 0 && n >= results.length) n = results.length - 1
    sel = Math.max(0, Math.min(results.length - 1, n))
    grid.positionViewAtIndex(sel, GridView.Contain)
  }
  function handleKey(t) {
    if (t === "/") { searchField.forceActiveFocus(); searchField.selectAll() }
    else if (t === ".") goPage(1)
    else if (t === ",") goPage(-1)
    else if (t === "s") cycle("sort", 1)
    else if (t === "r") cycle("res", 1)
    else if (t === "a") cycle("ratio", 1)
    else if (t === "c") cycle("color", 1)
    else if (t === "C") cycle("color", -1)
    else if (t === "1" || t === "2" || t === "3") toggleCat(parseInt(t) - 1)
    else if (t === "t") themeIt()
    else if (t === "o") openPage()
    else if (t === "q") close()
  }

  onOpenChanged: {
    if (open && !searched) { searchNow() }
  }

  component Btn: Rectangle {
    id: b
    property string label: ""
    property bool toggle: false
    property bool checked: false
    property bool dim: false
    property real fontScale: 1
    signal clicked()
    signal wheeled(int dir)
    height: Style.space(26)
    width: txt.implicitWidth + Style.space(20)
    radius: Style.space(6)
    color: toggle ? wh.fgA(checked ? (ma.containsMouse ? 0.24 : 0.17) : (ma.containsMouse ? 0.1 : 0.03)) : wh.fgA(ma.containsMouse && !dim ? 0.32 : 0.22)
    border.width: toggle ? 1 : 0
    border.color: wh.fgA(checked ? 0.5 : 0.22)
    opacity: dim ? 0.45 : 1
    Text {
      id: txt
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: b.label
      color: wh.fg
      opacity: b.toggle && !b.checked ? 0.75 : 1
      font.family: wh.font
      font.pixelSize: Style.font.body * b.fontScale
      font.bold: !b.toggle
    }
    MouseArea {
      id: ma
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: b.dim ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: b.clicked()
      onWheel: function(w) { b.wheeled(w.angleDelta.y > 0 ? -1 : 1) }
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: wh.core
    bar: wh.core ? wh.core.bar : null
    owner: wh
    open: wh.open
    focusTarget: keys
    contentWidth: panel.fittedContentWidth(Style.space(1120))
    contentHeight: panel.fittedContentHeight(Style.space(680))

    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      blocked: searchField.activeFocus
      onMoveRequested: function(dx, dy) { wh.move(dx, dy) }
      onActivateRequested: wh.useIt()
      onDeleteRequested: {}
      onCloseRequested: wh.close()
      onTabRequested: function(dir) { wh.goPage(dir) }
      onTextKey: function(t) { wh.handleKey(t) }

      Column {
        id: col
        anchors.fill: parent
        spacing: Style.space(8)

        // ---- filter row 1: search, categories, sort, size, shape
        Row {
          id: row1
          width: col.width
          height: Style.space(28)
          spacing: Style.space(6)
          TextField {
            id: searchField
            width: row1.width - catRow.width - sortBtn.width - resBtn.width - ratioBtn.width - 4 * row1.spacing
            height: row1.height
            verticalPadding: Style.space(2)
            placeholderText: "/  search Wallhaven, ⏎ to search (try: neon city, forest, -people)"
            foreground: wh.fg
            font.family: wh.font
            font.pixelSize: Style.font.body
            maximumLength: 100
            onTextChanged: wh.query = text
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { wh.page = 1; wh.seed = ""; wh.searchNow(); keys.forceActiveFocus(); event.accepted = true }
              else if (event.key === Qt.Key_Down) { keys.forceActiveFocus(); event.accepted = true }
            }
          }
          Row {
            id: catRow
            spacing: Style.space(4)
            Btn { label: "General"; toggle: true; checked: wh.cats.charAt(0) === "1"; onClicked: wh.toggleCat(0) }
            Btn { label: "Anime"; toggle: true; checked: wh.cats.charAt(1) === "1"; onClicked: wh.toggleCat(1) }
            Btn { label: "People"; toggle: true; checked: wh.cats.charAt(2) === "1"; onClicked: wh.toggleCat(2) }
          }
          Btn { id: sortBtn; label: "󰒺 " + wh.sorts[wh.sortIdx].label; onClicked: wh.cycle("sort", 1); onWheeled: function(d) { wh.cycle("sort", d) } }
          Btn { id: resBtn; label: "󰍹 " + wh.resolutions[wh.resIdx].label; onClicked: wh.cycle("res", 1); onWheeled: function(d) { wh.cycle("res", d) } }
          Btn { id: ratioBtn; label: "󰹑 " + wh.ratios[wh.ratioIdx].label; onClicked: wh.cycle("ratio", 1); onWheeled: function(d) { wh.cycle("ratio", d) } }
        }

        // ---- filter row 2: colour swatches, paging
        Row {
          id: row2
          width: col.width
          height: Style.space(26)
          spacing: Style.space(8)
          Text {
            height: row2.height
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.PlainText
            text: "Colour (c)"
            color: wh.fg
            opacity: 0.7
            font.family: wh.font
            font.pixelSize: Style.font.body * 0.9
          }
          Rectangle {
            width: Style.space(40); height: row2.height - Style.space(6); y: Style.space(3)
            radius: Style.space(4)
            color: wh.colorHex === "" ? wh.fgA(0.3) : wh.fgA(0.08)
            border.width: 1; border.color: wh.fgA(0.4)
            Text { anchors.centerIn: parent; text: "any"; color: wh.fg; font.family: wh.font; font.pixelSize: Style.font.body * 0.85 }
            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { wh.colorHex = ""; wh.changed() } }
          }
          Row {
            spacing: Style.space(3)
            Repeater {
              model: wh.swatches
              Rectangle {
                required property string modelData
                width: Style.space(17); height: row2.height - Style.space(6); y: Style.space(3)
                radius: Style.space(3)
                color: "#" + modelData
                border.width: wh.colorHex === modelData ? 2 : 1
                border.color: wh.colorHex === modelData ? wh.fg : wh.fgA(0.3)
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { wh.colorHex = modelData; wh.changed() } }
              }
            }
          }
          Item { width: 1; height: 1 }
        }

        // ---- grid + detail
        Row {
          id: mainRow
          width: col.width
          height: col.height - row1.height - row2.height - foot.height - 3 * col.spacing
          spacing: Style.space(12)

          GridView {
            id: grid
            width: mainRow.width - detail.width - mainRow.spacing
            height: mainRow.height
            clip: true
            readonly property int cols: Math.max(2, Math.floor(width / Style.space(190)))
            cellWidth: Math.floor(width / cols)
            cellHeight: Math.round(cellWidth * 0.62)
            model: wh.results
            currentIndex: wh.sel
            boundsBehavior: Flickable.StopAtBounds
            delegate: Item {
              id: cell
              required property var modelData
              required property int index
              width: grid.cellWidth
              height: grid.cellHeight
              Rectangle {
                anchors.fill: parent
                anchors.margins: Style.space(3)
                radius: Style.space(5)
                color: wh.fgA(0.08)
                clip: true
                border.width: cell.index === wh.sel ? 2 : 0
                border.color: wh.fg
                Image {
                  anchors.fill: parent
                  anchors.margins: cell.index === wh.sel ? 2 : 0
                  source: cell.modelData.thumb ? "file://" + cell.modelData.thumb : ""
                  fillMode: Image.PreserveAspectCrop
                  asynchronous: true
                  cache: false
                  sourceSize.width: 320
                }
                Rectangle {
                  anchors.right: parent.right; anchors.bottom: parent.bottom
                  anchors.margins: Style.space(4)
                  width: resText.implicitWidth + Style.space(8); height: resText.implicitHeight + Style.space(2)
                  radius: Style.space(3)
                  color: "#99000000"
                  Text { id: resText; anchors.centerIn: parent; text: cell.modelData.res; color: "white"; font.family: wh.font; font.pixelSize: Style.font.body * 0.75 }
                }
                MouseArea {
                  anchors.fill: parent
                  cursorShape: Qt.PointingHandCursor
                  onClicked: wh.sel = cell.index
                  onDoubleClicked: { wh.sel = cell.index; wh.useIt() }
                }
              }
            }
            Text {
              anchors.centerIn: parent
              visible: wh.results.length === 0
              width: parent.width * 0.8
              horizontalAlignment: Text.AlignHCenter
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
              text: wh.loading ? "Searching…" : (wh.searched ? "Nothing found." : "")
              color: wh.fg; opacity: 0.6
              font.family: wh.font; font.pixelSize: Style.font.body
            }
          }

          Column {
            id: detail
            width: Style.space(340)
            height: mainRow.height
            spacing: Style.space(8)
            Rectangle {
              width: detail.width
              height: Math.round(width * 0.58)
              radius: Style.space(6)
              color: wh.fgA(0.08)
              clip: true
              Image {
                anchors.fill: parent
                source: wh.previewPath !== "" ? "file://" + wh.previewPath : (wh.item && wh.item.thumb ? "file://" + wh.item.thumb : "")
                fillMode: Image.PreserveAspectCrop
                asynchronous: true
                cache: false
              }
            }
            Text {
              width: detail.width
              visible: !!wh.item
              textFormat: Text.PlainText
              elide: Text.ElideRight
              text: wh.item ? wh.item.res + "   󰋑 " + wh.item.favorites + "   󰈈 " + wh.item.views + "   " + wh.item.category : ""
              color: wh.fg
              font.family: wh.font; font.pixelSize: Style.font.body
            }
            Row {
              spacing: Style.space(4)
              visible: !!wh.item
              Repeater {
                model: wh.item ? wh.item.colors : []
                Rectangle { required property string modelData; width: Style.space(22); height: Style.space(12); radius: Style.space(3); color: modelData; border.width: 1; border.color: wh.fgA(0.3) }
              }
            }
            Btn {
              width: detail.width
              label: wh.used ? "󰄬 Wallpaper set (⏎)" : (useProc.running ? "Downloading…" : "󰸉 Use as wallpaper (⏎)")
              dim: !wh.item || wh.busy
              onClicked: wh.useIt()
            }
            Btn {
              width: detail.width
              label: wh.core && wh.core.aiAvailable ? "󰧑 Create theme from this (t)" : "󰧑 Create theme from this: needs AI"
              dim: !wh.item || !(wh.core && wh.core.aiAvailable)
              onClicked: wh.themeIt()
            }
            Btn {
              width: detail.width
              label: "󰖟 Open on wallhaven.cc (o)"
              toggle: true
              dim: !wh.item
              onClicked: wh.openPage()
            }
            Text {
              width: detail.width
              visible: !!wh.item
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
              text: wh.item ? "Picture by a Wallhaven user. Credit and licence: wallhaven.cc/w/" + wh.item.id : ""
              color: wh.fg; opacity: 0.55
              font.family: wh.font; font.pixelSize: Style.font.body * 0.85
            }
          }
        }

        // ---- footer: status + paging
        Row {
          id: foot
          width: col.width
          height: Style.space(28)
          spacing: Style.space(8)
          Text {
            width: foot.width - pager.width - foot.spacing
            height: foot.height
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: wh.status !== "" ? wh.status : (wh.total > 0 ? wh.total + " pictures · data and images from wallhaven.cc · safe for work only" : "wallhaven.cc · safe for work only")
            color: wh.statusBad ? "#ff8080" : wh.fg
            opacity: wh.status !== "" ? 1 : 0.55
            font.family: wh.font; font.pixelSize: Style.font.body * 0.9
          }
          Row {
            id: pager
            spacing: Style.space(6)
            Btn { label: "‹ Prev ( , )"; dim: wh.page <= 1 || wh.loading; onClicked: if (!dim) wh.goPage(-1) }
            Text {
              height: Style.space(26)
              verticalAlignment: Text.AlignVCenter
              textFormat: Text.PlainText
              text: "page " + wh.page + " / " + wh.lastPage
              color: wh.fg
              font.family: wh.font; font.pixelSize: Style.font.body
            }
            Btn { label: "Next ( . ) ›"; dim: wh.page >= wh.lastPage || wh.loading; onClicked: if (!dim) wh.goPage(1) }
          }
        }
      }
    }
  }
}
