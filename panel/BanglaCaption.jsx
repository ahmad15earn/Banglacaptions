// BanglaCaption.jsx - Bangla Caption v0.3.0, dockable ScriptUI panel for After Effects
// License: MIT. Local speech recognition (Whisper / BanglaSpeech2Text), no cloud.
// Keep this file ASCII-only (ExtendScript reads source as ANSI unless it has a BOM).
// Bengali text only ever arrives from JSON files as \uXXXX escapes.

// ---SEG-BEGIN---
var BC_PHRASE_GAP = 0.5;   // pause (seconds) that starts a new phrase
var BC_MERGE_GAP = 0.8;    // a lone word is merged into the next phrase if the pause is shorter

function bcTrim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

function bcIsHardEnd(t) {  // danda, ?, !, ., ellipsis
    return /[\u0964?!.\u2026]["'\u201d\u2019)]*$/.test(t);
}
function bcIsSoftEnd(t) {  // comma, semicolon, colon
    return /[,;:\u060c]["'\u201d\u2019)]*$/.test(t);
}

// Stage 1: words -> phrases (punctuation + speech pauses)
function bcSplitPhrases(words, gapSec) {
    var phrases = [], cur = [], i, brk;
    for (i = 0; i < words.length; i++) {
        cur.push(words[i]);
        brk = bcIsHardEnd(words[i].t) || bcIsSoftEnd(words[i].t);
        if (!brk && i < words.length - 1 && (words[i + 1].s - words[i].e) >= gapSec) brk = true;
        if (brk) { phrases.push(cur); cur = []; }
    }
    if (cur.length) phrases.push(cur);
    return phrases;
}

// Do not leave a lone word on its own when it can join the next phrase
function bcMergeTiny(phrases, maxWords) {
    var out = [], i, p, nx;
    for (i = 0; i < phrases.length; i++) {
        p = phrases[i];
        if (p.length === 1 && !bcIsHardEnd(p[0].t) && i < phrases.length - 1) {
            nx = phrases[i + 1];
            if ((nx[0].s - p[0].e) < BC_MERGE_GAP && nx.length + 1 <= maxWords) {
                phrases[i + 1] = p.concat(nx);
                continue;
            }
        }
        out.push(p);
    }
    return out;
}

// Stage 2: split a phrase into balanced blocks of <= maxWords (never splits a word)
function bcChunk(phrase, maxWords) {
    var L = phrase.length, k, base, extra, out = [], idx = 0, j, n;
    if (L <= maxWords) return [phrase];
    k = Math.ceil(L / maxWords);
    base = Math.floor(L / k);
    extra = L % k;
    for (j = 0; j < k; j++) {
        n = base + (j < extra ? 1 : 0);
        out.push(phrase.slice(idx, idx + n));
        idx += n;
    }
    return out;
}

function bcBuildBlocks(words, maxWords, gapSec) {
    var phrases, blocks = [], i, j, k, ch, txt, b;
    if (!(maxWords >= 1)) maxWords = 1;
    maxWords = Math.floor(maxWords);
    phrases = bcMergeTiny(bcSplitPhrases(words, gapSec), maxWords);
    for (i = 0; i < phrases.length; i++) {
        var chunks = bcChunk(phrases[i], maxWords);
        for (j = 0; j < chunks.length; j++) {
            ch = chunks[j];
            txt = [];
            for (k = 0; k < ch.length; k++) txt.push(ch[k].t);
            blocks.push({ text: txt.join(" "), s: ch[0].s, e: ch[ch.length - 1].e });
        }
    }
    for (i = 0; i < blocks.length; i++) {
        b = blocks[i];
        if (b.e < b.s + 0.4) b.e = b.s + 0.4;                      // minimum on-screen time
        if (i < blocks.length - 1 && b.e > blocks[i + 1].s)        // no overlap with next caption
            b.e = Math.max(blocks[i + 1].s, b.s + 0.05);
    }
    return blocks;
}
// ---SEG-END---

function bcParseJSON(txt) { return eval("(" + txt + ")"); }

function bcReadFile(f) {
    var s = "";
    try { f.encoding = "UTF-8"; if (f.open("r")) { s = f.read(); f.close(); } } catch (e) { }
    return s;
}

function bcWriteFile(f, text, enc) {
    try {
        f.encoding = enc || "UTF-8";
        if (!f.open("w")) return false;
        f.write(text);
        f.close();
        return true;
    } catch (e) { return false; }
}

function bcJsonStr(s) {  // ASCII-only JSON string literal
    var out = "\"", i, c, h;
    s = String(s);
    for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        if (c === 34) out += "\\\"";
        else if (c === 92) out += "\\\\";
        else if (c < 32 || c > 126) { h = c.toString(16); while (h.length < 4) h = "0" + h; out += "\\u" + h; }
        else out += s.charAt(i);
    }
    return out + "\"";
}

var BC_VERSION = "0.3.0";
function bcAssetFile(name) { return new File(bcDataDir().fsName + "/assets/" + name); }
function bcEnvReady() {
    return new File(bcDataDir().fsName + "/venv/Scripts/python.exe").exists &&
           new File(bcDataDir().fsName + "/worker/bangla_caption_worker.py").exists;
}
function bcGetSetting(k, def) {
    try { if (app.settings.haveSetting("BanglaCaption", k)) return app.settings.getSetting("BanglaCaption", k); } catch (e) { }
    return def;
}
function bcSetSetting(k, v) { try { app.settings.saveSetting("BanglaCaption", k, String(v)); } catch (e) { } }

function bcDataDir() { return new Folder(Folder.userData.fsName + "/BanglaCaption"); }
function bcJobDir() { var f = new Folder(Folder.temp.fsName + "/BanglaCaption"); if (!f.exists) f.create(); return f; }

// ---- global state + poller (scheduleTask runs code in the global scope) ----
$.global.BC = $.global.BC || {};
var BC = $.global.BC;
BC.rawWords = null;
BC.blocks = null;
BC.srcPath = "";
BC.srcOffset = 0;
BC.srcStretch = 100;
BC.taskId = null;
BC.ui = null;

$.global.BC_poll = function () {
    var B = $.global.BC;
    if (!B || !B.ui || !B.progressPath) return;
    var pf = new File(B.progressPath), p, txt;
    if (!pf.exists) return;
    txt = bcReadFile(pf);
    if (!txt) return;
    try { p = bcParseJSON(txt); } catch (e) { return; }
    if (p.pid) B.pid = p.pid;
    var el = B.t0 ? Math.round((new Date().getTime() - B.t0) / 1000) : 0;
    B.ui.bar.value = p.pct;
    B.ui.status.text = p.msg + (p.done ? "" : "  [" + el + " s]");
    if (p.done) {
        B.ui.btnCancel.enabled = false;
        if (B.taskId !== null) { try { app.cancelTask(B.taskId); } catch (e2) { } B.taskId = null; }
        B.ui.btnGen.enabled = true;
        B.progressPath = null;
        if (p.error) {
            alert(p.msg + "\n\nDetails: " + Folder.temp.fsName + "\\BanglaCaption\\log.txt");
        } else {
            var rf = new File(B.resultPath), res;
            try { res = bcParseJSON(bcReadFile(rf)); } catch (e3) { alert("Could not read result file."); return; }
            B.rawWords = res.words;
            B.timing = res.timing;
            B.ui.regroup();
        }
    }
};

// ----------------------------------------------------------------------------
(function (thisObj) {

    function buildUI(thisObj) {
        var w = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Bangla Caption", undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.margins = 8;
        w.spacing = 6;
        var ui = {};

        // ---- header: icon, title, status, help ----
        var hd = w.add("group"); hd.orientation = "row"; hd.alignChildren = ["left", "center"]; hd.spacing = 8;
        var icf = bcAssetFile("icon_32.png");
        if (icf.exists) { try { hd.add("image", undefined, icf); } catch (eI) { } }
        var tg = hd.add("group"); tg.orientation = "column"; tg.alignChildren = ["left", "top"]; tg.spacing = 0;
        var t1 = tg.add("statictext", undefined, "Bangla Caption");
        try { t1.graphics.font = ScriptUI.newFont("dialog", "BOLD", 14); } catch (eF) { }
        tg.add("statictext", undefined, "v" + BC_VERSION + "  free, offline Bengali captions");
        var sp = hd.add("group"); sp.alignment = ["fill", "center"];
        ui.btnHelp = hd.add("button", undefined, "?"); ui.btnHelp.preferredSize = [26, 26];
        ui.btnHelp.helpTip = "Setup checklist and troubleshooting";
        ui.env = w.add("statictext", undefined, "", { truncate: "end" });
        function setEnv() {
            var ok = bcEnvReady();
            ui.env.text = ok ? "Engine ready (offline)." : "Engine not installed. Run INSTALL.bat from the plugin folder.";
            try {
                var g = ui.env.graphics;
                g.foregroundColor = g.newPen(g.PenType.SOLID_COLOR, ok ? [0.35, 0.75, 0.45] : [0.95, 0.4, 0.35], 1);
            } catch (eC) { }
        }
        setEnv();

        // 1. Audio
        var pAudio = w.add("panel", undefined, "1. Audio source");
        pAudio.alignChildren = ["fill", "top"]; pAudio.margins = [8, 14, 8, 8]; pAudio.spacing = 4;
        ui.src = pAudio.add("statictext", undefined, "No audio selected", { truncate: "middle" });
        var rA = pAudio.add("group"); rA.alignChildren = ["left", "center"]; rA.spacing = 4;
        ui.btnSel = rA.add("button", undefined, "Selected layer");
        ui.btnBrowse = rA.add("button", undefined, "Browse file...");
        ui.btnSel.helpTip = "Use the audio of the footage layer selected in the active composition (keeps timing in sync).";
        ui.btnBrowse.helpTip = "Pick any audio/video file. Captions then start at the time offset below.";

        // 2. Transcript
        var pRec = w.add("panel", undefined, "2. Transcript");
        pRec.alignChildren = ["fill", "top"]; pRec.margins = [8, 14, 8, 8]; pRec.spacing = 4;
        var rE = pRec.add("group"); rE.alignChildren = ["left", "center"]; rE.spacing = 4;
        rE.add("statictext", undefined, "Engine");
        ui.engine = rE.add("dropdownlist", undefined, ["BanglaSpeech2Text (Bangla-tuned)", "Whisper (exact word timing)"]);
        ui.engine.helpTip = "BanglaSpeech2Text: better Bengali, word times estimated. Whisper: real word timestamps, weaker Bengali.";
        var rM = pRec.add("group"); rM.alignChildren = ["left", "center"]; rM.spacing = 4;
        rM.add("statictext", undefined, "Model");
        ui.model = rM.add("dropdownlist", undefined, []);
        ui.model.helpTip = "Bigger = more accurate but slower. 'small' is a good start.";
        rM.add("statictext", undefined, "Output");
        ui.script = rM.add("dropdownlist", undefined, ["Bangla", "Banglish"]);
        ui.script.helpTip = "Bangla script or romanized Banglish.";
        ui.btnGen = pRec.add("button", undefined, "Generate Transcript");
        ui.bar = pRec.add("progressbar", undefined, 0, 100);
        ui.bar.preferredSize = [10, 8];
        ui.status = pRec.add("statictext", undefined, "Ready.", { truncate: "end" });
        var rC = pRec.add("group"); rC.alignChildren = ["left", "center"]; rC.spacing = 4;
        ui.btnCheck = rC.add("button", undefined, "Check progress");
        ui.btnCancel = rC.add("button", undefined, "Cancel");
        ui.btnCancel.enabled = false;

        function fillModels() {
            var isWhisper = ui.engine.selection && ui.engine.selection.index === 1;
            var items = isWhisper ? ["tiny", "base", "small", "medium", "large"] : ["tiny", "base", "small", "large"];
            ui.model.removeAll();
            for (var i = 0; i < items.length; i++) ui.model.add("item", items[i]);
            ui.model.selection = 2;
        }
        ui.engine.onChange = fillModels;

        // 3. Caption blocks
        var pGrp = w.add("panel", undefined, "3. Caption blocks");
        pGrp.alignChildren = ["fill", "top"]; pGrp.alignment = ["fill", "fill"]; pGrp.margins = [8, 14, 8, 8]; pGrp.spacing = 4;
        var rG = pGrp.add("group"); rG.alignChildren = ["left", "center"]; rG.spacing = 4;
        rG.add("statictext", undefined, "Max words");
        ui.maxWords = rG.add("edittext", undefined, "5"); ui.maxWords.characters = 3;
        ui.slider = rG.add("slider", undefined, 5, 1, 12); ui.slider.preferredSize = [90, 16];
        ui.btnRegroup = rG.add("button", undefined, "Regroup");
        ui.maxWords.helpTip = "Maximum words per caption. Changing it never re-runs speech recognition.";
        ui.btnRegroup.helpTip = "Rebuild caption blocks from the transcript (discards manual edits).";
        ui.editor = pGrp.add("edittext", undefined, "", { multiline: true, scrolling: true });
        ui.editor.preferredSize = [260, 130];
        ui.editor.alignment = ["fill", "fill"];
        ui.info = pGrp.add("statictext", undefined, "One line = one caption. Edit text freely; keep the line count.", { truncate: "end" });

        // 4. Text and layers
        var pSty = w.add("panel", undefined, "4. Text and layers");
        pSty.alignChildren = ["fill", "top"]; pSty.margins = [8, 14, 8, 8]; pSty.spacing = 4;
        var rF = pSty.add("group"); rF.alignChildren = ["left", "center"]; rF.spacing = 4;
        rF.add("statictext", undefined, "Font");
        ui.fontPreset = rF.add("dropdownlist", undefined, ["Hind Siliguri", "Noto Sans Bengali", "Noto Serif Bengali"]);
        ui.font = rF.add("edittext", undefined, "HindSiliguri-Regular"); ui.font.characters = 22;
        ui.font.helpTip = "PostScript name of an installed Bengali font.";
        var fontNames = ["HindSiliguri-Regular", "NotoSansBengali-Regular", "NotoSerifBengali-Regular"];
        ui.fontPreset.onChange = function () { if (ui.fontPreset.selection) ui.font.text = fontNames[ui.fontPreset.selection.index]; };
        var rS = pSty.add("group"); rS.alignChildren = ["left", "center"]; rS.spacing = 4;
        rS.add("statictext", undefined, "Size");
        ui.size = rS.add("edittext", undefined, "60"); ui.size.characters = 4;
        rS.add("statictext", undefined, "Y %");
        ui.ypos = rS.add("edittext", undefined, "85"); ui.ypos.characters = 4;
        rS.add("statictext", undefined, "Color");
        ui.color = rS.add("dropdownlist", undefined, ["White", "Yellow", "Black"]);
        var rO = pSty.add("group"); rO.alignChildren = ["left", "center"]; rO.spacing = 4;
        rO.add("statictext", undefined, "Time offset (s)");
        ui.offset = rO.add("edittext", undefined, "0"); ui.offset.characters = 5;
        ui.btnCreate = pSty.add("button", undefined, "Create Captions in Comp");

        // ---- saved settings ----
        function loadPrefs() {
            ui.engine.selection = (bcGetSetting("engine", "0") === "1") ? 1 : 0;
            fillModels();
            var m = parseInt(bcGetSetting("model", "2"), 10);
            if (!isNaN(m) && m >= 0 && m < ui.model.items.length) ui.model.selection = m;
            ui.script.selection = (bcGetSetting("script", "0") === "1") ? 1 : 0;
            var mw = parseInt(bcGetSetting("maxWords", "5"), 10); if (isNaN(mw) || mw < 1) mw = 5;
            ui.maxWords.text = String(mw); ui.slider.value = Math.min(mw, 12);
            ui.font.text = bcGetSetting("font", "HindSiliguri-Regular");
            ui.fontPreset.selection = 0;
            ui.font.text = bcGetSetting("font", "HindSiliguri-Regular");
            ui.size.text = bcGetSetting("size", "60");
            ui.ypos.text = bcGetSetting("ypos", "85");
            var ci = parseInt(bcGetSetting("color", "0"), 10); if (isNaN(ci) || ci < 0 || ci > 2) ci = 0;
            ui.color.selection = ci;
        }
        function savePrefs() {
            bcSetSetting("engine", ui.engine.selection.index);
            bcSetSetting("model", ui.model.selection.index);
            bcSetSetting("script", ui.script.selection.index);
            bcSetSetting("maxWords", ui.maxWords.text);
            bcSetSetting("font", ui.font.text);
            bcSetSetting("size", ui.size.text);
            bcSetSetting("ypos", ui.ypos.text);
            bcSetSetting("color", ui.color.selection.index);
        }
        loadPrefs();

        // ---- logic ----
        function activeComp() {
            var c = app.project.activeItem;
            return (c instanceof CompItem) ? c : null;
        }

        ui.btnHelp.onClick = function () {
            alert("Bangla Caption v" + BC_VERSION + "\n\n" +
                "Setup checklist:\n" +
                "1. Run INSTALL.bat (every line of the self test must say OK).\n" +
                "2. After Effects > Preferences > Scripting & Expressions: tick 'Allow Scripts to Write Files and Access Network'.\n" +
                "3. Preferences > Type > Text Engine: 'South Asian and Middle Eastern' (needed for correct Bengali conjuncts).\n" +
                "4. Install Hind Siliguri or Noto Sans Bengali.\n\n" +
                "Troubleshooting:\n" +
                "- Log of the last run: " + Folder.temp.fsName + "\\BanglaCaption\\log.txt\n" +
                "- Data folder: " + bcDataDir().fsName + "\n" +
                "- Audio must be a footage file layer (pre-comps are not supported yet).");
        };

        ui.btnSel.onClick = function () {
            var comp = activeComp();
            if (!comp) { alert("Open a composition first."); return; }
            if (comp.selectedLayers.length !== 1) { alert("Select exactly one footage layer that contains the audio."); return; }
            var ly = comp.selectedLayers[0];
            if (!(ly instanceof AVLayer) || !ly.source || !ly.source.file || !ly.hasAudio) {
                alert("The selected layer must be a footage layer (audio or video file) with audio.\nPre-comps are not supported yet: select the original file layer.");
                return;
            }
            BC.srcPath = ly.source.file.fsName;
            BC.srcOffset = ly.startTime;
            BC.srcStretch = ly.stretch;
            ui.src.text = ly.name + "  (" + BC.srcPath + ")";
        };

        ui.btnBrowse.onClick = function () {
            var f = File.openDialog("Choose an audio or video file");
            if (!f) return;
            BC.srcPath = f.fsName; BC.srcOffset = 0; BC.srcStretch = 100;
            ui.src.text = BC.srcPath;
        };

        ui.btnGen.onClick = function () {
            if (!BC.srcPath) { alert("Choose an audio source first."); return; }
            setEnv();
            if (!bcEnvReady()) {
                alert("The speech engine is not installed.\nRun INSTALL.bat from the Bangla Caption folder, then try again.\nExpected: " + bcDataDir().fsName);
                return;
            }
            savePrefs();
            var py = new File(bcDataDir().fsName + "/venv/Scripts/python.exe");
            var worker = new File(bcDataDir().fsName + "/worker/bangla_caption_worker.py");
            var jd = bcJobDir();
            var jobF = new File(jd.fsName + "/job.json");
            var batF = new File(jd.fsName + "/run.bat");
            BC.progressPath = jd.fsName + "/progress.json";
            BC.resultPath = jd.fsName + "/result.json";
            new File(BC.progressPath).remove(); new File(BC.resultPath).remove();
            var engine = ui.engine.selection.index === 1 ? "whisper" : "banglaspeech2text";
            var job = "{\"audio\":" + bcJsonStr(BC.srcPath) + ",\"engine\":" + bcJsonStr(engine) +
                ",\"model\":" + bcJsonStr(ui.model.selection.text) +
                ",\"out\":" + bcJsonStr(BC.resultPath.replace(/\//g, "\\")) +
                ",\"progress\":" + bcJsonStr(BC.progressPath.replace(/\//g, "\\")) + "}";
            var bat = "@echo off\r\n\"" + py.fsName + "\" \"" + worker.fsName + "\" --job \"" + jobF.fsName + "\" > \"" + jd.fsName + "\\log.txt\" 2>&1\r\n";
            if (!bcWriteFile(jobF, job, "UTF-8") || !bcWriteFile(batF, bat, "UTF-8")) {
                alert("Cannot write temp files.\nEnable: Preferences > Scripting & Expressions > 'Allow Scripts to Write Files and Access Network'.");
                return;
            }
            ui.btnGen.enabled = false;
            ui.btnCancel.enabled = true;
            BC.pid = 0; BC.t0 = new Date().getTime();
            ui.bar.value = 2; ui.status.text = "Starting...";
            system.callSystem("cmd.exe /c start \"\" /min \"" + batF.fsName + "\"");
            try { BC.taskId = app.scheduleTask("BC_poll()", 1000, true); } catch (e) { BC.taskId = null; }
            if (BC.taskId === null) ui.status.text = "Started. Click 'Check progress' to refresh.";
        };

        ui.btnCheck.onClick = function () { if (BC.progressPath) $.global.BC_poll(); };
        ui.btnCancel.onClick = function () {
            if (BC.pid) system.callSystem("taskkill /PID " + BC.pid + " /T /F");
            if (BC.taskId !== null) { try { app.cancelTask(BC.taskId); } catch (e) { } BC.taskId = null; }
            BC.progressPath = null;
            ui.btnGen.enabled = true; ui.btnCancel.enabled = false;
            ui.bar.value = 0; ui.status.text = "Cancelled.";
        };

        ui.slider.onChanging = function () { ui.maxWords.text = String(Math.round(ui.slider.value)); };
        ui.slider.onChange = function () { ui.maxWords.text = String(Math.round(ui.slider.value)); ui.regroup(); };
        ui.maxWords.onChange = function () {
            var n = parseInt(ui.maxWords.text, 10);
            if (isNaN(n) || n < 1) n = 1;
            if (n > 30) n = 30;
            ui.maxWords.text = String(n);
            ui.slider.value = Math.min(n, 12);
            ui.regroup();
        };
        ui.btnRegroup.onClick = function () { ui.regroup(); };
        ui.script.onChange = function () { ui.regroup(); };

        // Rebuild caption blocks from stored words. No speech recognition is run again.
        ui.regroup = function () {
            if (!BC.rawWords) return;
            var banglish = ui.script.selection.index === 1, words = [], i, n;
            for (i = 0; i < BC.rawWords.length; i++) {
                var rw = BC.rawWords[i];
                words.push({ t: banglish ? rw.r : rw.t, s: rw.s, e: rw.e });
            }
            n = parseInt(ui.maxWords.text, 10); if (isNaN(n) || n < 1) n = 5;
            BC.blocks = bcBuildBlocks(words, n, BC_PHRASE_GAP);
            var lines = [];
            for (i = 0; i < BC.blocks.length; i++) lines.push(BC.blocks[i].text);
            ui.editor.text = lines.join("\r\n");
            ui.info.text = BC.blocks.length + " captions" + (BC.timing === "approx" ? " (estimated word timing)" : "") + ". One line = one caption.";
        };

        ui.btnCreate.onClick = function () {
            var comp = activeComp();
            if (!comp) { alert("Open a composition first."); return; }
            if (!BC.blocks || !BC.blocks.length) { alert("Generate a transcript first."); return; }
            var lines = ui.editor.text.split(/\r\n|\r|\n/);
            while (lines.length && bcTrim(lines[lines.length - 1]) === "") lines.pop();
            if (lines.length !== BC.blocks.length) {
                alert("The editor has " + lines.length + " lines but there are " + BC.blocks.length +
                    " caption blocks.\nKeep one line per caption (edit the words, do not add or remove lines), or press Regroup to start over.");
                return;
            }
            savePrefs();
            var fontName = bcTrim(ui.font.text);
            try {
                if (app.fonts && app.fonts.getFontsByPostScriptName) {
                    var found = app.fonts.getFontsByPostScriptName(fontName);
                    if (!found || found.length === 0) {
                        if (!confirm("Font '" + fontName + "' is not installed (PostScript name).\nContinue with the default font?")) return;
                        fontName = "";
                    }
                }
            } catch (e) { }
            var size = parseFloat(ui.size.text); if (isNaN(size) || size < 1) size = 60;
            var yp = parseFloat(ui.ypos.text); if (isNaN(yp)) yp = 85;
            var userOff = parseFloat(ui.offset.text); if (isNaN(userOff)) userOff = 0;
            var colors = [[1, 1, 1], [1, 0.9, 0.2], [0, 0, 0]];
            var col = colors[ui.color.selection.index];
            var made = 0, i, b, t0, t1, txt, ly, prop, td;

            app.beginUndoGroup("Bangla Caption");
            try {
                for (i = 0; i < BC.blocks.length; i++) {
                    txt = bcTrim(lines[i]);
                    if (!txt) continue;
                    b = BC.blocks[i];
                    t0 = BC.srcOffset + userOff + b.s * BC.srcStretch / 100;
                    t1 = BC.srcOffset + userOff + b.e * BC.srcStretch / 100;
                    if (t0 >= comp.duration || t1 <= 0) continue;
                    if (t1 > comp.duration) t1 = comp.duration;
                    ly = comp.layers.addText(txt);
                    prop = ly.property("ADBE Text Properties").property("ADBE Text Document");
                    td = prop.value;
                    td.resetCharStyle();
                    td.fontSize = size;
                    td.fillColor = col;
                    td.applyFill = true;
                    td.applyStroke = false;
                    if (fontName) { try { td.font = fontName; } catch (e1) { } }
                    td.justification = ParagraphJustification.CENTER_JUSTIFY;
                    prop.setValue(td);
                    ly.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height * yp / 100]);
                    ly.startTime = t0;
                    ly.outPoint = t1;
                    made++;
                }
            } catch (err) {
                alert("Error while creating layers: " + err.toString() + " (line " + err.line + ")");
            } finally {
                app.endUndoGroup();
            }
            ui.status.text = "Created " + made + " text layers.";
        };

        BC.ui = ui;
        w.layout.layout(true);
        w.onResizing = w.onResize = function () { this.layout.resize(); };
        return w;
    }

    var win = buildUI(thisObj);
    if (win instanceof Window) { win.center(); win.show(); }
})(this);
