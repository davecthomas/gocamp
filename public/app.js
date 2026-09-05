// The Rockies Line — trip planner.
// Data lives in data/*.js and loads before this file.
// The Mapbox token is never present here; map requests go through /api/mapbox.

(function(){
  var CLIMB_EFF = 0.88, REGEN_EFF = 0.65, G = 9.81;
  var avgSpeed = 65;
  var BATTERY_KWH = 112, EPA_RANGE = 450;
  var CURB_LB = 6173;                 // Lucid's published Gravity curb weight, 2,800 kg
  var LB_PER_KG = 0.45359237;
  var MPS_PER_MPH = 0.44704;
  var METRES_PER_MILE = 1609.344;
  var payloadLb = 620;                // two adults, a dog, camping gear and luggage

  // road-load model: rolling resistance scales with mass, drag scales with speed squared
  var CRR = 0.008;                    // rolling resistance coefficient, typical EV tyre
  var CD = 0.24;                      // Lucid's published Gravity drag coefficient
  var FRONTAL_AREA = 2.7;             // m^2, estimated for a three-row SUV
  var RHO = 1.225;                    // air density at sea level, kg/m^3
  var DRIVETRAIN_EFF = 0.90;

  var DEFAULT_PAYLOAD_LB = 620;
  var REF_MASS_KG = (CURB_LB + DEFAULT_PAYLOAD_LB) * LB_PER_KG;
  var REF_MPH = 65;
  var REF_WH_PER_MI = (BATTERY_KWH * 1000) / EPA_RANGE;   // 249 Wh/mi, the calibration point

  function loadedMassKg(){
    return (CURB_LB + payloadLb) * LB_PER_KG;
  }
  function rollingN(massKg){ return CRR * massKg * G; }
  function aeroN(mph){
    var v = mph * MPS_PER_MPH;
    return 0.5 * RHO * CD * FRONTAL_AREA * v * v;
  }

  // Calibrated so the EPA figure is what the default load draws at 65 mph, then
  // scaled by the physics from there.
  function whPerMile(massKg, mph){
    var here = rollingN(massKg) + aeroN(mph);
    var ref = rollingN(REF_MASS_KG) + aeroN(REF_MPH);
    return REF_WH_PER_MI * (here / ref);
  }

  function currentWhPerMile(){ return whPerMile(loadedMassKg(), avgSpeed); }
  function currentRangeMi(){ return (BATTERY_KWH * 1000) / currentWhPerMile(); }

  // Energy to lift the loaded car 1,000 ft, expressed as miles of flat-road range
  // at the consumption the car is actually running at.
  function milesPer1000ft(dir){
    var joules = loadedMassKg() * G * 304.8;
    var kwhRaw = joules / 3.6e6;
    var kwh = dir === 'climb' ? kwhRaw / (CLIMB_EFF * DRIVETRAIN_EFF) : kwhRaw * REGEN_EFF;
    return (kwh * 1000) / currentWhPerMile();
  }
  var CLIMB_MI = 0, DESCENT_MI = 0;

  var legs = [
    {id:'l1', parkId:'palo-duro', from:'Austin, TX', to:'Amarillo, TX', miles:480, time:435, elevStart:489, elevEnd:3676, type:'city', isOvernight:true,
     title:'Amarillo, TX', badge:{cls:'sp', text:'State Park'}, camp:'Palo Duro Canyon State Park — Hackberry Camp Area',
     note:'Long first day across the plains. Second-largest canyon in the US.',
     dog:'good', dogNote:'Leashed dogs welcome on every trail and every campsite.',
     links:[
       {label:'Park info', url:'https://tpwd.texas.gov/state-parks/palo-duro-canyon'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/texas/palo-duro-canyon-state-park'},
       {label:'Reserve campsite', url:'https://texasstateparks.reserveamerica.com/camping/palo-duro-canyon-state-park/r/facilityDetails.do?contractCode=TX&parkId=1200105', reserve:true}
     ]},
    {id:'l2', parkId:'golden-gate', from:'Amarillo, TX', to:'Denver, CO', miles:440, time:390, elevStart:3676, elevEnd:5280, type:'city', isOvernight:true,
     title:'Denver, CO', badge:{cls:'city', text:'Staging city'}, camp:'Golden Gate Canyon SP (30 min west) or push into the metro',
     note:'Last night before the climbing starts. Charge to 100% here if driving Trail Ridge next.',
     dog:'good', dogNote:'Golden Gate Canyon SP allows leashed dogs on all its trails.',
     links:[
       {label:'Park info', url:'https://cpw.state.co.us/placestogo/parks/goldengatecanyon'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/colorado/golden-gate-canyon-state-park'},
       {label:'Reserve campsite', url:'https://www.cpwshop.com/camping/golden-gate-canyon-state-park/r/campgroundDetails.page?parkID=50025', reserve:true}
     ]},
    {id:'l3', from:'Denver, CO', to:'Estes Park, CO', miles:65, time:90, elevStart:5280, elevEnd:7522, type:'gateway',
     title:'Estes Park, CO', badge:{cls:'city', text:'Gateway town'}, camp:'—',
     note:'RMNP gateway. This is where the timed-entry permit and NPS pet rules begin.',
     dog:'good', dogNote:'Downtown and the surrounding forest are dog-friendly. The restrictions start at the entrance station.'},
    {id:'l4', parkId:'rmnp', from:'Estes Park, CO', to:'Alpine Visitor Center', miles:25, time:60, elevStart:7522, elevEnd:12183, type:'np-summit',
     title:'Trail Ridge Road summit', badge:{cls:'np', text:'Rocky Mountain NP'}, camp:'Timber Creek CG (west side, after the descent)',
     note:'Highest continuous paved road in the US. Open roughly Memorial Day–mid October only.',
     dog:'restricted', dogNote:'RMNP bans dogs on every trail and boardwalk, even leashed. Pets stay in the car, the campground, or within 100 ft of the road.',
     links:[
       {label:'Park info', url:'https://www.nps.gov/romo/index.htm'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/colorado/rocky-mountain-national-park'},
       {label:'Road status', url:'https://www.nps.gov/romo/planyourvisit/road_status.htm'},
       {label:'Timed-entry permits', url:'https://www.nps.gov/romo/planyourvisit/timed-entry-permit-system.htm'}
     ]},
    {id:'l5', from:'Alpine Visitor Center', to:'Grand Lake, CO', miles:23, time:60, elevStart:12183, elevEnd:8369, type:'np-exit', isOvernight:true,
     title:'Grand Lake, CO', badge:{cls:'np', text:'RMNP west exit'}, camp:'Timber Creek CG',
     note:'Steep descent. Regen returns part of what the climb spent.',
     dog:'restricted', dogNote:'Same RMNP rule through the west side.',
     links:[
       {label:'Reserve campsite', url:'https://www.recreation.gov/search?q=Timber%20Creek%20Campground', reserve:true}
     ]},
    {id:'l6', parkId:'bridger-teton', from:'Grand Lake, CO', to:'Jackson, WY', miles:440, time:465, elevStart:8369, elevEnd:6237, type:'nf', isOvernight:true,
     title:'Jackson, WY', badge:{cls:'nf', text:'Bridger-Teton NF en route'}, camp:'Gros Ventre CG or Bridger-Teton NF dispersed sites',
     note:'The long haul of the trip, via Walden, Rawlins, Lander, and Dubois. Split into two driving days if the pace feels long.',
     dog:'good', dogNote:'Bridger-Teton NF dispersed sites and trails allow leashed dogs, the longest stretch on the route where dogs can be on trails.',
     links:[
       {label:'Forest info', url:'https://www.fs.usda.gov/btnf'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/wyoming/bridger-teton-national-forest'},
       {label:'Reserve campsite', url:'https://www.recreation.gov/search?q=Gros%20Ventre%20Campground', reserve:true}
     ]},
    {id:'l7', parkId:'grand-teton', from:'Jackson, WY', to:'Jenny Lake, WY', miles:20, time:30, elevStart:6237, elevEnd:6783, type:'np', isOvernight:true,
     title:'Grand Teton NP (Jenny Lake)', badge:{cls:'np', text:'Grand Teton NP'}, camp:'Jenny Lake CG or Colter Bay CG',
     note:'Book Recreation.gov exactly 6 months ahead; this campground sells out same-day.',
     dog:'restricted', dogNote:'Pets allowed on paved pathways, roads, and in campgrounds and parking lots. Backcountry trails are off limits.',
     links:[
       {label:'Park info', url:'https://www.nps.gov/grte/index.htm'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/wyoming/grand-teton-national-park'},
       {label:'Reserve Jenny Lake CG', url:'https://www.recreation.gov/search?q=Jenny%20Lake%20Campground', reserve:true},
       {label:'Reserve Colter Bay CG', url:'https://www.recreation.gov/search?q=Colter%20Bay%20Campground', reserve:true}
     ]},
    {id:'l8', parkId:'yellowstone', from:'Jenny Lake, WY', to:'Canyon Village, WY', miles:96, time:150, elevStart:6783, elevEnd:7926, type:'np', isOvernight:true,
     title:'Yellowstone — Old Faithful to Canyon', badge:{cls:'np', text:'Yellowstone NP'}, camp:'Canyon Village or Madison CG',
     note:'Enter at South Entrance, loop past Old Faithful and the Grand Canyon of the Yellowstone.',
     dog:'restricted', dogNote:'Pets must stay within 100 ft of roads, parking areas, and campgrounds. No trails or boardwalks, no exceptions.',
     links:[
       {label:'Park info', url:'https://www.nps.gov/yell/index.htm'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/wyoming/yellowstone-national-park'},
       {label:'Reserve campsite', url:'https://secure.yellowstonenationalparklodges.com/booking/lodging', reserve:true}
     ]},
    {id:'l9', from:'Canyon Village, WY', to:'West Yellowstone, MT', miles:40, time:60, elevStart:7926, elevEnd:6667, type:'gateway',
     title:'West Yellowstone, MT', badge:{cls:'city', text:'Gateway town'}, camp:'—',
     note:'Resupply and charge before the Montana stretch.',
     dog:'good', dogNote:'Town and nearby Gallatin NF trails are leash-friendly.'},
    {id:'l10', from:'West Yellowstone, MT', to:'Bozeman, MT', miles:90, time:105, elevStart:6667, elevEnd:4820, type:'city',
     title:'Bozeman, MT', badge:{cls:'city', text:'City'}, camp:'—',
     note:'Last resupply stop before the Missoula fork.',
     dog:'good', dogNote:'Several off-leash city parks if the dog needs to run.'},
    {id:'l11', from:'Bozeman, MT', to:'Missoula, MT', miles:200, time:180, elevStart:4820, elevEnd:3209, type:'decision',
     title:'Missoula, MT', badge:{cls:'city', text:'Decision point'}, camp:'—',
     note:'Glacier or straight to Seattle. Toggle the switch at the top to see how the numbers change.',
     dog:'good', dogNote:'City is dog-friendly.'}
  ];

  var directFinal = [
    {id:'l12', parkId:'farragut', from:'Missoula, MT', to:'Spokane, WA', miles:200, time:180, elevStart:3209, elevEnd:1843, type:'city', isOvernight:true,
     title:'Spokane, WA', badge:{cls:'city', text:'City'}, camp:'Farragut SP (Idaho, optional overnight)',
     note:'Direct I-90 stretch if skipping Glacier.',
     dog:'good', dogNote:'Farragut SP allows leashed dogs on all its trails.',
     links:[
       {label:'Park info', url:'https://parksandrecreation.idaho.gov/parks/farragut/'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/idaho/farragut-state-park'},
       {label:'Reserve campsite', url:'http://getoutside.idaho.gov/Farragut', reserve:true}
     ]},
    {id:'l13', from:'Spokane, WA', to:'Seattle, WA', miles:280, time:255, elevStart:1843, elevEnd:175, type:'end',
     title:'Seattle, WA', badge:{cls:'city', text:'Arrival'}, camp:'—',
     note:'Last leg: 1,668 ft of net descent.',
     dog:'good', dogNote:'Trip complete.'}
  ];

  var glacierBranch = [
    {id:'b1', parkId:'glacier', from:'Missoula, MT', to:'Logan Pass', miles:150, time:150, elevStart:3209, elevEnd:6646, type:'np-summit', isOvernight:true,
     title:'Logan Pass, Glacier NP', badge:{cls:'np', text:'Glacier NP · branch'}, camp:'Apgar CG or Fish Creek CG',
     note:'Going-to-the-Sun Road, open roughly late June–mid September only. Adds about 1–2 days to the trip.',
     dog:'restricted', dogNote:'Glacier matches the other parks: no dogs on any trail, even leashed. Front-country and campgrounds only.', branch:true,
     links:[
       {label:'Park info', url:'https://www.nps.gov/glac/index.htm'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/montana/glacier-national-park'},
       {label:'Road status', url:'https://www.nps.gov/glac/planyourvisit/directions.htm'},
       {label:'Reserve campsite', url:'https://www.recreation.gov/search?q=Fish%20Creek%20Campground', reserve:true}
     ]},
    {id:'b2', parkId:'farragut', from:'Logan Pass', to:'Spokane, WA', miles:230, time:270, elevStart:6646, elevEnd:1843, type:'city', isOvernight:true,
     title:'Spokane, WA (via Glacier)', badge:{cls:'city', text:'Rejoin I-90'}, camp:'Farragut SP (Idaho, optional overnight)',
     note:'Rejoins I-90 near Sandpoint rather than backtracking through Missoula.',
     dog:'good', dogNote:'Farragut SP allows leashed dogs on all its trails.', branch:true,
     links:[
       {label:'Park info', url:'https://parksandrecreation.idaho.gov/parks/farragut/'},
       {label:'Trails (AllTrails)', url:'https://www.alltrails.com/parks/us/idaho/farragut-state-park'},
       {label:'Reserve campsite', url:'http://getoutside.idaho.gov/Farragut', reserve:true}
     ]},
    {id:'l13g', from:'Spokane, WA', to:'Seattle, WA', miles:280, time:255, elevStart:1843, elevEnd:175, type:'end',
     title:'Seattle, WA', badge:{cls:'city', text:'Arrival'}, camp:'—',
     note:'Last leg: 1,668 ft of net descent.',
     dog:'good', dogNote:'Trip complete.'}
  ];

  // ---------- climate normals, 1991-2020, [meanHighF, meanLowF, precipIn] by month ----------

  // which station each stop reads from; liftFt raises the stop above that station

  var LAPSE_F_PER_1000FT = 3.5;   // standard atmospheric lapse rate
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // alpine road seasons, as [startMonth, startDay, endMonth, endDay]
  var ROAD_SEASON = {
    l4: {name:'Trail Ridge Road', from:[5,24], to:[10,15]},
    b1: {name:'Going-to-the-Sun Road', from:[6,25], to:[9,15]}
  };

  function roadOpenOn(key, date){
    var r = ROAD_SEASON[key];
    if(!r || !date) return null;
    var y = date.getFullYear();
    var from = new Date(y, r.from[0]-1, r.from[1]);
    var to = new Date(y, r.to[0]-1, r.to[1]);
    return {name:r.name, open: date >= from && date <= to,
            window: MONTHS[r.from[0]-1] + ' ' + r.from[1] + ' to ' + MONTHS[r.to[0]-1] + ' ' + r.to[1]};
  }

  function weatherFor(legId, date){
    var st = STATION[legId];
    if(!st || !date) return null;
    var c = CLIMATE[st.s];
    var mo = date.getMonth();
    var lift = st.liftFt ? (st.liftFt/1000)*LAPSE_F_PER_1000FT : 0;
    var high = Math.round(c.m[mo][0] - lift);
    var low = Math.round(c.m[mo][1] - lift);
    var precip = c.m[mo][2];
    var note;
    if(precip >= 3) note = 'wet month';
    else if(precip >= 2) note = 'showers likely';
    else if(precip >= 1) note = 'scattered showers';
    else note = 'dry';
    return {
      station: c.name, month: MONTHS[mo], high: high, low: low, precip: precip,
      note: note, freezes: low <= 32, lift: st.liftFt || 0,
      liftF: Math.round(lift)
    };
  }

  function fmtDate(d){
    return d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
  }

  function hasCamp(c){
    return !!c && !/^[\s\u2013\u2014-]*$/.test(c);
  }

  // ---------- speed ----------
  // Every leg's stored time assumes a 65 mph highway average. Park and mountain roads
  // are slower than that in the source data, and stay proportionally slower here.
  var BASE_MPH = 65;

  function legHours(leg){
    return (leg.time/60) * (BASE_MPH / avgSpeed);
  }

  function fmtHours(hours){
    var mins = Math.round(hours * 60);
    var hr = Math.floor(mins / 60), mn = mins % 60;
    if(hr === 0) return mn + ' min';
    if(mn === 0) return hr + ' hr';
    return hr + ' hr ' + mn + ' min';
  }

  // ---------- schedule: walk the route and give every stop a date ----------
  var MAX_DRIVE_HRS = 7.5;   // most hours behind the wheel in one day

  function buildSchedule(all, nights, startDate){
    var day = 0, hrs = 0, offsets = {};
    all.forEach(function(leg){
      hrs += legHours(leg);
      while(hrs > MAX_DRIVE_HRS){ day += 1; hrs -= MAX_DRIVE_HRS; }
      offsets[leg.id] = day;
      if(leg.isOvernight){ day += nights; hrs = 0; }
    });
    var dates = {};
    if(startDate){
      Object.keys(offsets).forEach(function(k){
        var d = new Date(startDate.getTime());
        d.setDate(d.getDate() + offsets[k]);
        dates[k] = d;
      });
    }
    return {offsets: offsets, dates: dates, totalDays: day + 1};
  }

  function parseDateInput(v){
    if(!v) return null;
    var p = v.split('-');
    if(p.length !== 3) return null;
    var d = new Date(+p[0], +p[1]-1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function toDateInput(d){
    var m = ('0'+(d.getMonth()+1)).slice(-2), day = ('0'+d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }

  var schedule = {offsets:{}, dates:{}, totalDays:0};

  function wxHTML(legId){
    var date = schedule.dates[legId];
    var w = weatherFor(legId, date);
    if(!w) return '';
    var bits = '<div class="wxrow">';
    if(date) bits += '<span class="wxdate">' + fmtDate(date) + '</span>';
    bits += '<span class="wxtemp">' + w.high + '\u00b0 / ' + w.low + '\u00b0F</span>';
    bits += '<span class="wxnote">' + w.month + ' normals, ' + w.precip.toFixed(1) + ' in, ' + w.note;
    bits += ' \u00b7 ' + w.station + ' station';
    if(w.lift) bits += ', adjusted ' + w.liftF + '\u00b0 colder for the ' + w.lift.toLocaleString() + ' ft it sits above that station';
    bits += '</span>';
    if(w.freezes) bits += '<span class="wxfreeze">nights at or below freezing</span>';
    var road = roadOpenOn(legId, date);
    if(road && !road.open) bits += '<span class="wxclosed">' + road.name + ' is normally closed on this date. Its usual season is ' + road.window + '.</span>';
    bits += '</div>';
    return bits;
  }

  function altTax(leg){
    var d = leg.elevEnd - leg.elevStart;
    if(d > 0) return {cost: (d/1000)*CLIMB_MI, bonus:0};
    return {cost:0, bonus: (Math.abs(d)/1000)*DESCENT_MI};
  }

  var spineEl = document.getElementById('spine');

  function pinIcon(type){
    if(type==='np' || type==='np-summit' || type==='np-exit') return '▲';
    if(type==='nf') return '🌲';
    if(type==='decision') return '◆';
    if(type==='end') return '●';
    if(type==='gateway') return '○';
    return '●';
  }

  function renderStops(list){
    spineEl.innerHTML = '';
    list.forEach(function(leg){
      var div = document.createElement('div');
      div.className = 'stop' + (leg.branch ? ' branch' : '');
      div.innerHTML =
        '<div class="marker">'+pinIcon(leg.type)+'</div>'+
        '<div class="card" data-leg="'+leg.id+'">'+
          '<div class="card-top">'+
            '<div><h3>'+leg.title+'</h3>'+
              '<div class="badges"><span class="badge '+leg.badge.cls+'">'+leg.badge.text+'</span></div>'+
            '</div>'+
            '<div class="mile">'+leg.miles+' mi · '+fmtHours(legHours(leg))+'</div>'+
          '</div>'+
          '<div class="legrow">'+
            '<span class="elev">'+leg.elevStart.toLocaleString()+' ft → '+leg.elevEnd.toLocaleString()+' ft'+
              ' <span class="delta '+(leg.elevEnd>=leg.elevStart?'up':'down')+'">'+(leg.elevEnd>=leg.elevStart?'+':'')+(leg.elevEnd-leg.elevStart).toLocaleString()+' ft</span></span>'+
            (hasCamp(leg.camp) ? '<span>⛺ '+leg.camp+'</span>' : '')+
          '</div>'+
          wxHTML(leg.id)+
          '<p class="note">'+leg.note+'</p>'+
          '<div class="dogpill '+leg.dog+'">'+(leg.dog==='good'?'🐾 Trail-friendly — ':'🐾 Restricted — ')+leg.dogNote+'</div>'+
          '<div class="rangebit" data-rangebit="'+leg.id+'"></div>'+
          (leg.links ? '<div class="linkrow">'+leg.links.map(function(l){
            return '<a class="linkbtn'+(l.reserve?' reserve':'')+'" href="'+l.url+'" target="_blank" rel="noopener">'+(l.reserve?'⛺ ':'')+l.label+(l.reserve?'':' ↗')+'</a>';
          }).join('')+'</div>' : '')+
        '</div>';
      spineEl.appendChild(div);
    });
  }

  function updateRangebits(list){
    list.forEach(function(leg){
      var t = altTax(leg);
      var el = document.querySelector('[data-rangebit="'+leg.id+'"]');
      if(!el) return;
      if(t.cost > 0.5){
        el.innerHTML = '⛰ climb tax: <b class="tax">+'+Math.round(t.cost)+' mi</b> of effective range';
      } else if(t.bonus > 0.5){
        el.innerHTML = '↓ regen bonus: <b>−'+Math.round(t.bonus)+' mi</b> of effective range';
      } else {
        el.innerHTML = 'negligible altitude effect';
      }
    });
  }

  var glacierOn = false;

  function currentLegs(){
    return glacierOn ? legs.concat(glacierBranch) : legs.concat(directFinal);
  }

  function stopsForLeg(effectiveMiles, cadence){
    return Math.max(0, Math.ceil(effectiveMiles / cadence) - 1);
  }

  function recompute(){
    var cadence = parseInt(document.getElementById('cadence').value, 10);
    var nights = parseInt(document.getElementById('nights').value, 10);
    avgSpeed = parseInt(document.getElementById('avgSpeed').value, 10);
    payloadLb = parseInt(document.getElementById('payload').value, 10);
    var reservePct = parseInt(document.getElementById('reserve').value, 10);
    CLIMB_MI = milesPer1000ft('climb');
    DESCENT_MI = milesPer1000ft('descent');
    document.getElementById('loadVal').textContent = payloadLb.toLocaleString() + ' lb';
    document.getElementById('loadedWeight').textContent = Math.round(CURB_LB + payloadLb).toLocaleString() + ' lb';
    document.getElementById('sliderVal').textContent = cadence + ' mi';
    document.getElementById('nightsVal').textContent = nights + (nights === 1 ? ' night' : ' nights');
    document.getElementById('speedVal').textContent = avgSpeed + ' mph';
    document.getElementById('sliderTime').textContent =
      '\u00b7 ' + fmtHours(cadence / avgSpeed) + ' at ' + avgSpeed + ' mph';

    var all = currentLegs();
    var planIntervalForStops = Math.min(cadence, currentRangeMi() * (100 - reservePct) / 100);
    var flat = 0, effective = 0, stops = 0, campStops = 0;
    var parks = {};
    all.forEach(function(leg){
      var t = altTax(leg);
      var eff = leg.miles + t.cost - t.bonus;
      flat += leg.miles;
      effective += eff;
      stops += stopsForLeg(eff, planIntervalForStops);
      if(leg.isOvernight) campStops++;
      if(leg.parkId) parks[leg.parkId] = true;
    });

    document.getElementById('outFlat').textContent = Math.round(flat).toLocaleString() + ' mi';
    document.getElementById('outEffective').textContent = Math.round(effective).toLocaleString() + ' mi';
    var tax = Math.round(effective - flat);
    document.getElementById('outTax').textContent = (tax>=0?'+':'') + tax + ' mi';
    document.getElementById('outStops').textContent = stops;

    document.getElementById('fmlClimb').textContent = CLIMB_MI.toFixed(1) + ' mi';
    document.getElementById('fmlDescent').textContent = DESCENT_MI.toFixed(1) + ' mi';

    var rangeMi = currentRangeMi();
    var usableMi = rangeMi * (100 - reservePct) / 100;
    document.getElementById('outRange').textContent = Math.round(rangeMi).toLocaleString() + ' mi';
    document.getElementById('outUsable').textContent = Math.round(usableMi).toLocaleString() + ' mi';
    document.getElementById('reserveVal').textContent = reservePct + '%';
    document.getElementById('reserveSub').textContent =
      '\u00b7 ' + Math.round(usableMi) + ' mi usable of ' + Math.round(rangeMi) + ' mi';

    // the planning interval can never exceed what the reserve leaves on the table
    var planInterval = Math.min(cadence, usableMi);
    var clamped = cadence > usableMi;

    // the real constraint is the longest stretch with no Supercharger on it
    var worstGap = CHARGER_GAPS[0];
    var failing = null;
    for(var gi = 0; gi < CHARGER_GAPS.length; gi++){
      if(CHARGER_GAPS[gi][0] > usableMi){ failing = CHARGER_GAPS[gi]; break; }
    }

    var warnEl = document.getElementById('rangeWarn');
    var bits = [];
    if(clamped){
      bits.push('<span class="warn">Your ' + cadence + ' mi interval exceeds the ' + Math.round(usableMi) +
        ' mi you can use above a ' + reservePct + '% reserve, so the plan stops every ' + Math.round(planInterval) + ' mi instead.</span>');
    } else {
      bits.push('<span class="ok">' + cadence + ' mi between stops uses ' + Math.round(cadence/usableMi*100) +
        '% of the ' + Math.round(usableMi) + ' mi you can use above a ' + reservePct + '% reserve.</span>');
    }
    if(failing){
      bits.push('<span class="warn">The ' + failing[0] + ' mi run from ' + failing[1] + ' to ' + failing[2] +
        ' has no Supercharger on it and exceeds that. Slow down, lighten the load, or cut the reserve.</span>');
    } else {
      bits.push('Longest Supercharger gap on the route is ' + worstGap[0] + ' mi, ' + worstGap[1] +
        ' to ' + worstGap[2] + ', which fits with ' + Math.round(usableMi - worstGap[0]) + ' mi to spare.');
    }
    bits.push('Drawn at ' + Math.round(currentWhPerMile()) + ' Wh/mi.');
    warnEl.innerHTML = bits.join(' ');

    var startEl = document.getElementById('startDate');
    var endEl = document.getElementById('endDate');
    var startDate = parseDateInput(startEl.value);
    schedule = buildSchedule(all, nights, startDate);
    var totalDays = schedule.totalDays;

    if(startDate){
      var arrive = new Date(startDate.getTime());
      arrive.setDate(arrive.getDate() + totalDays - 1);
      endEl.value = toDateInput(arrive);
      renderDateSummary(startDate, arrive, totalDays);
    } else {
      document.getElementById('dateSummary').innerHTML = 'Pick a departure date to schedule the stops and their typical weather.';
    }

    var wheelHrs = all.reduce(function(s,l){ return s + legHours(l); }, 0);
    document.getElementById('statWheel').textContent = fmtHours(wheelHrs);
    document.getElementById('outDays').textContent = totalDays;
    document.getElementById('statDays').textContent = totalDays;
    document.getElementById('statMiles').textContent = Math.round(flat).toLocaleString() + ' mi';
    document.getElementById('statParks').textContent = Object.keys(parks).length;

    document.getElementById('parkSeqTag').textContent = glacierOn
      ? 'Palo Duro SP → Golden Gate Canyon SP → Rocky Mountain NP → Bridger-Teton NF → Grand Teton NP → Yellowstone NP → Glacier NP → Farragut SP'
      : 'Palo Duro SP → Golden Gate Canyon SP → Rocky Mountain NP → Bridger-Teton NF → Grand Teton NP → Yellowstone NP → Farragut SP';

    renderStops(all);
    updateRangebits(all);
  }

  function renderDateSummary(start, arrive, days){
    var el = document.getElementById('dateSummary');
    var sameYear = start.getFullYear() === arrive.getFullYear();
    var txt = '<b>' + fmtDate(start) + (sameYear ? '' : ', ' + start.getFullYear()) +
              ' \u2192 ' + fmtDate(arrive) + ', ' + arrive.getFullYear() + '</b> \u00b7 ' + days + ' days on the road.';
    var alerts = [];
    ['l4','b1'].forEach(function(key){
      if(key === 'b1' && !glacierOn) return;
      var d = schedule.dates[key];
      if(!d) return;
      var road = roadOpenOn(key, d);
      if(!road) return;
      if(road.open) alerts.push('<span class="okline">' + road.name + ' open</span>');
      else alerts.push('<span class="warn">' + road.name + ' normally closed (' + road.window + ')</span>');
    });
    if(alerts.length) txt += ' ' + alerts.join(' \u00b7 ') + '.';
    el.innerHTML = txt;
  }

  document.getElementById('cadence').addEventListener('input', recompute);
  document.getElementById('nights').addEventListener('input', recompute);
  document.getElementById('avgSpeed').addEventListener('input', recompute);
  document.getElementById('payload').addEventListener('input', recompute);
  document.getElementById('reserve').addEventListener('input', recompute);
  document.getElementById('startDate').addEventListener('change', recompute);
  document.getElementById('endDate').addEventListener('change', function(){
    var end = parseDateInput(this.value);
    if(!end || !schedule.totalDays) return;
    var start = new Date(end.getTime());
    start.setDate(start.getDate() - (schedule.totalDays - 1));
    document.getElementById('startDate').value = toDateInput(start);
    recompute();
  });

  var toggleEl = document.getElementById('glacierToggle');
  toggleEl.addEventListener('click', function(){
    glacierOn = !glacierOn;
    toggleEl.classList.toggle('on', glacierOn);
    toggleEl.setAttribute('aria-checked', glacierOn ? 'true' : 'false');
    recompute();
  });

  // ---------- Tesla Superchargers within 12 miles of the route ----------


  function buildChargerLayer(){
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'chargers');
    SUPERCHARGERS.forEach(function(s){
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', s[1]); c.setAttribute('cy', s[2]); c.setAttribute('r', 2.6);
      c.setAttribute('fill', 'var(--charger)');
      c.setAttribute('stroke', 'var(--map-pin-ring)');
      c.setAttribute('stroke-width', '0.8');
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      t.textContent = s[0] + ' \u00b7 ' + s[3] + ' stalls \u00b7 ' + s[4] + ' kW';
      c.appendChild(t);
      g.appendChild(c);
    });
    // sit under the park pins
    var pins = document.getElementById('pins');
    pins.parentNode.insertBefore(g, pins);

    // names appear only at the deepest zoom, where there is room for them
    var lg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    lg.setAttribute('id', 'charger-labels');
    lg.setAttribute('class', 'detail');
    lg.setAttribute('opacity', '0');
    lg.setAttribute('font-family', 'IBM Plex Mono, monospace');
    lg.setAttribute('font-size', '7.5');
    lg.setAttribute('fill', 'var(--charger)');
    SUPERCHARGERS.forEach(function(s){
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', s[1] + 4.5);
      t.setAttribute('y', s[2] + 2.6);
      t.textContent = s[0].replace(/, [A-Z]{2}$/, '') + ' \u00b7 ' + s[3];
      lg.appendChild(t);
    });
    pins.parentNode.insertBefore(lg, pins);
  }

  // ---------- map zoom, pan and fit ----------
  var VB0 = {x:0, y:0, w:900, h:746.3};
  var BASE_AR = VB0.w / VB0.h;
  function currentAR(){
    var r = mapEl.getBoundingClientRect();
    return (r.width > 0 && r.height > 0) ? (r.width / r.height) : BASE_AR;
  }
  var MIN_W = VB0.w / 8;                 // deepest zoom
  var UNITS_PER_MILE = 97.7 / 200;       // the projection's scale bar: 97.7 units span 200 miles
  var NICE_MILES = [500, 200, 100, 50, 25, 10, 5];
  var mapEl = document.getElementById('mapview');
  var view = {x:VB0.x, y:VB0.y, w:VB0.w, h:VB0.h};

  // elements that must hold a constant screen size while the map scales
  var fixedEls = [];
  function collectFixed(){
    var sel = ['#chargers > circle', '#pins > *', '#hotspots > circle', '#maplabels > text', '#statelabels > text', '#detail-towns circle', '#detail-towns text', '#detail-roads rect', '#detail-roads text', '#charger-labels text'];
    sel.forEach(function(s){
      Array.prototype.forEach.call(mapEl.querySelectorAll(s), function(el){
        var ax, ay;
        if(el.hasAttribute('cx')){ ax = +el.getAttribute('cx'); ay = +el.getAttribute('cy'); }
        else if(el.tagName === 'text'){ ax = +el.getAttribute('x'); ay = +el.getAttribute('y'); }
        else {
          var b = el.getBBox();
          ax = b.x + b.width/2; ay = b.y + b.height/2;
        }
        fixedEls.push({el:el, ax:ax, ay:ay});
      });
    });
  }

  function applyView(){
    mapEl.setAttribute('viewBox', view.x.toFixed(2) + ' ' + view.y.toFixed(2) + ' ' + view.w.toFixed(2) + ' ' + view.h.toFixed(2));
    var s = view.w / VB0.w;              // shrink map furniture as the view narrows
    fixedEls.forEach(function(f){
      f.el.setAttribute('transform', 'translate(' + f.ax + ' ' + f.ay + ') scale(' + s.toFixed(4) + ') translate(' + (-f.ax) + ' ' + (-f.ay) + ')');
    });
    updateScaleBar(s);
    updateDetail();
    var atFull = view.w >= VB0.w - 0.5;
    document.getElementById('zoomOut').disabled = atFull;
    document.getElementById('fitAll').disabled = atFull;
    document.getElementById('zoomIn').disabled = view.w <= MIN_W + 0.5;
  }

  function updateScaleBar(s){
    var g = document.getElementById('scalebar');
    if(!g) return;
    var target = view.w * 0.14;
    var miles = NICE_MILES[0], best = Infinity;
    NICE_MILES.forEach(function(m){
      var d = Math.abs(m*UNITS_PER_MILE - target);
      if(d < best){ best = d; miles = m; }
    });
    var len = miles * UNITS_PER_MILE;
    var x = view.x + view.w*0.045;
    var y = view.y + view.h - view.h*0.055;
    var tick = 4*s;
    g.querySelector('.sb-line').setAttribute('x1', x);
    g.querySelector('.sb-line').setAttribute('x2', x + len);
    g.querySelector('.sb-line').setAttribute('y1', y);
    g.querySelector('.sb-line').setAttribute('y2', y);
    var caps = g.querySelectorAll('.sb-cap');
    [[x, caps[0]], [x + len, caps[1]]].forEach(function(pair){
      pair[1].setAttribute('x1', pair[0]); pair[1].setAttribute('x2', pair[0]);
      pair[1].setAttribute('y1', y - tick); pair[1].setAttribute('y2', y + tick);
    });
    var t1 = g.querySelector('.sb-label'), t2 = g.querySelector('.sb-proj');
    t1.setAttribute('x', x); t1.setAttribute('y', y + 16*s); t1.textContent = miles + ' mi';
    t1.setAttribute('transform', 'translate(' + x + ' ' + (y+16*s) + ') scale(' + s.toFixed(4) + ') translate(' + (-x) + ' ' + (-(y+16*s)) + ')');
    t2.setAttribute('x', x); t2.setAttribute('y', y + 30*s);
    t2.setAttribute('transform', 'translate(' + x + ' ' + (y+30*s) + ') scale(' + s.toFixed(4) + ') translate(' + (-x) + ' ' + (-(y+30*s)) + ')');
  }

  // ---------- label decluttering ----------
  // A map that shows every label at once is unreadable where sites cluster, so
  // labels are placed in priority order and anything that would collide is dropped.
  var declutter = [];
  function collectLabels(){
    declutter = [];
    function add(sel, priority){
      Array.prototype.forEach.call(mapEl.querySelectorAll(sel), function(el){
        var b;
        try { b = el.getBBox(); } catch(e){ return; }
        if(!b || !b.width) return;
        declutter.push({
          el: el, priority: priority,
          ax: +el.getAttribute('x'), ay: +el.getAttribute('y'),
          bx: b.x, by: b.y, bw: b.width, bh: b.height
        });
      });
    }
    add('#maplabels > text', 0);                 // parks and cities always win
    add('#detail-towns > g > text', 1);
    // bigger Supercharger sites outrank smaller ones
    var chargerEls = mapEl.querySelectorAll('#charger-labels > text');
    Array.prototype.forEach.call(chargerEls, function(el, i){
      var b;
      try { b = el.getBBox(); } catch(e){ return; }
      if(!b || !b.width) return;
      var stalls = SUPERCHARGERS[i] ? SUPERCHARGERS[i][3] : 0;
      declutter.push({
        el: el, priority: 2 + (1 - Math.min(stalls, 40)/40),
        ax: +el.getAttribute('x'), ay: +el.getAttribute('y'),
        bx: b.x, by: b.y, bw: b.width, bh: b.height
      });
    });
    declutter.sort(function(a, b){ return a.priority - b.priority; });
  }

  function overlaps(a, b){
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  function runDeclutter(){
    var s = view.w / VB0.w;
    var pad = 1.4 * s;
    var placed = [];
    var z = zoomFactor();
    declutter.forEach(function(d){
      var visibleTier = d.priority === 0 ? true
                      : d.priority === 1 ? z >= TIER2_ZOOM
                      : z >= TIER3_ZOOM;
      if(!visibleTier){ d.el.style.display = 'none'; return; }
      var r = {
        x: d.ax + (d.bx - d.ax)*s - pad,
        y: d.ay + (d.by - d.ay)*s - pad,
        w: d.bw*s + pad*2,
        h: d.bh*s + pad*2
      };
      // anything off the current view need not be considered
      if(r.x > view.x + view.w || r.x + r.w < view.x || r.y > view.y + view.h || r.y + r.h < view.y){
        d.el.style.display = 'none';
        return;
      }
      for(var i = 0; i < placed.length; i++){
        if(overlaps(r, placed[i])){ d.el.style.display = 'none'; return; }
      }
      d.el.style.display = '';
      placed.push(r);
    });
  }

  // Detail tiers, the way a map app reveals more as you go in.
  // zoom is how much closer the current view is than the whole-region view.
  var TIER2_ZOOM = 1.7;    // route towns and highway numbers
  var TIER3_ZOOM = 3.2;    // Supercharger names
  function zoomFactor(){ return VB0.w / view.w; }

  function fade(id, on){
    var el = document.getElementById(id);
    if(el) el.setAttribute('opacity', on ? '1' : '0');
  }

  function updateDetail(){
    var z = zoomFactor();
    fade('detail-towns', z >= TIER2_ZOOM);
    fade('detail-roads', z >= TIER2_ZOOM);
    fade('charger-labels', z >= TIER3_ZOOM);
    runDeclutter();
    var el = document.getElementById('zoomLevel');
    if(el){
      var tier = z >= TIER3_ZOOM ? 'towns, highways, charger names'
               : z >= TIER2_ZOOM ? 'towns and highways'
               : 'parks and cities';
      el.textContent = z.toFixed(1) + '\u00d7 \u00b7 ' + tier;
    }
  }

  function clampView(){
    var ar = currentAR();
    view.w = Math.min(VB0.w, Math.max(MIN_W, view.w));
    view.h = view.w / ar;
    if(view.h > VB0.h){ view.h = VB0.h; view.w = view.h * ar; }
    view.x = Math.min(VB0.x + VB0.w - view.w, Math.max(VB0.x, view.x));
    view.y = Math.min(VB0.y + VB0.h - view.h, Math.max(VB0.y, view.y));
  }

  function zoomBy(factor){
    var cx = view.x + view.w/2, cy = view.y + view.h/2;
    view.w = view.w * factor;
    view.h = view.w / currentAR();
    view.x = cx - view.w/2;
    view.y = cy - view.h/2;
    clampView();
    applyView();
  }

  function setViewToBox(b, pad){
    var ar = currentAR();
    var w = Math.max(b.width, b.height * ar) * pad;
    var h = w / ar;
    var cx = b.x + b.width/2, cy = b.y + b.height/2;
    view.w = w; view.h = h;
    view.x = cx - w/2; view.y = cy - h/2;
    clampView();
    applyView();
  }

  function tripBox(){
    var ids = ['route-main', 'route-direct', 'route-branch'];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      var b = el.getBBox();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
    });
    if(minX === Infinity) return {x:VB0.x, y:VB0.y, width:VB0.w, height:VB0.h};
    return {x:minX, y:minY, width:maxX-minX, height:maxY-minY};
  }

  document.getElementById('zoomIn').addEventListener('click', function(){ zoomBy(1/1.5); });
  document.getElementById('zoomOut').addEventListener('click', function(){ zoomBy(1.5); });
  document.getElementById('fitTrip').addEventListener('click', function(){ setViewToBox(tripBox(), 1.04); });
  var chargersOn = true;
  document.getElementById('toggleChargers').addEventListener('click', function(){
    chargersOn = !chargersOn;
    var layer = document.getElementById('chargers');
    if(layer) layer.style.display = chargersOn ? '' : 'none';
    document.getElementById('lgCharger').style.display = chargersOn ? '' : 'none';
    this.textContent = chargersOn ? 'Hide chargers' : 'Show chargers';
    this.setAttribute('aria-pressed', chargersOn ? 'true' : 'false');
  });

  document.getElementById('fitAll').addEventListener('click', function(){
    view = {x:VB0.x, y:VB0.y, w:VB0.w, h:VB0.h};
    applyView();
  });

  var resizeTimer = null;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){ clampView(); applyView(); }, 150);
  });

  // drag to pan
  var dragging = false, dragMoved = false, dragStart = null, viewStart = null;
  mapEl.addEventListener('pointerdown', function(e){
    if(e.button !== 0) return;
    dragging = true; dragMoved = false;
    dragStart = {x:e.clientX, y:e.clientY};
    viewStart = {x:view.x, y:view.y};
    mapEl.classList.add('grabbing');
    mapEl.setPointerCapture(e.pointerId);
  });
  mapEl.addEventListener('pointermove', function(e){
    if(!dragging) return;
    var r = mapEl.getBoundingClientRect();
    var dx = (e.clientX - dragStart.x) * (view.w / r.width);
    var dy = (e.clientY - dragStart.y) * (view.h / r.height);
    if(Math.abs(e.clientX - dragStart.x) > 3 || Math.abs(e.clientY - dragStart.y) > 3) dragMoved = true;
    view.x = viewStart.x - dx;
    view.y = viewStart.y - dy;
    clampView();
    applyView();
  });
  ['pointerup','pointercancel'].forEach(function(ev){
    mapEl.addEventListener(ev, function(e){
      if(!dragging) return;
      dragging = false;
      mapEl.classList.remove('grabbing');
      try{ mapEl.releasePointerCapture(e.pointerId); }catch(err){}
    });
  });

  // ---------- real map, Mapbox GL ----------
  // Vector tiles with terrain, so the mountain stretches actually read as mountains.
  // No token here: /api/mapbox attaches it server-side.

  function stopPopupHTML(id, name){
    var leg = findStop(id);
    if(!leg) return '<h5>' + name + '</h5>';
    var css = 'font-size:.75rem;margin-top:.3rem';
    var html = '<h5>' + leg.title + '</h5>';
    html += '<div style="font-size:.7rem;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">' + leg.badge.text + '</div>';
    html += '<div style="' + css + '">Elevation ' + leg.elevEnd.toLocaleString() + ' ft';
    if(leg.miles > 0) html += ' \u00b7 leg ' + leg.miles + ' mi, ' + fmtHours(legHours(leg));
    html += '</div>';
    var w = weatherFor(id, schedule.dates[id]);
    if(w){
      html += '<div style="' + css + '">';
      if(schedule.dates[id]) html += '<b>' + fmtDate(schedule.dates[id]) + '</b> \u00b7 ';
      html += w.high + '\u00b0 / ' + w.low + '\u00b0F, ' + w.month + ' normals';
      if(w.freezes) html += ' \u00b7 freezing nights';
      html += '</div>';
    }
    if(hasCamp(leg.camp)) html += '<div style="' + css + '">\u26fa ' + leg.camp + '</div>';
    html += '<div style="' + css + ';color:' + (leg.dog === 'good' ? 'var(--good)' : 'var(--clay)') +
            '">\ud83d\udc3e ' + leg.dogNote + '</div>';
    if(leg.links){
      html += '<div class="pop-links" style="margin-top:.45rem">' + leg.links.map(function(l){
        return '<a href="' + l.url + '" target="_blank" rel="noopener">' + l.label + ' \u2197</a>';
      }).join('') + '</div>';
    }
    return html;
  }

  function lineFeature(coords, kind){
    return {type:'Feature', properties:{kind:kind},
            geometry:{type:'LineString', coordinates: coords.map(function(p){ return [p[1], p[0]]; })}};
  }

  // Every Mapbox request is rewritten to our own endpoint, which attaches the
  // token server-side. No credential is ever present in this file or in the page.
  var MAPBOX_PROXY = '/api/mapbox?u=';
  function proxied(url){ return MAPBOX_PROXY + encodeURIComponent(url); }

  function buildRealMap(){
    if(typeof mapboxgl === 'undefined' || !mapboxgl.supported || !mapboxgl.supported()) return false;

    // GL JS insists on a token being set. The proxy replaces it on every request,
    // so this placeholder never reaches Mapbox and grants nothing.
    mapboxgl.accessToken = 'proxied';
    var el = document.getElementById('realmap');
    el.classList.add('on');
    document.querySelector('.mapcard').classList.add('real');

    var style = 'mapbox://styles/mapbox/outdoors-v12';   // light topographic: contours, trails, park shading
    var map = new mapboxgl.Map({
      container: 'realmap', style: style,
      center: [-110.5, 42.5], zoom: 4.2, attributionControl: true, cooperativeGestures: true,
      transformRequest: function(url){
        if(url.indexOf('https://api.mapbox.com/') === 0 || url.indexOf('https://events.mapbox.com/') === 0){
          return {url: proxied(url)};
        }
        return {url: url};
      }
    });
    map.addControl(new mapboxgl.NavigationControl({visualizePitch:true}), 'top-left');
    map.addControl(new mapboxgl.ScaleControl({unit:'imperial'}), 'bottom-left');

    // Fixed overlay colours: the basemap stays light whatever the page theme is,
    // so the themed tokens (which go pale in dark mode) would wash out on it.
    var pine = '#2c5424';
    var alpine = '#1f5978';
    var clay = '#a5461c';
    var chargerCol = '#c02f22';

    var bounds = new mapboxgl.LngLatBounds();
    GEO_MAIN.concat(GEO_DIRECT, GEO_BRANCH).forEach(function(p){ bounds.extend([p[1], p[0]]); });

    function addLayers(){
      // terrain, because this is a mountain route
      if(!map.getSource('dem')){
        map.addSource('dem', {type:'raster-dem', url:'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize:512, maxzoom:14});
        map.setTerrain({source:'dem', exaggeration:1.15});
      }

      map.addSource('route', {type:'geojson', data:{type:'FeatureCollection', features:[
        lineFeature(GEO_MAIN, 'main'), lineFeature(GEO_DIRECT, 'main'), lineFeature(GEO_BRANCH, 'branch')
      ]}});
      map.addLayer({id:'route-casing', type:'line', source:'route',
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':'#ffffff', 'line-width':7.5, 'line-opacity':.85}});
      map.addLayer({id:'route-main', type:'line', source:'route', filter:['==',['get','kind'],'main'],
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':pine, 'line-width':4}});
      map.addLayer({id:'route-branch', type:'line', source:'route', filter:['==',['get','kind'],'branch'],
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':alpine, 'line-width':3.5, 'line-dasharray':[2,1.6]}});

      map.addSource('chargers', {type:'geojson', data:{type:'FeatureCollection',
        features: GEO_CHARGERS.map(function(c){
          return {type:'Feature', properties:{name:c[0], stalls:c[3], kw:c[4]},
                  geometry:{type:'Point', coordinates:[c[2], c[1]]}};
        })}});
      map.addLayer({id:'chargers', type:'circle', source:'chargers',
        paint:{
          'circle-radius':['interpolate',['linear'],['zoom'], 4, 2.6, 8, 5, 12, 8],
          'circle-color':chargerCol, 'circle-stroke-color':'#fff', 'circle-stroke-width':1,
          'circle-opacity':.95
        }});
      map.addLayer({id:'charger-labels', type:'symbol', source:'chargers', minzoom:8,
        layout:{'text-field':['concat',['get','name'],'  ',['to-string',['get','stalls']],' stalls'],
                'text-size':11, 'text-offset':[0,1.1], 'text-anchor':'top',
                'text-font':['DIN Offc Pro Medium','Arial Unicode MS Regular']},
        paint:{'text-color':chargerCol, 'text-halo-color':'#ffffff', 'text-halo-width':1.6}});

      var pop = new mapboxgl.Popup({closeButton:false, closeOnClick:false, offset:10});
      map.on('mouseenter','chargers', function(e){
        map.getCanvas().style.cursor='pointer';
        var p = e.features[0].properties;
        pop.setLngLat(e.features[0].geometry.coordinates)
           .setHTML('<b>'+p.name+'</b><br>'+p.stalls+' stalls \u00b7 '+p.kw+' kW').addTo(map);
      });
      map.on('mouseleave','chargers', function(){ map.getCanvas().style.cursor=''; pop.remove(); });

      GEO_STOPS.forEach(function(s){
        var isPark = s[4]==='np' || s[4]==='sp' || s[4]==='nf';
        var d = document.createElement('div');
        d.style.cssText = 'width:'+(isPark?16:13)+'px;height:'+(isPark?16:13)+'px;border-radius:50%;cursor:pointer;'+
          'background:'+(isPark?clay:pine)+';border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)';
        d.title = s[1];
        new mapboxgl.Marker({element:d})
          .setLngLat([s[3], s[2]])
          .setPopup(new mapboxgl.Popup({offset:14}).setHTML(stopPopupHTML(s[0], s[1])))
          .addTo(map);
      });

      map.fitBounds(bounds, {padding:26, duration:0});
    }

    // If the map never finishes (no WebGL, a blocked tile host, a hidden tab that
    // never paints), fall back to the schematic rather than leaving an empty box.
    var settled = false;
    function revertToSchematic(why){
      if(settled) return;
      settled = true;
      console.warn('real map unavailable, using the schematic map:', why);
      try { map.remove(); } catch(e){}
      el.classList.remove('on');
      document.querySelector('.mapcard').classList.remove('real');
    }
    var loadGuard = setTimeout(function(){ revertToSchematic('timed out'); }, 9000);
    map.on('load', function(){
      if(settled) return;
      settled = true; clearTimeout(loadGuard);
      addLayers();
    });
    map.on('error', function(e){
      var msg = (e && e.error && e.error.message) || 'unknown';
      console.warn('mapbox:', msg);
      if(/access token|Unauthorized|401|403/i.test(msg)) revertToSchematic(msg);
    });

    // the page's own buttons drive it
    document.getElementById('zoomIn').onclick  = function(){ map.zoomIn(); };
    document.getElementById('zoomOut').onclick = function(){ map.zoomOut(); };
    document.getElementById('fitTrip').onclick = function(){ map.fitBounds(bounds, {padding:26}); };
    var fitAll = document.getElementById('fitAll');
    fitAll.textContent = '3D';
    fitAll.onclick = function(){
      var p = map.getPitch() > 10 ? 0 : 62;
      map.easeTo({pitch:p, bearing: p ? -18 : 0, duration:900});
      fitAll.textContent = p ? '2D' : '3D';
    };
    var tog = document.getElementById('toggleChargers'); var on = true;
    tog.onclick = function(){
      on = !on;
      ['chargers','charger-labels'].forEach(function(id){
        if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      });
      tog.textContent = on ? 'Hide chargers' : 'Show chargers';
      tog.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    var zl = document.getElementById('zoomLevel');
    function readout(){ zl.textContent = 'zoom ' + map.getZoom().toFixed(1) + ' \u00b7 Mapbox'; }
    map.on('zoomend', readout); map.on('load', readout); readout();

    document.querySelector('.maphint').textContent =
      'Click any pin for elevation, camp, dog rules, dates, weather and booking links. Drag to pan, scroll with ctrl or two fingers to zoom, and use 3D to tilt into the terrain.';
    return true;
  }

  function tryRealMap(){
    try { if(!buildRealMap()) return; }
    catch(e){ console.error('real map failed, keeping the schematic:', e); }
  }

  // ---------- map pin popups ----------
  var ORIGIN = {
    id:'austin', title:'Austin, TX', badge:{cls:'city', text:'Trip start'},
    elevStart:489, elevEnd:489, miles:0, time:0, camp:'—',
    note:'Mile zero. Charge to 100% before you leave; the first day is the longest of the trip.',
    dog:'good', dogNote:'Off-leash parks all over town. Park rules start once you are on the road.'
  };

  function findStop(key){
    if(key === 'austin') return ORIGIN;
    var pools = [legs, directFinal, glacierBranch];
    for(var i=0;i<pools.length;i++){
      for(var j=0;j<pools[i].length;j++){
        if(pools[i][j].id === key) return pools[i][j];
      }
    }
    return null;
  }

  var pop = document.getElementById('mappop');
  var mapCard = pop.parentNode;
  var mapSvg = mapCard.querySelector('svg');
  var pinned = false, activeHot = null, hideTimer = null;

  function popHTML(leg){
    var onBranch = leg.branch && !glacierOn;
    var html = '<button class="pop-close" aria-label="Close">\u00d7</button>';
    html += '<h5>' + leg.title + '</h5>';
    html += '<span class="pop-badge badge ' + leg.badge.cls + '">' + leg.badge.text + '</span>';
    html += '<div class="pop-row">';
    html += '<span>Elevation <span class="mono">' + leg.elevEnd.toLocaleString() + ' ft</span></span>';
    if(leg.miles > 0){
      html += '<span>Leg <span class="mono">' + leg.miles + ' mi · ' + fmtHours(legHours(leg)) + '</span></span>';
      var t = altTax(leg);
      if(t.cost > 0.5) html += '<span>Climb tax <span class="mono">+' + Math.round(t.cost) + ' mi</span></span>';
      else if(t.bonus > 0.5) html += '<span>Regen <span class="mono">\u2212' + Math.round(t.bonus) + ' mi</span></span>';
    }
    html += '</div>';
    html += wxHTML(leg.id);
    if(hasCamp(leg.camp)) html += '<div class="pop-camp">\u26fa ' + leg.camp + '</div>';
    html += '<div class="pop-dog ' + leg.dog + '">\ud83d\udc3e ' + leg.dogNote + '</div>';
    if(onBranch) html += '<div class="pop-camp" style="color:var(--alpine)">On the optional Glacier branch. Turn it on in Trip settings to fold it into the totals.</div>';
    if(leg.links){
      html += '<div class="linkrow">' + leg.links.map(function(l){
        return '<a class="linkbtn' + (l.reserve ? ' reserve' : '') + '" href="' + l.url + '" target="_blank" rel="noopener">' + (l.reserve ? '\u26fa ' : '') + l.label + (l.reserve ? '' : ' \u2197') + '</a>';
      }).join('') + '</div>';
    }
    return html;
  }

  function showPop(hot){
    var leg = findStop(hot.getAttribute('data-stop'));
    if(!leg) return;
    clearTimeout(hideTimer);
    if(activeHot && activeHot !== hot) activeHot.classList.remove('active');
    activeHot = hot;
    hot.classList.add('active');
    pop.innerHTML = popHTML(leg);
    pop.hidden = false;

    var cardRect = mapCard.getBoundingClientRect();
    var hotRect = hot.getBoundingClientRect();
    var px = hotRect.left + hotRect.width/2 - cardRect.left;
    var py = hotRect.top + hotRect.height/2 - cardRect.top;

    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = px + 18, top = py - ph / 2;
    if(left + pw > cardRect.width - 8) left = px - 18 - pw;
    if(left < 8) left = 8;
    if(top < 8) top = 8;
    if(top + ph > cardRect.height - 8) top = Math.max(8, cardRect.height - 8 - ph);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    pop.querySelector('.pop-close').addEventListener('click', function(e){
      e.stopPropagation(); pinned = false; hidePop(true);
    });
  }

  function hidePop(now){
    if(pinned) return;
    clearTimeout(hideTimer);
    var go = function(){
      pop.hidden = true;
      if(activeHot){ activeHot.classList.remove('active'); activeHot = null; }
    };
    if(now) go(); else hideTimer = setTimeout(go, 220);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.hot'), function(hot){
    hot.addEventListener('mouseenter', function(){ if(!pinned) showPop(hot); });
    hot.addEventListener('mouseleave', function(){ hidePop(false); });
    hot.addEventListener('focus', function(){ showPop(hot); });
    hot.addEventListener('blur', function(){ if(!pinned) hidePop(false); });
    hot.addEventListener('click', function(e){
      e.stopPropagation();
      if(dragMoved){ dragMoved = false; return; }
      if(pinned && activeHot === hot){ pinned = false; hidePop(true); }
      else { pinned = true; showPop(hot); }
    });
    hot.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pinned = true; showPop(hot); }
    });
  });

  pop.addEventListener('mouseenter', function(){ clearTimeout(hideTimer); });
  pop.addEventListener('mouseleave', function(){ hidePop(false); });
  document.addEventListener('click', function(){ pinned = false; hidePop(true); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ pinned = false; hidePop(true); if(activeHot) activeHot.blur(); }
  });

  buildChargerLayer();
  collectFixed();
  collectLabels();
  setViewToBox(tripBox(), 1.04);

  recompute();
  tryRealMap();
})();
