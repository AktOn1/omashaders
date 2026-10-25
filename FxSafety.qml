import QtQuick
import Quickshell
import Quickshell.Io

// Keeps a broken effect from filling the disk or memory (loaded by both menu layouts; the menu code stays in Core*.qml).
//  1. Startup: rebuilds generated effects whose compiled shader is bad (`ready` turns true when that is done).
//  2. Gates: an effect is drawn only after bin/fxcheck.py said its compiled shader is usable (wallOkName, wall2OkName, mouseOkName).
//     A bad one is switched off (switchOff) with one short notice (notice). report() does the same for a shader the
//     renderer refused later.
//  3. bin/fx-guard watches the shell log and memory; a shader error or a fast-growing log / memory calls trip(), which
//     switches every shell-drawn effect off; if that does not stop it, the guard clears the settings itself.
// The menu code passes plain properties and functions because a type from a sibling file cannot be used by name here
// (files are loaded by versioned url, see Core.sub).
Scope {
  id: s
  property string pluginDir: ""        // folder of the plugin, with a trailing slash
  property string stateDir: ""
  property bool host: false            // only the instance that draws the effects runs the guard
  property string wall: ""             // requested effects ("" = none)
  property string wall2: ""
  property string mouse: ""
  property var switchOff: null         // function (kind, name)
  property var notice: null            // function (text)
  property var trip: null              // function (why) -> true when an effect was switched off

  // the name that passed the check, never the name just asked for: the caller compares it with what it wants, so a stale value cannot let a new, unchecked effect through
  readonly property string wallOkName: g1.okName
  readonly property string wall2OkName: g2.okName
  readonly property string mouseOkName: g3.okName

  readonly property string checkScript: pluginDir + "bin/fxcheck.py"
  readonly property string guardScript: pluginDir + "bin/fx-guard"
  property bool ready: false
  readonly property string runtime: Quickshell.env("XDG_RUNTIME_DIR") || ""
  readonly property string logFile: runtime !== "" ? runtime + "/quickshell/by-id/" + Quickshell.instanceId + "/log.log" : ""

  function qsbOf(kind, name) {
    var sub = kind === "mouse" ? "mouse" : "wall"
    if (name.indexOf("ai-") === 0) return stateDir + "/generated/" + sub + "/" + name + ".frag.qsb"
    return pluginDir + (kind === "mouse" ? "mouse-effects/" : "wallpaper-effects/") + name + ".frag.qsb"
  }
  function pngOf(kind, name) {
    if (kind === "mouse") return ""
    return name.indexOf("ai-") === 0 && /-sp(-[0-9]+)?$/.test(name) ? stateDir + "/generated/wall/" + name + ".png" : ""
  }

  property var noticeAt: ({})
  function say(key, text) {
    var now = Date.now()
    if (noticeAt[key] && now - noticeAt[key] < 10000) return
    noticeAt[key] = now
    if (notice) notice(text)
  }
  readonly property var kindWords: ({ wall: "wallpaper effect", wall2: "second wallpaper effect", mouse: "cursor effect" })

  // driver = true: the renderer refused a shader that looked fine, so this build is remembered as broken
  function report(kind, name, why, driver) {
    if (name === "") return
    if (driver) Quickshell.execDetached(["python3", checkScript, "block", stateDir, name, qsbOf(kind, name), why])
    if (switchOff) switchOff(kind, name)
    say(kind + ":" + name, "The " + (kindWords[kind] || "effect") + " \"" + name + "\" cannot run here (" + why + "), so it was switched off.")
  }

  component Gate: Scope {
    id: gate
    required property string kind
    property string name: ""
    readonly property string qsbPath: name !== "" && s.stateDir !== "" ? s.qsbOf(kind, name) : ""
    readonly property string pngPath: name !== "" ? s.pngOf(kind, name) : ""
    property string verdictFor: ""
    property string verdict: ""
    property string asked: ""
    property string askedPath: ""
    property var okPaths: ({})
    readonly property string okName: name !== "" && verdictFor === name && verdict === "ok" ? name : ""
    readonly property string problem: name !== "" && verdictFor === name && verdict !== "ok" ? verdict : ""
    onProblemChanged: if (problem !== "") { var k = kind, n = name, why = problem; Qt.callLater(function() { s.report(k, n, why, false) }) } // later: switching off changes name, i.e. problem itself

    function start() {
      if (name === "" || !s.ready || qsbPath === "") { verdictFor = ""; verdict = ""; return }
      if (okPaths[name] === qsbPath) { verdictFor = name; verdict = "ok"; return }
      if (proc.running) return // onExited asks again when what is wanted changed meanwhile
      asked = name
      askedPath = qsbPath
      var cmd = ["python3", s.checkScript, "check", qsbPath, "--name", name, "--state", s.stateDir]
      if (pngPath !== "") cmd.push("--png", pngPath)
      proc.command = cmd
      proc.running = true
    }
    function finish(text) {
      var v = String(text).trim()
      if (asked !== name || askedPath !== qsbPath) return
      verdictFor = asked
      verdict = v === "ok" ? "ok" : (v.indexOf("bad: ") === 0 ? v.slice(5) : "the effect check could not run")
      if (verdict === "ok") { var m = okPaths; m[asked] = qsbPath; okPaths = m }
    }
    onNameChanged: start()
    onQsbPathChanged: start()
    Connections { target: s; function onReadyChanged() { gate.start() } }
    Component.onCompleted: start()

    Process {
      id: proc
      onExited: if (gate.name !== "" && !(gate.verdictFor === gate.name && gate.askedPath === gate.qsbPath)) gate.start()
      stdout: StdioCollector {
        waitForEnd: true
        onStreamFinished: gate.finish(text)
      }
    }
  }
  Gate { id: g1; kind: "wall"; name: s.wall }
  Gate { id: g2; kind: "wall2"; name: s.wall2 }
  Gate { id: g3; kind: "mouse"; name: s.mouse }

  Process {
    id: repair
    command: ["python3", s.checkScript, "repair", s.stateDir + "/generated"]
    running: s.pluginDir !== "" && s.stateDir !== ""
    onExited: s.ready = true
  }

  Process {
    id: guard
    running: s.ready && s.host && s.logFile !== ""
    command: ["python3", s.guardScript, String(Quickshell.processId), s.logFile, s.stateDir]
    stdout: SplitParser {
      onRead: line => {
        if (String(line).indexOf("trip") === 0 && s.trip && s.trip(String(line).slice(5)))
          s.say("trip", "OmaShaders switched its effects off: " + String(line).slice(5) + ".")
      }
    }
  }
}
