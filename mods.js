var modsRunOnFrame = [];

function initMods() {
  //loadMod("mods/daynight.js?r=" + Math.random());
}

function loadMod(url) {
  loadf(url, function() {
    eval("var modFunc = " + this.responseText + ";");
    modFunc();
  });
}

function modsOnFrame(timeScale) {
  for(var i = 0; i < modsRunOnFrame.length; i++) {
    modsRunOnFrame[i](timeScale);
  }
}

function addOnFrame(callback) {
  removeOnFrame(callback);
  modsRunOnFrame.push(callback);
}

function removeOnFrame(callback) {
  for(var i = 0; i < modsRunOnFrame.length; i++) {
    if(modsRunOnFrame[i] == callback) {
      modsRunOnFrame.splice(i, 1);
      return;
    }
  }
}