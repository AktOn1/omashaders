import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// One small panel for the three "theme" jobs, opened by Core.qml through FxHost (props: core, open, mode, whId, number):
//   mode "ai"      theme creation as a chat that runs as a BACKGROUND JOB (bin/aijobs.py). The first message starts a job (PICK existing effects, INVENT new ones
//                  (Quick) or RICH: a planner, builders and a reviewer; bin/aigen.py checks every generated shader). The job does not depend on this dialog:
//                  closing it (Esc), closing the menu or reloading the shell leaves it running, and the finished theme waits as a draft ("Made by AI")
//                  with Save / Discard / Change. While the draft is shown it is applied live; hiding the dialog puts the previous look back.
//                  Every next message changes the same draft ("less fog", "make the windows red like the car"). Nothing is saved until
//                  "Save as theme". Stopping a running job needs the explicit "Cancel job" button and a second click to confirm.
//   mode "share"   pick which parts go into the OMS1: code (all on by default) of the saved theme `number`, or of the look on now (number 0); the button makes it, copies it, shows it
//   mode "save"    a name field for saving the look on now as a theme
//   mode "import"  paste a code, bin/theme-code checks it (unknown ids are reported and left out) and saves it as a theme
// Everything is done by bin/ai-theme and bin/theme-code; nothing the AI or a code says is ever executed.
Item {
  id: td
  property var core: null
  property bool open: false
  property string mode: "ai"
  property string whId: ""
  property int number: 0

  readonly property color fg: core ? core.fg : "white"
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  readonly property string font: core ? core.bar.fontFamily : "sans"
  // Esc hides the dialog and nothing else: a running job keeps running, a draft stays a draft, the typed words are remembered
  function close() {
    if (mode === "ai") {
      if (busy) core.notify("OmaShaders", "Still working in the background. You will get a notification when your theme is ready.")
      else if (chatActive) core.notify("OmaShaders", "Your draft is kept. Open the menu, Themes, Made by AI, to save, change or discard it.")
    } else if (jobs.any) cancel()
    if (core) core.dlgOpen = false
  }
  function closeForPopoutSwitch() { if (core) core.dlgOpen = false }

  property string status: ""
  property bool statusBad: false
  property bool done: false
  property string shareCode: ""
  property bool useCurrent: false
  property bool subtle: false
  property bool applyIt: true
  property string codeWh: ""
  property bool codeWhCached: false
  property string shareWh: ""
  property string wallId: ""
  property bool wallFailed: false
  property string wallError: ""
  property string checkedName: ""
  property bool clipSrc: false          // the theme is read from a picture on the clipboard
  property bool probing: false          // silent clipboard check at open (no error shown when there is no picture)
  property string undoToken: ""         // an import that brought custom shaders waits for Keep or Undo
  property string prevLook: ""
  // the background job this dialog shows (core.jobs, polled by Core): "" = the new-theme form
  property string jobId: ""
  property bool fresh: false          // "New theme" was pressed: stay on the form although a job exists
  property bool confirmCancel: false
  property string actMsg: ""
  property bool actBad: false
  readonly property var job: { var l = core ? core.jobs : []; for (var i = 0; i < l.length; i++) if (l[i].id === jobId) return l[i]; return null }
  readonly property bool formMode: mode === "ai" && job === null
  readonly property bool busy: job !== null && job.alive
  readonly property bool chatActive: job !== null && job.has_result
  readonly property var res: chatActive ? job.result : null
  readonly property string resultKey: chatActive ? job.id + ":" + job.result.turn : ""
  readonly property string jobSig: job ? job.id + ":" + job.state + ":" + job.turn : ""
  readonly property string chatLine: res ? res.line : ""
  readonly property string chatName: res ? res.name : ""
  readonly property int turnNo: res ? res.turn : 0
  readonly property var card: (res && res.mode === "rich" && res.concept) ? { concept: res.concept, scores: res.scores || {}, fell: res.fell_back || [], review: res.review || "", made: res.new || [] } : null
  readonly property string sheetUrl: (res && res.mode === "rich" && res.sheet) ? "file://" + res.sheet + "?t=" + job.updated : ""
  readonly property var chatNotes: res ? (res.notes || []) : []
  property var notes: []
  readonly property var history: {
    if (!job) return []
    var h = (job.history || []).slice()
    if (job.alive && job.run && !job.run.new && job.run.message) h.push({ role: "user", text: job.run.message, changes: [] })
    else if (job.alive && job.run && job.run.new) h.push({ role: "user", text: job.request !== "" ? job.request : (job.form && job.form.surprise ? "Surprise me" : "(design it from the picture)"), changes: [] })
    return h
  }
  readonly property var shownNotes: mode === "ai" ? chatNotes : notes
  readonly property int shownElapsed: job && core ? core.jobElapsed(job) : 0
  readonly property string jobStatus: {
    if (!job) return ""
    var j = job
    if (j.alive) {
      var first = !chatActive
      return (j.progress && j.progress !== "Starting…" ? j.progress : "Starting…") + "  ·  step " + j.step + "/" + j.steps_total + "  ·  " + core.clockText(shownElapsed)
             + (j.mode === "rich" && first ? "  (Rich takes a few minutes: it plans the theme, builds each part and checks the renders)" : j.mode === "rich" ? "  (one part is made again, about a minute)" : j.mode === "invent" && first ? "  (inventing takes a minute or two)" : j.mode === "invent" ? "  (a change can take a minute)" : "  (a picture can take about 30 s)")
             + "\nStill working in the background: you can close this window, the menu or even reload the shell."
    }
    if (j.state === "interrupted" && !chatActive) return "Interrupted. " + (j.error || "") + " Retry runs it again."
    if (j.state === "failed" && !chatActive) return "That did not work: " + (j.error || "the AI answer could not be used") + " Retry runs it again."
    if (!chatActive) return ""
    var r = j.result, u = r.usage || {}
    var line = u.tokens_in ? "Turn " + r.turn + ": used " + nfmt(u.tokens_in) + " tokens in, " + nfmt(u.tokens_out || 0) + " out" + money(u.cost_usd) + (u.calls > 1 ? " in " + u.calls + " calls" : "") + ". " : ""
    var tail = "Applied: " + r.name + ". Not saved yet: keep talking to change it, or save it."
    if (j.state === "interrupted") return "The last change was interrupted. Retry runs it again, or keep this draft. " + tail
    if (j.state === "failed") return "The last change did not work: " + (j.error || "the AI answer could not be used") + ". " + tail
    return line + tail + (j.error ? " (" + j.error + ")" : "")
  }
  // provider picker, Invent mode and the Keep / Discard step
  property var provRows: []
  property string provId: "claude"
  property string provModel: ""
  property bool provStrong: true
  property bool invent: true
  // Rich = invent with a planning step, a builder per part and a reviewing step that looks at renders (bin/airich.py); invent is true too
  property bool rich: false
  property int richRounds: 2
  property bool provImage: true
  property var provEndpoint: ({ url: "", key_env: "", key_file: "" })
  property bool showSheet: true
  property bool inventReady: true
  property string inventHint: ""
  property string testMsg: ""
  property bool testBad: false
  property var est: null
  readonly property int spritesExtra: sprites ? 260 : 70
  // Painted sprites (optional, off by default): eight pictures made by the user's OWN image model for a new wallpaper effect (bin/aisprites.py, bin/imgprov.py).
  // Nothing goes to the image model before "Create theme" is pressed with the box ticked. The tick is not remembered between openings; the picked model is.
  property bool sprites: false
  property var imgRows: []
  property string imgProv: "comfyui"
  property var imgChoice: ({ comfy: { url: "", checkpoint: "" }, endpoint: { url: "", model: "", key_env: "", key_file: "" }, custom: "" })
  property var imgCheckpoints: []
  property string imgMsg: ""
  property bool imgBad: false
  // the chat: the first answer makes the theme (chatActive), nothing is in the list until it is saved
  property bool settingsOpen: true
  readonly property var partKeys: [
    { key: "screen", label: "Screen", hint: "e.g. warm dusk haze, red at the horizon" },
    { key: "color", label: "Color", hint: "e.g. deep red grade, crushed blacks" },
    { key: "wallpaper", label: "Wallpaper overlay", hint: "e.g. light speed streaks on the road" },
    { key: "cursor", label: "Cursor", hint: "e.g. a small red comet tail" },
    { key: "window", label: "Window shader", hint: "e.g. in the car's red" },
    { key: "frame", label: "Window frame", hint: "e.g. thin red border, soft glow" }
  ]
  readonly property bool anyPartFocus: { for (var i = 0; i < partFields.count; i++) { var f = partFields.itemAt(i); if (f && f.activeFocus) return true } return false }
  readonly property var cardRows: {
    if (!card) return []
    var names = { wallpaper: "Wallpaper overlay", screen: "Screen", color: "Color", cursor: "Cursor", window: "Windows", frame: "Frame" }
    var rows = []
    var fell = {}
    for (var i = 0; i < card.fell.length; i++) fell[card.fell[i].slot] = card.fell[i].used
    for (var k in names) {
      var b = card.concept.briefs[k]
      if (!b) continue
      var sc = card.scores[k] !== undefined ? "  " + card.scores[k] + "/10" : ""
      rows.push(names[k] + sc + (fell[k] !== undefined ? "  (shipped " + (fell[k] || "none") + " instead)" : "") + ": " + b)
    }
    return rows
  }
  readonly property bool aiOk: core ? core.aiAvailable : false
  readonly property string title: mode === "ai" ? "Create your own theme (AI)" : (mode === "share" ? "Share" : (mode === "save" ? "Save as a theme" : "Import a theme"))

  // share: the theme line being shared (a saved theme, or the look on now) and which of its parts go into the code
  property string srcLine: ""
  property var shareParts: ({ screen: true, color: true, wallpaper: true, cursor: true, windows: true })
  readonly property var srcItem: srcLine !== "" && core ? core.themeItem(srcLine) : null
  readonly property var partList: [
    { key: "screen", label: "Screen", has: srcItem ? srcItem.screen !== "" : false, what: srcItem ? core.prettyId(srcItem.screen) : "" },
    { key: "color", label: "Color", has: srcItem ? srcItem.color !== "" : false, what: srcItem ? core.prettyId(srcItem.color) : "" },
    { key: "wallpaper", label: "Wallpaper", has: srcItem ? srcItem.wall !== "" : false, what: srcItem ? core.wallLabel(srcItem.wall) : "" },
    { key: "cursor", label: "Cursor", has: srcItem ? srcItem.mouse !== "" : false, what: srcItem ? core.prettyId(srcItem.mouse) : "" },
    { key: "windows", label: "Windows", has: srcItem ? srcItem.hasWin : false, what: srcItem ? [srcItem.winFx, srcItem.winCol, srcItem.winFrame].filter(function(x) { return x !== "" }).map(core.prettyId).join(" + ") : "" }
  ]
  readonly property var pickedParts: partList.filter(function(x) { return x.has && shareParts[x.key] === true }).map(function(x) { return x.key })
  function togglePart(i) {
    var x = partList[i]
    if (!x || !x.has) return
    var m = {}
    for (var k in shareParts) m[k] = shareParts[k]
    m[x.key] = !m[x.key]
    shareParts = m
    done = false; shareCode = ""; shareWh = ""; notes = []; status = ""
  }

  QtObject {
    id: jobs
    // the share and import steps only: a theme job is never stopped from here
    readonly property bool any: shareProc.running || gifProc.running || importProc.running || retryProc.running
  }
  function say(t, bad) { status = t; statusBad = !!bad }
  function cancel() { shareProc.running = false; gifProc.running = false; importProc.running = false; retryProc.running = false }

  onOpenChanged: {
    if (!open) {
      if (mode === "ai") { leaveLook(); if (formMode) saveForm() }
      return
    }
    status = ""; statusBad = false; done = false; notes = []; shareCode = ""; codeWh = ""; codeWhCached = false; shareWh = ""; wallId = ""; wallFailed = false; wallError = ""; checkedName = ""; clipSrc = false; probing = false; undoToken = ""; prevLook = ""
    useCurrent = false; subtle = false; applyIt = true
    settingsOpen = true; actMsg = ""; actBad = false; confirmCancel = false; fresh = false
    testMsg = ""; est = null
    if (mode === "ai") {
      jobId = core.dlgJob !== "" && core.jobById(core.dlgJob) ? core.dlgJob : bestJob()
      if (jobId === "") restoreForm(core.jobsForm)
      else { settingsOpen = false; showDraft() }
      sprites = false; imgMsg = ""; imgCheckpoints = []
      core.refreshAi(); loadProviders(); loadImg(); focusTimer.restart()
    }
    else if (mode === "share") {
      var n = number
      var nowName = ""
      if (!(n > 0 && n <= core.themes.length)) {
        for (var ti = 0; ti < core.themes.length && nowName === ""; ti++) if (core.themeMatchesNow(core.themes[ti])) nowName = core.themeItem(core.themes[ti]).name
      }
      srcLine = n > 0 && n <= core.themes.length ? core.themes[n - 1] : core.themeCompose(core.current, core.wallShown, core.mouseCurrent, core.colorCurrent, nowName, core.winEffect, core.winColor, core.winFrame, core.currentOpts())
      shareParts = { screen: true, color: true, wallpaper: true, cursor: true, windows: true }
    }
    else if (mode === "save") {
      saveField.text = core.themeItem(core.themeNow).label
      focusTimer.restart()
    }
    else { codeField.text = ""; pasteProc.running = true }
  }

  // ------------------------------------------------------------ the job this dialog shows
  // which job a reopened dialog attaches to: a running one first, then a finished draft, then one that stopped
  function bestJob() {
    var l = core ? core.jobs : [], best = null, rank = -1
    for (var i = 0; i < l.length; i++) {
      var r = l[i].alive ? 3 : (l[i].has_result ? 2 : 1)
      if (r > rank || (r === rank && (l[i].updated || 0) > (best.updated || 0))) { best = l[i]; rank = r }
    }
    return best ? best.id : ""
  }
  function maybeAttach() {
    if (!open || mode !== "ai") return
    if (jobId !== "" && job === null) {
      // the job is gone (saved, discarded or dismissed somewhere else)
      jobId = ""; fresh = true; settingsOpen = true; actMsg = ""; restoreForm(core.jobsForm)
      return
    }
    if (jobId === "" && !fresh && !starting && promptField.text === "") { var b = bestJob(); if (b !== "") jobId = b }
  }
  Connections { target: td.core; function onJobsChanged() { td.maybeAttach() } }
  onResultKeyChanged: {
    if (resultKey === "") return
    settingsOpen = false
    actMsg = ""
    if (open && mode === "ai") showDraft()
  }
  onJobSigChanged: if (!(job && job.alive)) confirmCancel = false

  // the draft is previewed live while the dialog is open; hiding the dialog puts the look back (the draft itself stays)
  function showDraft() {
    if (!chatActive) return
    var L = core.jobLook[jobId] || ({ prev: core.lookLine(), applied: false, key: "" })
    if (L.applied && L.key === resultKey) return
    if (!L.applied) L.prev = core.lookLine()
    L.applied = true
    L.key = resultKey
    var m = {}; for (var k in core.jobLook) m[k] = core.jobLook[k]
    m[jobId] = L
    core.jobLook = m
    if (job.form && job.form.wh && job.result.turn === 1) core.wallhavenUsed(job.form.wh)
    var line = chatLine
    core.reloadList(function() { core.applyThemeLine(line) })
  }
  function forgetLook(id) { var m = {}; for (var k in core.jobLook) if (k !== id) m[k] = core.jobLook[k]; core.jobLook = m }
  function leaveLook() {
    var L = core.jobLook[jobId]
    if (L && L.applied) { core.afterList = null; core.restoreLook(L.prev); L.applied = false; L.key = "" }
  }

  // the typed words and settings are remembered (bin/aijobs.py form) and come back when the dialog opens again
  function formState() {
    var parts = {}
    for (var i = 0; i < partKeys.length; i++) { var f = partFields.itemAt(i); if (f && f.text.trim() !== "") parts[partKeys[i].key] = f.text.trim() }
    return { text: promptField.text, genre: genreField.text, rounds: richRounds, useCurrent: useCurrent, subtle: subtle, parts: parts, wh: whId, sprites: sprites }
  }
  function saveForm() {
    var f = formState()
    core.jobsForm = f
    Quickshell.execDetached(["python3", core.path("bin/ai-theme"), "job", "form", "set", JSON.stringify(f)])
  }
  function restoreForm(f) {
    f = f || ({})
    promptField.text = whId !== "" ? "" : String(f.text || "")
    genreField.text = String(f.genre || "")
    if (f.rounds !== undefined) richRounds = Math.max(0, Math.min(3, Number(f.rounds) || 0))
    useCurrent = f.useCurrent === true; subtle = f.subtle === true; sprites = f.sprites === true
    var p = f.parts || ({})
    for (var i = 0; i < partKeys.length; i++) { var fld = partFields.itemAt(i); if (fld) fld.text = String(p[partKeys[i].key] || "") }
    refreshEstimate()
  }

  // one job command at a time (start, change, retry, cancel, save, discard, dismiss); the callback gets the parsed answer
  property var actQueue: []
  function runJob(args, cb) { actQueue.push({ a: args, cb: cb }); pumpAct() }
  function pumpAct() {
    if (actProc.running || actQueue.length === 0) return
    var j = actQueue.shift()
    actProc.cur = j
    actProc.command = ["python3", core.path("bin/ai-theme"), "job"].concat(j.a).concat(["--json"])
    actProc.running = true
  }
  Process {
    id: actProc
    property var cur: ({})
    environment: td.core ? td.core.aiEnv() : ({})
    stdout: StdioCollector { id: actOut; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(actOut.text).trim().split("\n").pop()) } catch (e) { d = null }
      var j = cur
      if (j.cb) j.cb(d || { ok: false, error: "The theme command gave no answer." })
      td.core.refreshJobs()
      td.pumpAct()
    }
  }
  // the panel hands the focus to its key catcher right after opening, so the text box takes it back a moment later
  Timer { id: focusTimer; interval: 300; onTriggered: { if (td.mode === "ai") promptField.forceActiveFocus(); else if (td.mode === "import") codeField.forceActiveFocus(); else if (td.mode === "save") { saveField.forceActiveFocus(); saveField.selectAll() } } }

  // ------------------------------------------------------------ AI provider
  function loadProviders() { if (!provProc.running) provProc.running = true }
  Process {
    id: provProc
    command: ["python3", td.core ? td.core.path("bin/ai-theme") : "ai-theme", "providers", "--json"]
    environment: td.core ? td.core.aiEnv() : ({})
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim())
          td.provRows = d.providers
          td.provId = d.choice.provider
          td.provModel = d.choice.model
          if (d.choice.custom && !customField.activeFocus) customField.text = d.choice.custom
          td.provEndpoint = d.choice.endpoint || ({ url: "", key_env: "", key_file: "" })
          if (!modelField.activeFocus) modelField.text = td.provModel
          if (!epUrlField.activeFocus) epUrlField.text = td.provEndpoint.url
          if (!epKeyEnvField.activeFocus) epKeyEnvField.text = td.provEndpoint.key_env
          if (!epKeyFileField.activeFocus) epKeyFileField.text = td.provEndpoint.key_file
          var row = td.rowOf(td.provId)
          td.provStrong = !row || row.strong !== false
          td.inventReady = d.invent_ready !== false
          td.inventHint = String(d.invent_hint || "")
          var m = d.choice.mode ? d.choice.mode : ((row && row.strong === true) ? "invent" : "pick")
          td.provImage = !row || row.image !== false
          td.invent = td.inventReady && (m === "invent" || m === "rich")
          td.rich = td.invent && m === "rich"
          td.refreshEstimate()
        } catch (e) { td.say("Could not read the list of AI tools.", true) }
      }
    }
  }
  function rowOf(id) { for (var i = 0; i < provRows.length; i++) if (provRows[i].id === id) return provRows[i]; return null }
  readonly property var provOptions: provRows.map(function(r) { return { value: r.id, label: r.label } })
  readonly property var modelOptions: { var r = rowOf(provId); return r ? r.models.map(function(m) { return { value: m.id, label: m.label } }) : [] }

  property var useQueue: []
  function runUse(args, thenTest) { useQueue.push({ a: args, t: !!thenTest }); pumpUse() }
  function pumpUse() {
    if (useProc.running || useQueue.length === 0) return
    var j = useQueue.shift()
    useProc.cur = j
    useProc.command = ["python3", core.path("bin/ai-theme"), "use"].concat(j.a).concat(["--json"])
    useProc.running = true
  }
  Process {
    id: useProc
    property var cur: ({ t: false })
    stdout: StdioCollector { waitForEnd: true }
    onExited: {
      if (td.useQueue.length > 0) { td.pumpUse(); return }
      td.core.refreshAi()
      td.loadProviders()
      if (cur.t) td.startTest()
    }
  }
  function pickProvider(id) {
    testMsg = ""
    var r = rowOf(id)
    var a = [id]
    if (id === "custom" && customField.text.trim() !== "") { a.push("--custom"); a.push(customField.text.trim()) }
    if (r && r.default_model !== undefined && r.default_model !== "") { a.push("--model"); a.push(r.default_model) }
    provId = id
    runUse(a)
  }
  function pickModel(m) { testMsg = ""; provModel = m; runUse(["--model", m]) }
  function saveEndpoint() { runUse(["endpoint", "--url", epUrlField.text.trim(), "--key-env", epKeyEnvField.text.trim(), "--key-file", epKeyFileField.text.trim()]) }
  function setCaps(seeing, strong) { testMsg = ""; runUse(["--can-see", seeing ? "1" : "0", "--strong", strong ? "1" : "0"]) }
  function saveCustom() { if (customField.text.trim() !== "") runUse(["custom", "--custom", customField.text.trim()]) }
  function setMode(m) {
    if (m !== "pick" && !inventReady) { say(inventHint, true); return }
    invent = m !== "pick"; rich = m === "rich"; runUse(["--mode", m]); refreshEstimate()
  }
  function nextMode() { setMode(!invent ? "invent" : (!rich ? "rich" : "pick")) }

  function startTest() {
    if (testProc.running) return
    testMsg = "Testing the connection…"; testBad = false
    testProc.running = true
  }
  function testConnection() {
    if (provId === "custom" && customField.text.trim() !== "") runUse(["custom", "--custom", customField.text.trim()], true)
    else startTest()
  }
  Process {
    id: testProc
    command: ["python3", td.core ? td.core.path("bin/ai-theme") : "ai-theme", "test", "--json"]
    environment: td.core ? td.core.aiEnv() : ({})
    stdout: StdioCollector { id: testOut; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(testOut.text).trim().split("\n").pop()) } catch (e) { d = null }
      td.testBad = !(d && d.ok)
      td.testMsg = d ? (d.ok ? "Connection works (" + d.seconds + " s)." : "Test failed: " + (d.error || "no answer")) : "Test failed: no answer."
    }
  }

  // ------------------------------------------------------------ image model (for the painted sprites)
  function loadImg() { if (!imgProc.running) imgProc.running = true }
  Process {
    id: imgProc
    command: ["python3", td.core ? td.core.path("bin/ai-theme") : "ai-theme", "img", "providers", "--json"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim().split("\n").pop())
          td.imgRows = d.providers
          td.imgChoice = d.choice
          td.imgProv = d.choice.provider
          if (!imgUrlField.activeFocus) imgUrlField.text = d.choice.comfy.url
          if (!imgEpUrlField.activeFocus) imgEpUrlField.text = d.choice.endpoint.url
          if (!imgEpModelField.activeFocus) imgEpModelField.text = d.choice.endpoint.model
          if (!imgEpKeyEnvField.activeFocus) imgEpKeyEnvField.text = d.choice.endpoint.key_env
          if (!imgEpKeyFileField.activeFocus) imgEpKeyFileField.text = d.choice.endpoint.key_file
          if (!imgCmdField.activeFocus) imgCmdField.text = d.choice.custom
        } catch (e) { td.imgMsg = "Could not read the image model settings."; td.imgBad = true }
      }
    }
  }
  readonly property var imgOptions: imgRows.map(function(r) { return { value: r.id, label: r.label } })
  readonly property var ckptOptions: {
    var o = imgCheckpoints.map(function(n) { return { value: n, label: n } })
    var cur = imgChoice && imgChoice.comfy ? imgChoice.comfy.checkpoint : ""
    if (cur !== "" && imgCheckpoints.indexOf(cur) < 0) o.unshift({ value: cur, label: cur })
    return o
  }
  property var imgQueue: []
  function runImgUse(args, thenTest) { imgQueue.push({ a: args, t: !!thenTest }); pumpImg() }
  function pumpImg() {
    if (imgUseProc.running || imgQueue.length === 0) return
    var j = imgQueue.shift()
    imgUseProc.cur = j
    imgUseProc.command = ["python3", core.path("bin/ai-theme"), "img", "use"].concat(j.a).concat(["--json"])
    imgUseProc.running = true
  }
  Process {
    id: imgUseProc
    property var cur: ({ t: false })
    stdout: StdioCollector { waitForEnd: true }
    onExited: {
      if (td.imgQueue.length > 0) { td.pumpImg(); return }
      td.loadImg()
      if (cur.t) td.startImgTest()
    }
  }
  function pickImgProvider(id) { imgMsg = ""; imgProv = id; runImgUse([id]) }
  function imgFieldArgs() {
    return ["--url", imgUrlField.text.trim(), "--endpoint-url", imgEpUrlField.text.trim(), "--model", imgEpModelField.text.trim(),
            "--key-env", imgEpKeyEnvField.text.trim(), "--key-file", imgEpKeyFileField.text.trim(), "--command", imgCmdField.text.trim()]
  }
  function saveImg() { runImgUse(imgFieldArgs()) }
  function pickCheckpoint(n) { imgMsg = ""; runImgUse(["--checkpoint", n]) }
  function setSprites(on) {
    sprites = on
    if (on) { loadImg(); if (imgProv === "comfyui" && imgCheckpoints.length === 0) listCheckpoints() }
    refreshEstimate()
  }
  function listCheckpoints() { if (!ckptProc.running) ckptProc.running = true }
  Process {
    id: ckptProc
    command: ["python3", td.core ? td.core.path("bin/ai-theme") : "ai-theme", "img", "checkpoints", "--json"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim().split("\n").pop())
          if (d.ok) {
            td.imgCheckpoints = d.checkpoints
            var cur = td.imgChoice && td.imgChoice.comfy ? td.imgChoice.comfy.checkpoint : ""
            if (d.checkpoints.length > 0 && d.checkpoints.indexOf(cur) < 0) td.pickCheckpoint(d.checkpoints[0])
          }
        } catch (e) { }
      }
    }
  }
  function startImgTest() {
    if (imgTestProc.running) return
    imgMsg = "Testing the connection to your image model…"; imgBad = false
    imgTestProc.running = true
  }
  // saves what is typed first, then tests (so the test is of what the boxes say)
  function testImgConnection() { runImgUse(imgFieldArgs(), true) }
  Process {
    id: imgTestProc
    command: ["python3", td.core ? td.core.path("bin/ai-theme") : "ai-theme", "img", "test", "--json"]
    stdout: StdioCollector { id: imgTestOut; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(imgTestOut.text).trim().split("\n").pop()) } catch (e) { d = null }
      td.imgBad = !(d && d.ok)
      td.imgMsg = d ? (d.ok ? String(d.message || "Connection works.") : "Test failed: " + (d.error || "no answer")) : "Test failed: no answer."
      if (d && d.ok && d.checkpoints) {
        td.imgCheckpoints = d.checkpoints
        var cur = td.imgChoice && td.imgChoice.comfy ? td.imgChoice.comfy.checkpoint : ""
        if (d.checkpoints.length > 0 && d.checkpoints.indexOf(cur) < 0) td.pickCheckpoint(d.checkpoints[0])
      }
    }
  }

  // ------------------------------------------------------------ estimate
  function partArgs() {
    var a = []
    for (var i = 0; i < partKeys.length; i++) {
      var f = partFields.itemAt(i)
      var v = f ? f.text.trim() : ""
      if (v !== "") { a.push("--part"); a.push(partKeys[i].key + "=" + v) }
    }
    return a
  }
  function baseArgs() {
    var c = []
    if (whId !== "") { c.push("--wallhaven"); c.push(whId) }
    else if (useCurrent) c.push("--current")
    return c
  }
  Timer { id: estTimer; interval: 700; onTriggered: td.runEstimate() }
  function refreshEstimate() { if (mode === "ai") estTimer.restart() }
  function runEstimate() {
    if (estProc.running) { estTimer.restart(); return }
    var c = ["python3", core.path("bin/ai-theme"), "estimate", promptField.text.trim()].concat(baseArgs())
    if (invent) c = c.concat(partArgs())
    if (rich) c = c.concat(["--rich", "--rounds", String(richRounds)])
    if (invent && sprites) c.push("--sprites")
    c.push("--json")
    estProc.command = c
    estProc.running = true
  }
  Process {
    id: estProc
    environment: td.core ? td.core.aiEnv() : ({})
    stdout: StdioCollector { id: estOut; waitForEnd: true }
    onExited: function(code) {
      try { td.est = JSON.parse(String(estOut.text).trim().split("\n").pop()) } catch (e) { td.est = null }
    }
  }
  function nfmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n) }
  function money(c) { return c ? ", about $" + (c < 0.1 ? Number(c).toFixed(3) : Number(c).toFixed(2)) : "" }
  readonly property string estText: {
    if (!est) return ""
    if (rich) return "Before you start: " + est.summary + (est.note ? " (" + est.note + ")" : "") + ". " + (est.review ? "The renders of each piece are checked and weak ones are made again (up to " + richRounds + " round" + (richRounds === 1 ? "" : "s") + "). " : (richRounds > 0 && !provImage ? "This AI cannot look at pictures, so the renders are not checked. " : "")) + "Quick would use about " + nfmt(est.quick.tokens_in + est.quick.tokens_out) + " tokens. The real cost is shown when it is done."
    if (invent) return "Before you start: about " + nfmt(est.tokens_in) + " tokens in and " + nfmt(est.tokens_out) + " out" + money(est.cost_usd) + (est.note ? " (" + est.note + ")" : "")
                       + ". Each repair try adds about " + nfmt(est.repair_tokens_in + est.repair_tokens_out) + " (at most 2 per part). Pick existing would send about " + nfmt(est.pick_tokens_in) + " tokens in."
    return "Before you start: about " + nfmt(est.pick_tokens_in) + " tokens in. Only a small copy of the picture and its colours are sent."
  }

  // ------------------------------------------------------------ AI chat (background jobs)
  property bool starting: false
  // Enter / "Create theme": the first message starts a job, a later one changes the draft (a second turn of the same job)
  function sendTurn(surprise) {
    if (starting || busy || actProc.running) return
    if (job !== null && !chatActive) { retryJob(); return }
    var text = promptField.text.trim()
    if (!aiOk) { say("AI needed. " + core.aiHint, true); return }
    var first = job === null
    if (!first) {
      if (text === "") { saveChat(); return }
      starting = true
      actMsg = ""
      runJob(["change", job.id, text, "--est", ""], function(d) {
        td.starting = false
        if (!d.ok) { td.actMsg = d.error || "Could not start the change."; td.actBad = true; return }
        promptField.text = ""
        td.actBad = false
      })
      return
    }
    var parts = invent ? partArgs() : []
    var sur = rich && (surprise === true || (text === "" && whId === "" && !useCurrent))
    if (sur && surprise === true && text !== "" && genreField.text.trim() === "") genreField.text = text
    if (sur) text = ""
    if (!sur && text === "" && whId === "" && !useCurrent && parts.length === 0) { say("Describe the theme you want, for example: a rainy neon night", true); return }
    var c = ["start", text].concat(baseArgs())
    if (rich) {
      c.push("--rich"); c.push("--rounds"); c.push(String(richRounds))
      if (genreField.text.trim() !== "") { c.push("--genre"); c.push(genreField.text.trim()) }
      if (sur) c.push("--surprise")
    }
    else if (invent) c.push("--invent")
    else if (subtle) c.push("--subtle")
    if (invent && sprites) c.push("--sprites")
    c = c.concat(parts)
    var form = formState()
    form.surprise = sur
    c.push("--form"); c.push(JSON.stringify(form))
    c.push("--est"); c.push(estText.replace(/^Before you start: /, "").substring(0, 190))
    starting = true
    say(whId !== "" ? "Setting the wallpaper, then asking the AI…" : "Starting…", false)
    runJob(c, function(d) {
      td.starting = false
      if (!d.ok) { td.say(d.error || "Could not start the AI.", true); return }
      td.say("", false)
      td.core.jobs = td.core.jobs.concat([d.job])
      td.jobId = d.job.id
      td.fresh = false
      td.settingsOpen = false
      td.core.refreshJobs()
      promptField.text = ""
    })
  }
  function retryJob() {
    if (!job || busy || actProc.running) return
    actMsg = ""
    runJob(["retry", job.id], function(d) { if (!d.ok) { td.actMsg = d.error || "Could not retry."; td.actBad = true } })
  }
  // the explicit cancel: one click asks, a second one stops the job. A first turn leaves nothing behind (its words go back into the box); a change leaves the draft as it was
  function cancelJob() {
    if (!busy) return
    if (!confirmCancel) { confirmCancel = true; return }
    confirmCancel = false
    var id = job.id, hadDraft = chatActive, words = job.run && job.run.message ? job.run.message : "", form = job.form || ({})
    runJob(["cancel", id], function(d) {
      if (!d.ok) { td.actMsg = d.error || "Could not cancel."; td.actBad = true; return }
      td.actMsg = "Cancelled."; td.actBad = false
      if (!hadDraft) {
        td.runJob(["dismiss", id], function(x) {
          td.jobId = ""; td.fresh = true; td.settingsOpen = true
          td.restoreForm(form)
          td.say("Cancelled. Your words are back in the box.", false)
        })
      } else promptField.text = words
    })
  }
  function dismissJob() {
    if (!job || busy || chatActive) return
    var id = job.id, form = job.form || ({})
    runJob(["dismiss", id], function(d) {
      td.jobId = ""; td.fresh = true; td.settingsOpen = true
      td.restoreForm(form)
      td.say("", false)
    })
  }
  function newTheme() {
    if (job === null) return
    leaveLook()
    jobId = ""; fresh = true; settingsOpen = true; actMsg = ""; confirmCancel = false
    restoreForm(core.jobsForm)
    say("", false)
    focusTimer.restart()
  }
  function saveChat() {
    if (!chatActive || busy || actProc.running) return
    actMsg = "Saving…"; actBad = false
    var id = job.id
    runJob(["save", id], function(d) {
      if (!d.ok) { td.actMsg = d.error || "Could not save the theme."; td.actBad = true; return }
      td.forgetLook(id)
      td.jobId = ""; td.fresh = true; td.actMsg = ""
      td.core.reloadList(function() { td.core.flash((d.existed ? "You already had this theme (#" : "Saved as theme #") + d.number + "): " + d.name) })
      td.core.dlgOpen = false
    })
  }
  // put the previous look back and delete what the draft generated; stay = keep the panel open for a fresh start
  function discardChat(stay) {
    if (!chatActive || busy || actProc.running) return
    var id = job.id
    leaveLook()
    runJob(["discard", id], function(d) {
      if (!d.ok) { td.actMsg = d.error || "Could not discard."; td.actBad = true; return }
      td.forgetLook(id)
      td.core.reloadList()
      td.jobId = ""; td.fresh = true; td.settingsOpen = true; td.actMsg = ""
      td.restoreForm(td.core.jobsForm)
      td.say("Discarded. Your previous look is back and the effects made for this theme are deleted.", false)
    })
  }

  // ------------------------------------------------------------ share
  function startShare() {
    say("Making the code…", false)
    if (pickedParts.length === 0) { say("Pick at least one part.", true); return }
    shareProc.command = ["python3", core.path("bin/theme-code"), "share", "--line", srcLine, "--parts", pickedParts.join(","), "--copy", "--json"]
    shareProc.running = true
  }
  Process {
    id: shareProc
    stdout: StdioCollector { id: shareOut; waitForEnd: true }
    stderr: StdioCollector { id: shareErr; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(shareOut.text).trim()) } catch (e) { d = null }
      if (!d || !d.ok) { td.say((d && d.error) || String(shareErr.text).trim().split("\n").pop() || "Could not make a code.", true); return }
      td.shareCode = d.code
      td.shareWh = d.wh || ""
      td.checkedName = d.name
      td.notes = d.notes || []
      td.done = true
      td.say(d.copied ? "Copied to the clipboard. Paste it to a friend (the code holds no file paths or names)." : "Select the code below to copy it (wl-copy was not found).", false)
    }
  }
  // Record sharable GIF: the code (raw bytes) goes into the borders of a recording of the shared look; this window closes first so it is not in the shot
  readonly property string gifPayload: (Quickshell.env("XDG_RUNTIME_DIR") || "/tmp") + "/omashaders-share-gif.bin"
  function shareLook() {
    var it = srcItem
    if (!it) return ""
    var on = function(k) { return pickedParts.indexOf(k) >= 0 }
    return core.themeCompose(on("screen") ? it.screen : "", on("wallpaper") ? it.wall : "", on("cursor") ? it.mouse : "", on("color") ? it.color : "", "",
                             on("windows") ? it.winFx : "", on("windows") ? it.winCol : "", on("windows") ? it.winFrame : "", "")
  }
  function startShareGif() {
    if (pickedParts.length === 0) { say("Pick at least one part.", true); return }
    say("Making the code for the picture…", false)
    gifProc.command = ["python3", core.path("bin/theme-code"), "share", "--line", srcLine, "--parts", pickedParts.join(","), "--format", "bytes", "--out", gifPayload, "--json"]
    gifProc.running = true
  }
  Process {
    id: gifProc
    stdout: StdioCollector { id: gifOut; waitForEnd: true }
    stderr: StdioCollector { id: gifErr; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(gifOut.text).trim()) } catch (e) { d = null }
      if (!d || !d.ok) { td.say((d && d.error) || String(gifErr.text).trim().split("\n").pop() || "Could not make the code.", true); return }
      if (d.tooBigForPicture) { td.say("Too big for a picture (" + d.bytes + " bytes of code). Use Create code and send the text instead.", true); return }
      td.core.recordShareGif(td.shareLook(), td.gifPayload, td.srcItem ? td.srcItem.name : "")
    }
  }
  function saveNamed() {
    var nm = String(saveField.text).trim()
    core.notify("OmaShaders", "Saved theme: " + (nm !== "" ? nm : core.themeItem(core.themeNow).label))
    core.saveTheme(nm)
    core.dlgOpen = false
  }
  function copyAgain() { if (shareCode !== "") { Quickshell.execDetached(["wl-copy", shareCode]); say("Copied again.", false) } }

  // ------------------------------------------------------------ import
  Process {
    id: pasteProc
    command: ["wl-paste", "-n"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var t = String(text).trim()
        if ((t.indexOf("OMS1:") === 0 || t.indexOf("OMS2:") === 0) && t.length < 16000) codeField.text = t
        else td.checkClipboard(true)
        focusTimer.restart()
      }
    }
  }
  Timer { id: checkDelay; interval: 400; onTriggered: td.checkCode() }
  // what to read the theme from: a picture file path typed in the box, the clipboard picture, or the pasted code
  function srcArgs() {
    var raw = String(codeField.text).trim()
    if (raw !== "" && (raw.charAt(0) === "/" || raw.charAt(0) === "~" || raw.indexOf("file://") === 0)) return ["--image", raw]
    if (clipSrc) return ["--clipboard"]
    return [raw.replace(/\s+/g, "")]
  }
  function checkClipboard(quiet) {
    if (checkProc.running || importProc.running) return
    clipSrc = true
    probing = !!quiet
    checkProc.command = ["python3", core.path("bin/theme-code"), "check", "--clipboard", "--json"]
    say(quiet ? "" : "Reading the picture on the clipboard…", false)
    checkProc.running = true
  }
  function checkCode() {
    var c = codeField.text.replace(/\s+/g, "")
    if (c === "" && clipSrc) return
    if (c === "") { say("", false); codeWh = ""; codeWhCached = false; checkedName = ""; notes = []; return }
    var sa = srcArgs()
    checkProc.command = ["python3", core.path("bin/theme-code"), "check"].concat(sa).concat(["--json"])
    say(sa[0] === "--image" ? "Reading the picture…" : "", false)
    checkProc.running = true
  }
  Process {
    id: checkProc
    stdout: StdioCollector { id: checkOut; waitForEnd: true }
    stderr: StdioCollector { waitForEnd: true }
    onExited: function(code) {
      if (td.done) return
      var d = null
      try { d = JSON.parse(String(checkOut.text).trim()) } catch (e) { d = null }
      var quiet = td.probing
      td.probing = false
      if (!d) { if (quiet) { td.clipSrc = false; return } td.say("Could not check the code.", true); return }
      if (!d.ok && quiet) { td.clipSrc = false; return }
      if (!d.ok) { td.checkedName = ""; td.codeWh = ""; td.codeWhCached = false; td.notes = []; td.say(d.error, true); return }
      td.checkedName = d.name
      td.codeWh = d.wh || ""
      td.codeWhCached = d.wh_cached === true
      td.wallFailed = false
      td.notes = d.skipped || []
      var nc = (d.customs || []).length
      td.say("Safety check passed. A theme called “" + d.name + "”" + (td.clipSrc ? ", read from the picture on the clipboard" : "") + ". " + (nc > 0 ? "It brings " + nc + " custom effect" + (nc === 1 ? "" : "s") + " (" + d.customs.map(function(x) { return x.name }).join(", ") + "); each goes through the safety check when you import, and you can try the theme before you keep it. " : "") + (td.notes.length > 0 ? "Some parts cannot be used here (below)." : "Every part is available."), false)
    }
  }
  // withWall: also set the code's Wallhaven picture (downloading it first when it is not on this computer)
  function startImport(withWall) {
    if (importProc.running || retryProc.running) return
    var c = codeField.text.replace(/\s+/g, "")
    if (c === "" && !clipSrc) { say("Paste a code first, or press “Use the picture on the clipboard”.", true); return }
    if (checkDelay.running || checkProc.running || checkedName === "") {
      if (checkDelay.running || checkProc.running) say("Checking the code first. Press Enter again in a moment.", false)
      return
    }
    var cmd = ["python3", core.path("bin/theme-code"), "import"].concat(srcArgs()).concat(["--json"])
    prevLook = core.lookLine()
    var wall = withWall && codeWh !== ""
    if (wall) cmd.push("--wallpaper")
    wallId = wall ? codeWh : ""
    wallFailed = false
    importProc.command = cmd
    say(wall && !codeWhCached ? "Downloading the wallpaper from wallhaven.cc, then saving the theme…" : "Importing…", false)
    keys.forceActiveFocus()
    importProc.running = true
  }
  Process {
    id: importProc
    stdout: StdioCollector { id: impOut; waitForEnd: true }
    stderr: StdioCollector { id: impErr; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(impOut.text).trim()) } catch (e) { d = null }
      if (!d) { td.say(String(impErr.text).trim().split("\n").pop() || "Import failed.", true); return }
      if (!d.ok) { td.say(d.error || "Import failed.", true); return }
      td.notes = d.skipped || []
      td.done = true
      var preview = (d.customs || []).length > 0 && d.undo
      var newFx = (d.customs || []).length > 0
      if (preview) td.undoToken = d.undo
      if (preview || td.applyIt) {
        if (newFx) td.core.reloadList(function() { td.core.applyThemeLine(d.line) })
        else td.core.applyThemeLine(d.line)
      } else if (newFx) td.core.reloadList()
      var msg = "Safety check passed. " + (d.existed ? "You already had this theme (#" + d.number + ")." : "Saved as theme #" + d.number + ".") + (preview ? " Trying it now: " : (td.applyIt ? " Applied: " : " ")) + d.name + (preview ? ". Press Keep to keep it, or Undo to remove it and its new effects." : "")
      if (d.wallpaper === true) { td.core.wallhavenUsed(td.wallId); msg += ". Wallpaper set: Wallhaven " + td.wallId + "." }
      else if (d.wallpaper === false) {
        td.wallFailed = true
        td.wallError = d.wallpaper_error || "no answer"
        td.say(msg + ". The wallpaper was not downloaded (" + td.wallError + "). The theme works without it. Press Retry when Wallhaven is reachable.", true)
        return
      }
      td.say(msg, false)
    }
  }
  function keepImport() {
    if (undoToken === "") return
    Quickshell.execDetached(["python3", core.path("bin/theme-code"), "keep", "--token", undoToken])
    undoToken = ""
    close()
  }
  function undoImport() {
    if (undoToken === "" || undoProc.running) return
    undoProc.command = ["python3", core.path("bin/theme-code"), "undo", "--token", undoToken, "--json"]
    undoProc.running = true
  }
  Process {
    id: undoProc
    stdout: StdioCollector { id: undoOut; waitForEnd: true }
    onExited: function(code) {
      var d = null
      try { d = JSON.parse(String(undoOut.text).trim()) } catch (e) { d = null }
      if (!d || !d.ok) { td.say((d && d.error) || "Could not undo the import.", true); return }
      td.undoToken = ""
      var pl = td.prevLook
      if (pl !== "") td.core.reloadList(function() { td.core.restoreLook(pl) })
      else td.core.reloadList()
      td.close()
      td.core.flash("Import undone: the theme and its new effects are removed.")
    }
  }
  function retryWallpaper() {
    if (retryProc.running || wallId === "") return
    say("Downloading the wallpaper from wallhaven.cc…", false)
    retryProc.command = ["python3", core.path("bin/wallhaven"), "use", wallId]
    retryProc.running = true
  }
  Process {
    id: retryProc
    stdout: StdioCollector { waitForEnd: true }
    stderr: StdioCollector { id: retryErr; waitForEnd: true }
    onExited: function(code) {
      if (code === 0) {
        td.wallFailed = false
        td.core.wallhavenUsed(td.wallId)
        td.say("Wallpaper set: Wallhaven " + td.wallId + ". The theme is applied with it.", false)
      } else {
        td.wallError = String(retryErr.text).trim().split("\n").pop().replace(/^wallhaven: /, "").replace(/ \(curl.*$/, "") || "no answer"
        td.say("The wallpaper was still not downloaded (" + td.wallError + "). The theme is saved. Try Retry again later.", true)
      }
    }
  }

  component Btn: Rectangle {
    id: b
    property string label: ""
    property bool toggle: false
    property bool checked: false
    property bool dim: false
    signal clicked()
    height: Style.space(28)
    width: txt.implicitWidth + Style.space(24)
    radius: Style.space(6)
    color: toggle ? td.fgA(checked ? (ma.containsMouse ? 0.24 : 0.17) : (ma.containsMouse ? 0.1 : 0.03)) : td.fgA(ma.containsMouse && !dim ? 0.32 : 0.22)
    border.width: toggle ? 1 : 0
    border.color: td.fgA(checked ? 0.5 : 0.22)
    opacity: dim ? 0.45 : 1
    Text {
      id: txt
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: b.label
      color: td.fg
      font.family: td.font
      font.pixelSize: Style.font.body
      font.bold: !b.toggle
    }
    MouseArea {
      id: ma
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: b.dim ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: if (!b.dim) b.clicked()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: td.core
    bar: td.core ? td.core.bar : null
    owner: td
    open: td.open
    focusTarget: keys
    contentWidth: panel.fittedContentWidth(Style.space(760))
    contentHeight: panel.fittedContentHeight(td.mode === "ai" ? (td.job !== null ? (td.chatActive ? (td.card ? Style.space(td.settingsOpen ? 980 : 860) : (td.settingsOpen ? Style.space(780) : Style.space(600))) : Style.space(td.settingsOpen ? 700 : 440)) : (td.rich ? Style.space(780 + td.spritesExtra) : td.invent ? Style.space(700 + td.spritesExtra) : Style.space(520 + td.spritesExtra))) : (td.mode === "save" ? Style.space(170) : Style.space(td.mode === "share" ? 400 : 380)))

    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      blocked: saveField.activeFocus || promptField.activeFocus || genreField.activeFocus || codeField.activeFocus || customField.activeFocus || td.anyPartFocus || provDrop.popupOpen || modelDrop.popupOpen || imgUrlField.activeFocus || imgEpUrlField.activeFocus || imgEpModelField.activeFocus || imgEpKeyEnvField.activeFocus || imgEpKeyFileField.activeFocus || imgCmdField.activeFocus || imgProvDrop.popupOpen || imgCkptDrop.popupOpen
      onMoveRequested: function(dx, dy) {}
      onActivateRequested: {
        if (td.mode === "ai") { if (td.chatActive) td.saveChat(); else if (td.formMode) td.sendTurn(false); else if (!td.busy) td.retryJob() }
        else if (td.mode === "import") { if (td.undoToken !== "") td.keepImport(); else if (td.done && !td.wallFailed) td.close(); else if (td.done) td.retryWallpaper(); else td.startImport(true) }
        else if (td.mode === "save") td.saveNamed()
        else if (td.done) td.copyAgain()
        else td.startShare()
      }
      onDeleteRequested: {}
      onCloseRequested: td.close()
      onTextKey: function(t) {
        if (t === "q") td.close()
        else if (t === "/" || t === "e" || t === "i") { if (td.mode === "ai") promptField.forceActiveFocus(); else if (td.mode === "import") codeField.forceActiveFocus() }
        else if (t === "b" && td.mode === "ai" && td.whId === "" && td.formMode) td.useCurrent = !td.useCurrent
        else if (t === "s" && td.mode === "ai" && td.chatActive) td.saveChat()
        else if (t === "s" && td.mode === "ai" && td.formMode && !td.invent) td.subtle = !td.subtle
        else if (t === "m" && td.mode === "ai" && td.formMode) td.nextMode()
        else if (t === "r" && td.mode === "ai" && td.chatActive && td.sheetUrl !== "") td.showSheet = !td.showSheet
        else if (t === "u" && td.mode === "ai" && td.formMode && td.rich) td.sendTurn(true)
        else if (t === "t" && td.mode === "ai") td.testConnection()
        else if (t === "o" && td.mode === "ai" && td.job !== null) td.settingsOpen = !td.settingsOpen
        else if (t === "d" && td.mode === "ai" && td.chatActive && !td.busy) td.discardChat(true)
        else if (t === "n" && td.mode === "ai" && td.job !== null) td.newTheme()
        else if (t === "a" && td.mode === "import") td.applyIt = !td.applyIt
        else if (t === "t" && td.mode === "import" && td.codeWh !== "" && !td.done) td.startImport(false)
        else if (t === "r" && td.mode === "import" && td.wallFailed) td.retryWallpaper()
        else if (t === "v" && td.mode === "import" && !td.done) td.checkClipboard(false)
        else if (t === "u" && td.mode === "import" && td.undoToken !== "") td.undoImport()
        else if (t === "c" && td.mode === "share" && td.done) td.copyAgain()
        else if (t === "g" && td.mode === "share") td.startShareGif()
        else if (td.mode === "share" && t >= "1" && t <= "5") td.togglePart(Number(t) - 1)
        else if (t === "n" && td.mode === "save") saveField.forceActiveFocus()
      }

      Column {
        id: col
        anchors.fill: parent
        spacing: Style.space(10)

        Text {
          width: col.width
          textFormat: Text.PlainText
          text: td.title
          color: td.fg
          font.family: td.font
          font.pixelSize: Style.font.body * 1.35
          font.bold: true
        }

        // ---------------- AI
        Column {
          visible: td.mode === "ai"
          width: col.width
          spacing: Style.space(8)
          Text {
            visible: !td.aiOk
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: "AI needed. " + (td.core ? td.core.aiHint : "")
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            font.bold: true
          }
          // settings: shown before the first message, and again with "o" (they stay out of the way while chatting)
          Column {
          visible: td.formMode || td.settingsOpen
          width: col.width
          spacing: Style.space(8)
          // which AI tool answers (only the ones installed on this computer are listed)
          Row {
            spacing: Style.space(8)
            Column {
              spacing: Style.space(2)
              Text { textFormat: Text.PlainText; text: "AI tool"; opacity: 0.7; color: td.fg; font.family: td.font; font.pixelSize: Style.font.caption }
              Dropdown {
                id: provDrop
                showLabel: false
                width: Style.space(250)
                foreground: td.fg
                fontFamily: td.font
                options: td.provOptions
                value: td.provId
                onChanged: function(v) { td.pickProvider(v) }
              }
            }
            Column {
              visible: td.modelOptions.length > 1
              spacing: Style.space(2)
              Text { textFormat: Text.PlainText; text: "Model"; opacity: 0.7; color: td.fg; font.family: td.font; font.pixelSize: Style.font.caption }
              Dropdown {
                id: modelDrop
                showLabel: false
                width: Style.space(250)
                foreground: td.fg
                fontFamily: td.font
                options: td.modelOptions
                value: td.provModel
                onChanged: function(v) { td.pickModel(v) }
              }
            }
            Column {
              spacing: Style.space(2)
              Text { textFormat: Text.PlainText; text: " "; font.pixelSize: Style.font.caption }
              Btn { label: "Test connection  (t)"; onClicked: td.testConnection() }
            }
          }
          TextField {
            id: modelField
            visible: td.provId !== "custom"
            width: col.width
            height: Style.space(32)
            verticalPadding: Style.space(3)
            placeholderText: td.provId === "endpoint" ? "Model name the server expects, e.g. anthropic/claude-3.5-sonnet or llama3.1" : "Model (optional): empty = this tool's own default model"
            foreground: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            maximumLength: 80
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { keys.forceActiveFocus(); event.accepted = true }
            }
            onEditingFinished: if (text.trim() !== td.provModel) td.pickModel(text.trim())
          }
          Column {
            visible: td.provId === "endpoint"
            width: col.width
            spacing: Style.space(6)
            TextField {
              id: epUrlField
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "Server address, e.g. https://openrouter.ai/api/v1 or http://localhost:1234/v1 (LM Studio)"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 200
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveEndpoint()
            }
            Row {
              spacing: Style.space(8)
              TextField {
                id: epKeyEnvField
                width: (col.width - Style.space(8)) / 2
                height: Style.space(32)
                verticalPadding: Style.space(3)
                placeholderText: "Key from this environment variable (name only)"
                foreground: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body
                maximumLength: 60
                Keys.onPressed: function(event) {
                  if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                  else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { keys.forceActiveFocus(); event.accepted = true }
                }
                onEditingFinished: td.saveEndpoint()
              }
              TextField {
                id: epKeyFileField
                width: (col.width - Style.space(8)) / 2
                height: Style.space(32)
                verticalPadding: Style.space(3)
                placeholderText: "or from a private file (chmod 600), e.g. ~/.config/my-ai-key"
                foreground: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body
                maximumLength: 200
                Keys.onPressed: function(event) {
                  if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                  else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { keys.forceActiveFocus(); event.accepted = true }
                }
                onEditingFinished: td.saveEndpoint()
              }
            }
          }
          Row {
            visible: td.provId === "custom" || td.provId === "endpoint"
            spacing: Style.space(8)
            Btn { toggle: true; checked: td.provImage; label: (td.provImage ? "󰄲 " : "󰄱 ") + "This AI can look at pictures"; onClicked: td.setCaps(!td.provImage, td.provStrong) }
            Btn { toggle: true; checked: td.provStrong; label: (td.provStrong ? "󰄲 " : "󰄱 ") + "Strong enough to invent effects"; onClicked: td.setCaps(td.provImage, !td.provStrong) }
          }
          TextField {
            id: customField
            visible: td.provId === "custom"
            width: col.width
            height: Style.space(32)
            verticalPadding: Style.space(3)
            placeholderText: "Custom command: reads the prompt on stdin and prints text with one JSON object, e.g. my-ai --quiet"
            foreground: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            maximumLength: 300
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveCustom(); keys.forceActiveFocus(); event.accepted = true }
            }
            onEditingFinished: td.saveCustom()
          }
          Text {
            visible: td.testMsg !== ""
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: td.testMsg
            color: td.testBad ? "#ff8a80" : td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.95
          }
          Row {
            visible: td.formMode
            spacing: Style.space(8)
            Btn { toggle: true; checked: !td.invent; label: (!td.invent ? "󰄲 " : "󰄱 ") + "Pick existing effects"; onClicked: td.setMode("pick") }
            Btn { toggle: true; checked: td.invent && !td.rich; label: (td.invent && !td.rich ? "󰄲 " : "󰄱 ") + "Invent: Quick  (m)"; onClicked: td.setMode("invent") }
            Btn { toggle: true; checked: td.rich; label: (td.rich ? "󰄲 " : "󰄱 ") + "Invent: Rich"; onClicked: td.setMode("rich") }
          }
          Row {
            visible: td.rich && td.formMode
            spacing: Style.space(8)
            TextField {
              id: genreField
              width: col.width - Style.space(240)
              height: Style.space(30)
              verticalPadding: Style.space(3)
              placeholderText: "Genre or feel (optional): cozy, cyberpunk, forest, retro…"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body * 0.9
              maximumLength: 80
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.sendTurn(false); event.accepted = true }
              }
            }
            Btn {
              label: "Review rounds: " + td.richRounds
              onClicked: { td.richRounds = (td.richRounds + 1) % 4; td.refreshEstimate() }
            }
          }
          // Painted sprites: off by default; the image model is the user's own (ComfyUI, an OpenAI-compatible images endpoint or a command)
          Column {
            visible: td.formMode
            width: col.width
            spacing: Style.space(6)
            Btn { toggle: true; checked: td.sprites; label: (td.sprites ? "󰄲 " : "󰄱 ") + "Painted sprites (uses your image model)"; onClicked: td.setSprites(!td.sprites) }
            Text {
              visible: !td.sprites || !td.invent
              width: col.width
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
              text: td.sprites && !td.invent
                    ? "Pick existing effects makes no new effect, so nothing would be painted. Choose Invent to use this."
                    : "Optional. A new wallpaper effect gets eight small pictures painted by an image model on your computer or account. Off by default."
              opacity: 0.8
              color: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body * 0.9
            }
            Column {
              visible: td.sprites
              width: col.width
              spacing: Style.space(6)
              Row {
                spacing: Style.space(8)
                Column {
                  spacing: Style.space(2)
                  Text { textFormat: Text.PlainText; text: "Image model"; opacity: 0.7; color: td.fg; font.family: td.font; font.pixelSize: Style.font.caption }
                  Dropdown {
                    id: imgProvDrop
                    showLabel: false
                    width: Style.space(250)
                    foreground: td.fg
                    fontFamily: td.font
                    options: td.imgOptions
                    value: td.imgProv
                    onChanged: function(v) { td.pickImgProvider(v) }
                  }
                }
                Column {
                  visible: td.imgProv === "comfyui"
                  spacing: Style.space(2)
                  Text { textFormat: Text.PlainText; text: "Checkpoint (from your ComfyUI)"; opacity: 0.7; color: td.fg; font.family: td.font; font.pixelSize: Style.font.caption }
                  Dropdown {
                    id: imgCkptDrop
                    showLabel: false
                    width: Style.space(300)
                    foreground: td.fg
                    fontFamily: td.font
                    options: td.ckptOptions
                    value: td.imgChoice && td.imgChoice.comfy ? td.imgChoice.comfy.checkpoint : ""
                    onChanged: function(v) { td.pickCheckpoint(v) }
                  }
                }
                Column {
                  spacing: Style.space(2)
                  Text { textFormat: Text.PlainText; text: " "; font.pixelSize: Style.font.caption }
                  Btn { label: "Test connection"; onClicked: td.testImgConnection() }
                }
              }
            TextField {
              id: imgUrlField
              visible: td.imgProv === "comfyui"
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "ComfyUI address, e.g. http://127.0.0.1:8188"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 200
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveImg(); keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveImg()
            }
            TextField {
              id: imgEpUrlField
              visible: td.imgProv === "endpoint"
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "Images server address, e.g. https://api.openai.com/v1 or http://localhost:8080/v1"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 200
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveImg(); keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveImg()
            }
            TextField {
              id: imgEpModelField
              visible: td.imgProv === "endpoint"
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "Model name the server expects, e.g. gpt-image-1 or dall-e-3"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 80
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveImg(); keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveImg()
            }
            TextField {
              id: imgEpKeyEnvField
              visible: td.imgProv === "endpoint"
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "Key from this environment variable (name only)"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 60
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveImg(); keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveImg()
            }
            TextField {
              id: imgEpKeyFileField
              visible: td.imgProv === "endpoint"
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "or from a private file (chmod 600), e.g. ~/.config/my-image-key"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 200
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveImg(); keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveImg()
            }
            TextField {
              id: imgCmdField
              visible: td.imgProv === "custom"
              width: col.width
              height: Style.space(32)
              verticalPadding: Style.space(3)
              placeholderText: "Custom command that writes the picture to {out}, e.g. my-image-tool --prompt {prompt} --out {out}"
              foreground: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              maximumLength: 300
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveImg(); keys.forceActiveFocus(); event.accepted = true }
              }
              onEditingFinished: td.saveImg()
            }
              Text {
                visible: td.imgMsg !== ""
                width: col.width
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
                text: td.imgMsg
                color: td.imgBad ? "#ff8a80" : td.fg
                font.family: td.font
                font.pixelSize: Style.font.body * 0.95
              }
              Text {
                width: col.width
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
                text: "When you press Create, eight short sprite descriptions (for example “a glowing paper lantern”) go to this image model, one picture each. Only those descriptions are sent: your wallpaper and the words you typed are not. If the image model does not answer, the theme is still made, without sprites."
                opacity: 0.8
                color: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body * 0.9
              }
            }
          }
          Text {
            visible: !td.inventReady && td.formMode
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: td.inventHint
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.9
            font.bold: true
          }
          Text {
            visible: td.invent && !td.provStrong && td.formMode
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: "Inventing needs a strong model. A small local model often writes shaders that fail the safety check; “Pick existing effects” is the safer choice with it."
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.9
            font.bold: true
          }
          Text {
            visible: td.formMode
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: td.whId !== ""
                  ? "Base picture: Wallhaven " + td.whId + ". It is set as your wallpaper first, then the AI builds a complete theme around it. The picture itself never changes. Add a wish if you like, or leave it empty."
                  : (td.rich
                     ? "Rich: first the AI plans a place (a biome, a time of day, a mood, a palette from your picture and one playful detail) and writes a brief for each part. Then each part is built on its own, every piece passes the same safety check with bigger limits, and the renders of the pieces over your picture are reviewed and weak ones sent back. Takes a few minutes and costs more than Quick. Leave the words empty, or press Surprise me, to let it choose. Your wallpaper stays the main picture."
                     : td.invent
                     ? "Say what you want. The AI writes new effects for Screen, Color, a light Wallpaper overlay, Cursor, Window shader and Frame, using the exact colours of your picture, and may reuse an installed effect where it already fits. Every new shader passes a safety check (fixed template, no includes, bounded loops, compile, test render) before it is used. Your wallpaper stays the main picture."
                     : "Say what you want in a few words. The AI builds a complete theme from the effects installed (Screen, Color, one light Wallpaper overlay, Cursor, Windows, Frame), clearly visible, on your current wallpaper (it never replaces the picture). Then keep talking to change it. Tick Subtle for a quieter one.")
            opacity: 0.8
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.95
          }
          }
          // Rich: the plan's concept, what each part scored, and the contact sheet of the renders
          Rectangle {
            id: cardBox
            visible: td.chatActive && td.card !== null
            width: col.width
            height: visible ? cardCol.implicitHeight + Style.space(16) : 0
            radius: Style.space(8)
            color: td.fgA(0.07)
            Column {
              id: cardCol
              x: Style.space(8)
              y: Style.space(8)
              width: parent.width - Style.space(16)
              spacing: Style.space(5)
              Text {
                width: parent.width
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
                text: td.card ? td.card.concept.title + "  ·  " + td.card.concept.biome + ", " + td.card.concept.time_of_day : ""
                color: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body * 1.1
                font.bold: true
              }
              Text {
                width: parent.width
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
                text: td.card ? td.card.concept.story : ""
                color: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body * 0.95
              }
              Flow {
                width: parent.width
                spacing: Style.space(10)
                Repeater {
                  model: td.card ? td.card.concept.palette : []
                  delegate: Row {
                    required property var modelData
                    spacing: Style.space(4)
                    Rectangle { width: Style.space(18); height: Style.space(18); radius: Style.space(4); color: "#" + modelData.hex; border.width: 1; border.color: td.fgA(0.4) }
                    Text { text: modelData.role; opacity: 0.75; color: td.fg; font.family: td.font; font.pixelSize: Style.font.body * 0.82; anchors.verticalCenter: parent.verticalCenter }
                  }
                }
              }
              Repeater {
                model: td.cardRows
                delegate: Text {
                  required property var modelData
                  width: cardCol.width
                  elide: Text.ElideRight
                  maximumLineCount: 1
                  textFormat: Text.PlainText
                  text: modelData
                  opacity: 0.85
                  color: td.fg
                  font.family: td.font
                  font.pixelSize: Style.font.body * 0.85
                }
              }
              Text {
                visible: td.card && td.card.review !== ""
                width: parent.width
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
                text: td.card ? "Review: " + td.card.review : ""
                opacity: 0.7
                color: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body * 0.82
              }
              Flickable {
                visible: td.showSheet && td.sheetUrl !== ""
                width: parent.width
                height: visible ? Style.space(td.settingsOpen ? 170 : 250) : 0
                contentWidth: width
                contentHeight: sheetImg.height
                clip: true
                boundsBehavior: Flickable.StopAtBounds
                Image {
                  id: sheetImg
                  width: parent.width
                  fillMode: Image.PreserveAspectFit
                  asynchronous: true
                  cache: false
                  source: td.sheetUrl
                }
              }
            }
          }
          // the chat: what you said, what the AI did, and what changed
          Flickable {
            id: histView
            visible: td.job !== null
            width: col.width
            height: td.job === null ? 0 : (td.chatActive ? Style.space(td.card ? (td.settingsOpen ? 80 : 110) : (td.settingsOpen ? 140 : 270)) : Style.space(td.settingsOpen ? 140 : 190))
            contentWidth: width
            contentHeight: histCol.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            onContentHeightChanged: contentY = Math.max(0, contentHeight - height)
            Column {
              id: histCol
              width: histView.width
              spacing: Style.space(8)
              Repeater {
                model: td.history
                delegate: Rectangle {
                  required property var modelData
                  readonly property bool mine: modelData.role === "user"
                  width: histCol.width * 0.92
                  x: mine ? histCol.width - width : 0
                  height: bub.implicitHeight + Style.space(14)
                  radius: Style.space(8)
                  color: td.fgA(mine ? 0.16 : 0.07)
                  Column {
                    id: bub
                    x: Style.space(8)
                    y: Style.space(7)
                    width: parent.width - Style.space(16)
                    spacing: Style.space(4)
                    Text {
                      width: parent.width
                      wrapMode: Text.WordWrap
                      textFormat: Text.PlainText
                      text: modelData.text
                      color: td.fg
                      font.family: td.font
                      font.pixelSize: Style.font.body
                    }
                    Text {
                      visible: (modelData.changes || []).length > 0
                      width: parent.width
                      wrapMode: Text.WordWrap
                      textFormat: Text.PlainText
                      text: "Changed:\n• " + (modelData.changes || []).join("\n• ")
                      opacity: 0.75
                      color: td.fg
                      font.family: td.font
                      font.pixelSize: Style.font.body * 0.88
                    }
                  }
                }
              }
            }
          }
          TextField {
            id: promptField
            visible: td.formMode || (td.chatActive && !td.busy)
            width: col.width
            height: visible ? Style.space(32) : 0
            verticalPadding: Style.space(3)
            placeholderText: td.chatActive ? "Change something: less fog, make the windows red like the car, swap the cursor…  (⏎ on an empty line saves)" : td.rich ? "What do you imagine? Or leave empty to be surprised: a night market in monsoon rain, a glass greenhouse at dawn…" : td.invent ? "e.g. a great day, a fast ride, like the car in the picture" : "e.g. a rainy neon night, a warm cabin with snow outside, calm and readable"
            foreground: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            maximumLength: 300
            onTextChanged: td.refreshEstimate()
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.sendTurn(); event.accepted = true }
            }
          }
          // optional orders per part (Invent only)
          Grid {
            visible: td.invent && td.formMode
            width: col.width
            columns: 2
            columnSpacing: Style.space(8)
            rowSpacing: Style.space(4)
            Repeater {
              id: partFields
              model: td.partKeys
              delegate: TextField {
                required property var modelData
                width: (col.width - Style.space(8)) / 2
                height: Style.space(30)
                verticalPadding: Style.space(3)
                placeholderText: modelData.label + " (optional): " + modelData.hint
                foreground: td.fg
                font.family: td.font
                font.pixelSize: Style.font.body * 0.9
                maximumLength: 200
                onTextChanged: td.refreshEstimate()
                Keys.onPressed: function(event) {
                  if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
                  else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.sendTurn(); event.accepted = true }
                }
              }
            }
          }
          Row {
            visible: td.formMode
            spacing: Style.space(8)
            Btn {
              visible: td.whId === ""
              toggle: true
              checked: td.useCurrent
              label: (td.useCurrent ? "󰄲 " : "󰄱 ") + "Use my current wallpaper as the base (b)"
              onClicked: { td.useCurrent = !td.useCurrent; td.refreshEstimate() }
            }
            Btn {
              visible: !td.invent
              toggle: true
              checked: td.subtle
              label: (td.subtle ? "󰄲 " : "󰄱 ") + "Subtle: a quiet recolour, few effects (s)"
              onClicked: td.subtle = !td.subtle
            }
          }
          Text {
            visible: td.formMode
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: td.estText
            opacity: 0.6
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.85
          }
        }

        // ---------------- share
        Column {
          visible: td.mode === "share"
          width: col.width
          spacing: Style.space(8)
          Text {
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: td.srcItem ? (td.number > 0 ? "Theme: " + td.srcItem.label : "The look on your screen now") : ""
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            font.bold: true
          }
          Text {
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: "Everything is in the code unless you switch a part off (keys 1-5). Parts that are off in this theme cannot be picked."
            opacity: 0.8
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.95
          }
          Flow {
            width: col.width
            spacing: Style.space(8)
            Repeater {
              model: td.partList
              Btn {
                required property var modelData
                required property int index
                toggle: true
                dim: !modelData.has
                checked: modelData.has && td.shareParts[modelData.key] === true
                label: (checked ? "󰄲 " : "󰄱 ") + modelData.label + " (" + (index + 1) + ")" + (modelData.has ? ": " + modelData.what : ": off")
                onClicked: td.togglePart(index)
              }
            }
          }
          Text {
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            visible: td.done
            text: td.pickedParts.indexOf("wallpaper") < 0 ? "" : (td.shareWh !== "" ? "Includes Wallhaven wallpaper " + td.shareWh + " (wallhaven.cc/w/" + td.shareWh + "). Whoever imports the code is offered the download. The code holds only the id, never the picture."
                                    : "Your wallpaper is not from Wallhaven, so the code carries the theme only. A local file or an AI picture is never put in a code.")
            color: td.fg
            opacity: 0.9
            font.family: td.font
            font.pixelSize: Style.font.body * 0.95
          }
          Rectangle {
            visible: td.done
            width: col.width
            height: Style.space(120)
            radius: Style.space(6)
            color: td.fgA(0.08)
            border.width: 1
            border.color: td.fgA(0.25)
            TextEdit {
              anchors.fill: parent
              anchors.margins: Style.space(8)
              readOnly: true
              selectByMouse: true
              wrapMode: TextEdit.WrapAnywhere
              text: td.shareCode
              color: td.fg
              selectionColor: td.fgA(0.35)
              selectedTextColor: td.fg
              font.family: "monospace"
              font.pixelSize: Style.font.body * 0.9
            }
          }
        }

        // ---------------- save
        Column {
          visible: td.mode === "save"
          width: col.width
          spacing: Style.space(8)
          Text {
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: "Name this theme. It keeps your Screen, Color, Wallpaper and Cursor as they are right now."
            opacity: 0.85
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
          }
          TextField {
            id: saveField
            width: col.width
            height: Style.space(32)
            verticalPadding: Style.space(3)
            placeholderText: "Theme name"
            foreground: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            maximumLength: 40
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { td.close(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { td.saveNamed(); event.accepted = true }
            }
          }
        }

        // ---------------- import
        Column {
          visible: td.mode === "import"
          width: col.width
          spacing: Style.space(8)
          Text {
            width: col.width
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: "Paste a code (OMS1: or OMS2:), type the path of a saved share picture, or copy a share picture from a post and press the clipboard button (the clipboard was checked for you). Safety check: every code is scanned for anything harmful before it is used. It is only read as data, never run: every field must be an installed effect name, a colour or a number, otherwise the import is refused."
            opacity: 0.8
            color: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body * 0.95
          }
          TextField {
            id: codeField
            width: col.width
            height: Style.space(32)
            verticalPadding: Style.space(3)
            placeholderText: "OMS1:… / OMS2:… / path of a picture"
            foreground: td.fg
            font.family: td.font
            font.pixelSize: Style.font.body
            maximumLength: 16000
            onTextChanged: { td.done = false; if (text !== "") td.clipSrc = false; checkDelay.restart() }
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { keys.forceActiveFocus(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { if (td.done && td.wallFailed) td.retryWallpaper(); else td.startImport(true); event.accepted = true }
            }
          }
          Row {
            spacing: Style.space(8)
            Btn { toggle: true; checked: td.applyIt; label: (td.applyIt ? "󰄲 " : "󰄱 ") + "Apply it now (a)"; onClicked: td.applyIt = !td.applyIt }
          }
          Column {
            visible: td.codeWh !== "" && td.checkedName !== "" && !td.done
            width: col.width
            spacing: Style.space(2)
            Text {
              width: col.width
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
              text: "This theme comes with a Wallhaven wallpaper (wallhaven.cc/w/" + td.codeWh + ")"
              color: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body
              font.bold: true
            }
            Text {
              width: col.width
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
              text: td.codeWhCached ? "Wallpaper is already on this computer. It is set together with the theme."
                                    : "The wallpaper needs to be downloaded first, from wallhaven.cc. Nothing is downloaded until you press the button. It is then set together with the theme."
              opacity: 0.85
              color: td.fg
              font.family: td.font
              font.pixelSize: Style.font.body * 0.95
            }
          }
        }

        // ---------------- status + notes
        Text {
          width: col.width
          wrapMode: Text.WordWrap
          textFormat: Text.PlainText
          visible: td.mode === "ai" && td.jobStatus !== ""
          text: td.jobStatus
          color: td.job && !td.busy && !td.chatActive ? "#ff8a80" : td.fg
          font.family: td.font
          font.pixelSize: Style.font.body
        }
        Text {
          width: col.width
          wrapMode: Text.WordWrap
          textFormat: Text.PlainText
          visible: td.mode === "ai" && (td.confirmCancel || td.actMsg !== "")
          text: td.confirmCancel ? "Stop this job for good? The AI run is killed and what it has made so far is thrown away." + (td.chatActive ? " Your draft stays as it was." : "") : td.actMsg
          color: td.actBad || td.confirmCancel ? "#ff8a80" : td.fg
          font.family: td.font
          font.pixelSize: Style.font.body
          font.bold: td.confirmCancel
        }
        Text {
          width: col.width
          wrapMode: Text.WordWrap
          textFormat: Text.PlainText
          visible: text !== ""
          text: td.status
          color: td.statusBad ? "#ff8a80" : td.fg
          font.family: td.font
          font.pixelSize: Style.font.body
        }
        Text {
          width: col.width
          wrapMode: Text.WordWrap
          textFormat: Text.PlainText
          visible: td.shownNotes.length > 0
          text: "Left out:\n• " + td.shownNotes.join("\n• ")
          opacity: 0.8
          color: td.fg
          font.family: td.font
          font.pixelSize: Style.font.body * 0.9
        }

        // ---------------- buttons
        Row {
          spacing: Style.space(8)
          Btn {
            visible: td.mode === "ai" && (td.formMode || td.chatActive)
            dim: !td.aiOk || td.busy || td.starting || actProc.running
            label: td.starting ? "Starting…" : (td.chatActive ? "Send  (⏎)" : (td.rich ? "Make Rich theme  (⏎)" : td.invent ? "Invent theme  (⏎)" : "Create theme  (⏎)"))
            onClicked: td.sendTurn()
          }
          Btn {
            visible: td.mode === "ai" && td.rich && td.formMode
            dim: !td.aiOk || td.starting || actProc.running
            label: "Surprise me  (u)"
            onClicked: td.sendTurn(true)
          }
          Btn {
            visible: td.mode === "ai" && td.job !== null && !td.busy && !td.chatActive
            dim: !td.aiOk || actProc.running
            label: "Retry  (⏎)"
            onClicked: td.retryJob()
          }
          Btn {
            visible: td.mode === "ai" && td.job !== null && !td.busy && !td.chatActive
            dim: actProc.running
            label: "Dismiss"
            onClicked: td.dismissJob()
          }
          Btn {
            visible: td.mode === "ai" && td.busy
            label: td.confirmCancel ? "Yes, cancel the job" : "Cancel job"
            onClicked: td.cancelJob()
          }
          Btn {
            visible: td.mode === "ai" && td.busy && td.confirmCancel
            label: "No, keep working"
            onClicked: td.confirmCancel = false
          }
          Btn {
            visible: td.mode === "ai" && td.chatActive && td.sheetUrl !== ""
            toggle: true
            checked: td.showSheet
            label: "Renders  (r)"
            onClicked: td.showSheet = !td.showSheet
          }
          Btn {
            visible: td.mode === "ai" && td.chatActive
            dim: td.busy || actProc.running
            label: "Save as theme  (s)"
            onClicked: td.saveChat()
          }
          Btn {
            visible: td.mode === "ai" && td.chatActive
            dim: td.busy || actProc.running
            label: "Discard  (d)"
            onClicked: td.discardChat(true)
          }
          Btn {
            visible: td.mode === "ai" && td.job !== null
            label: "New theme  (n)"
            onClicked: td.newTheme()
          }
          Btn {
            visible: td.mode === "ai" && td.job !== null
            toggle: true
            checked: td.settingsOpen
            label: "Settings  (o)"
            onClicked: td.settingsOpen = !td.settingsOpen
          }
          Btn {
            visible: td.mode === "import" && !td.done
            dim: checkProc.running || importProc.running
            label: "Use the picture on the clipboard  (v)"
            onClicked: td.checkClipboard(false)
          }
          Btn {
            visible: td.mode === "import" && td.undoToken !== ""
            dim: undoProc.running
            label: "Undo  (u)"
            onClicked: td.undoImport()
          }
          Btn {
            visible: td.mode === "import" && td.undoToken !== ""
            label: "Keep  (⏎)"
            onClicked: td.keepImport()
          }
          Btn {
            visible: td.mode === "import" && !td.done
            dim: importProc.running || td.checkedName === ""
            label: importProc.running ? (td.wallId !== "" && !td.codeWhCached ? "Downloading…" : "Importing…")
                   : (td.codeWh !== "" ? (td.codeWhCached ? (td.applyIt ? "Apply theme and wallpaper  (⏎)" : "Save theme and wallpaper  (⏎)")
                                                          : (td.applyIt ? "Download wallpaper and apply theme  (⏎)" : "Download wallpaper and save theme  (⏎)"))
                                       : "Import  (⏎)")
            onClicked: td.startImport(true)
          }
          Btn {
            visible: td.mode === "import" && td.codeWh !== "" && !td.done
            dim: importProc.running || td.checkedName === ""
            label: (td.applyIt ? "Apply theme only" : "Save theme only") + "  (t)"
            onClicked: td.startImport(false)
          }
          Btn {
            visible: td.mode === "import" && td.done && td.wallFailed
            dim: retryProc.running
            label: retryProc.running ? "Downloading…" : "Retry wallpaper  (⏎)"
            onClicked: td.retryWallpaper()
          }
          Btn { visible: td.mode === "share" && !td.done; dim: shareProc.running || td.pickedParts.length === 0; label: shareProc.running ? "Making the code…" : "Create code  (⏎)"; onClicked: td.startShare() }
          Btn { visible: td.mode === "share" && td.done; label: "Copy again  (c)"; onClicked: td.copyAgain() }
          Btn { visible: td.mode === "share"; dim: gifProc.running || td.pickedParts.length === 0; label: gifProc.running ? "Making the code…" : "Record sharable GIF  (g)"; onClicked: td.startShareGif() }
          Btn { visible: td.mode === "save"; label: "Save  (⏎)"; onClicked: td.saveNamed() }
          Btn { label: jobs.any || td.mode === "save" ? "Cancel  (esc)" : (td.mode === "ai" && td.busy ? "Hide, keep working  (esc)" : (td.mode === "ai" && td.chatActive ? "Close, keep the draft  (esc)" : "Close  (esc)")); onClicked: td.close() }
        }
      }
    }
  }
}
