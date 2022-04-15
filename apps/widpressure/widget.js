(() => {
  // Last time Bangle.on('step' was called
  let last_update = new Date();
  let last_update_time = getTime();
  // Last step count when Bangle.on('step' was called
  let last_alt = 0;
  let alt_today = 0;
  let settings;

  function loadSettings() {
    const d = require('Storage').readJSON("wpressure.json", 1) || {};
    settings = Object.assign({
      'goal': 10000,
      'progress': false,
      'large': false,
      'hide': false
    }, d.settings || {});
    return d;
  }

  Bangle.on('step', stepCount => {
    curr_time = getTime();
    if ((curr_time - last_update_time) < 10.0)
    {
        Bangle.getPressure().then(processAlt);
    }
    last_update_time = curr_time;
  });

  function processAlt(current_pressure) {
    var current_alt = current_pressure.altitude;
    var delta_alt = current_alt-last_alt;
    if (last_alt===undefined || current_alt===undefined || delta_alt<0) delta_alt=0;
    last_alt = current_alt;
    let date = new Date();
    if (last_update.getDate() == date.getDate()){
      alt_today += delta_alt;
    } else {
      // TODO: could save this to "wpressure.json" for last_update's day?
      alt_today = delta_alt;
    }
    if (alt_today === settings.goal
        && !(require('Storage').readJSON('setting.json',1)||{}).quiet) {
      let b = 3, buzz = () => {
        if (b--) Bangle.buzz().then(() => setTimeout(buzz, 100));
      };
      buzz();
    }
    last_update = date;
    //console.log("up: " + up + " stp: " + alt_today + " " + date.toString());
    WIDGETS["wpressure"].redraw();
  }
  // redraw when the LCD turns on
  Bangle.on('lcdPower', function(on) {
    if (on) WIDGETS["wpressure"].redraw();
  });
  // When unloading, save state
  E.on('kill', () => {
    require("Storage").writeJSON("wpressure.json",{
      last_update : last_update.valueOf(),
      alt_today : alt_today,
      settings   : settings,
    });
  });

  // add your widget
  WIDGETS["wpressure"]={area:"tl",width:0,
    getWidth:function() {
      let stps = alt_today.toString();
      let newWidth = 24;
      if (settings.hide)
        newWidth = 0;
      else {
        if (settings.large) {
          newWidth = 12 * stps.length + 3;
          if (settings.progress)
            newWidth += 24;
        }
      }
      return newWidth;
    },
    redraw:function() { // work out the width, and queue a full redraw if needed
      let newWidth = this.getWidth();
      if (newWidth!=this.width) {
        // width has changed, re-layout all widgets
        this.width = newWidth;
        Bangle.drawWidgets();
      } else {
        // width not changed - just redraw
        WIDGETS["wpressure"].draw();
      }
    },
    draw:function() {
      if (settings.hide) return;
      if (alt_today > 99999)
        alt_today = alt_today % 100000; // cap to five digits + comma = 6 characters
      let stps = alt_today.toString();
      g.reset().clearRect(this.x, this.y, this.x + this.width, this.y + 23); // erase background
      if (settings.progress) {
        const width = 23, half = 11;
        const goal = settings.goal, left = Math.max(goal-stps,0);
        // blue or dark green
        g.setColor(left ? "#08f" : "#080").fillCircle(this.x + half, this.y + half, half);
        if (left) {
          const TAU = Math.PI*2;
          const f = left/goal; // fraction to blank out
          let p = [];
          p.push(half,half);
          p.push(half,0);
          if(f>1/8) p.push(0,0);
          if(f>2/8) p.push(0,half);
          if(f>3/8) p.push(0,width);
          if(f>4/8) p.push(half,width);
          if(f>5/8) p.push(width,width);
          if(f>6/8) p.push(width,half);
          if(f>7/8) p.push(width,0);
          p.push(half - Math.sin(f * TAU) * half);
          p.push(half - Math.cos(f * TAU) * half);
          g.setColor(g.theme.bg).fillPoly(g.transformVertices(p,{x:this.x,y:this.y}));
        }
        g.reset();
      }
      if (settings.large) {
        g.setFont("6x8",2);
        g.setFontAlign(-1, 0);
        g.drawString(stps, this.x + (settings.progress?28:4), this.y + 12);
      } else {
        let w = 24;
        if (stps.length > 3){
          stps = stps.slice(0,-3) + "," + stps.slice(-3);
          g.setFont("4x6", 1); // if big, shrink text to fix
        } else {
          g.setFont("6x8", 1);
        }
        g.setFontAlign(0, 0); // align to x: center, y: center
        g.drawString(stps, this.x+w/2, this.y+19);
        g.drawImage(atob("CgoCLguH9f2/7+v6/79f56CtAAAD9fw/n8Hx9A=="),this.x+(w-10)/2,this.y+2);
      }
    },
    reload:function() {
      loadSettings();
      WIDGETS["wpressure"].redraw();
    },
    getAlt:()=>alt_today
  };
  // Load data at startup
  let pedomData = loadSettings();
  if (pedomData) {
    if (pedomData.last_update)
      last_update = new Date(pedomData.last_update);
    alt_today = pedomData.alt_today|0;
    delete pedomData;
  }
  WIDGETS["wpressure"].width = WIDGETS["wpressure"].getWidth();
})()
